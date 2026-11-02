import { afterEach, describe, expect, it, vi } from "vitest";
import {
  averageLongitudeAntimeridianSafe,
  centroidFromRings,
  fetchCountyCentroid,
  fetchEarthquakes,
  readQueryCentroid,
  sourceErrorDetail,
  USGS_EARTHQUAKE_PAGE_SIZE,
} from "./sources";

describe("county centroid lookup", () => {
  it("reads a geographic centroid from an ArcGIS query payload", () => {
    expect(
      readQueryCentroid({
        features: [{ centroid: { x: -118.224, y: 34.326 } }],
      }),
    ).toEqual({ lat: 34.326, lng: -118.224 });
  });

  it("rejects payloads without a usable centroid", () => {
    expect(readQueryCentroid(null)).toBeUndefined();
    expect(readQueryCentroid({ features: [] })).toBeUndefined();
    expect(readQueryCentroid({ features: [{ centroid: { x: 400, y: 10 } }] })).toBeUndefined();
  });

  it("refuses to interpolate a county id that is not a FIPS code", async () => {
    await expect(fetchCountyCentroid("06037' OR '1'='1")).rejects.toThrow(/FIPS/);
  });

  it("explains a token-gated feed instead of repeating the service code", () => {
    expect(sourceErrorDetail(new Error("Power outage request failed: Token Required"))).toBe(
      "This feed now requires an access token",
    );
    expect(sourceErrorDetail(new Error("NOAA alerts failed: 503"))).toBe("NOAA alerts failed: 503");
  });
});

describe("antimeridian-safe county centroids", () => {
  it("unwraps longitudes that straddle the dateline before averaging", () => {
    // Aleutians West-style sample: points on both sides of ±180.
    const mean = averageLongitudeAntimeridianSafe([-179.1, -178.5, 179.7, 178.2]);
    expect(mean).toBeLessThan(-170);
    expect(mean).toBeGreaterThan(-190);
  });

  it("keeps ordinary CONUS longitudes unchanged", () => {
    expect(averageLongitudeAntimeridianSafe([-118.2, -118.4, -117.9])).toBeCloseTo(-118.1667, 3);
  });

  it("does not place Aleutians West in Saskatchewan", () => {
    // Weight mirrors ArcGIS Aleutians West: enough ±180 samples that a naive mean
    // lands near -107 (Saskatchewan) while unwrapped points stay in the Aleutians.
    const rings = [
      [
        [-179.1, 52.9],
        [-179.0, 53.0],
        [-178.8, 52.7],
        [-178.5, 52.4],
        [179.8, 52.2],
        [-179.1, 52.9],
      ],
    ];
    const unique = rings[0].slice(0, -1);
    const naiveLng = unique.reduce((sum, [lng]) => sum + lng, 0) / unique.length;
    expect(naiveLng).toBeGreaterThan(-120);
    expect(naiveLng).toBeLessThan(-100);

    const point = centroidFromRings(rings);
    expect(point).toBeDefined();
    expect(point!.lng).toBeLessThan(-170);
    expect(point!.lat).toBeGreaterThan(51);
    expect(point!.lat).toBeLessThan(54);
  });
});

describe("USGS earthquake pagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pages beyond the first response so SoCal risk is not truncated at 25", async () => {
    const requests: URLSearchParams[] = [];
    const pageSize = Math.max(USGS_EARTHQUAKE_PAGE_SIZE, 1000);

    function feature(id: string, magnitude: number) {
      return {
        id,
        properties: { mag: magnitude, place: `Event ${id}`, time: Date.now() },
        geometry: { coordinates: [-118.25, 34.05, 10] as [number, number, number] },
      };
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(url.searchParams);
        const offset = Number(url.searchParams.get("offset") ?? "1");
        const limit = Number(url.searchParams.get("limit") ?? "0");
        expect(limit).toBeGreaterThanOrEqual(1000);

        const features =
          offset === 1
            ? Array.from({ length: pageSize }, (_, index) => feature(`p1-${index}`, 2.5))
            : Array.from({ length: 185 }, (_, index) => feature(`p2-${index}`, 3.1));

        return new Response(JSON.stringify({ features }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const rows = await fetchEarthquakes({ lat: 34.05, lng: -118.25 });

    expect(USGS_EARTHQUAKE_PAGE_SIZE).toBeGreaterThanOrEqual(1000);
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(Number(requests[1]?.get("offset"))).toBeGreaterThan(1);
    expect(rows.length).toBe(pageSize + 185);
  });
});
