import { describe, expect, it } from "vitest";
import { fetchCountyCentroid, readQueryCentroid } from "./sources";

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
});
