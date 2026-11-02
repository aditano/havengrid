import { describe, expect, it } from "vitest";
import {
  averageLongitudeAntimeridianSafe,
  centroidFromRings,
  fetchCountyCentroid,
  readQueryCentroid,
  sourceErrorDetail,
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
