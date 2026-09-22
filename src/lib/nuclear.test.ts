import { describe, expect, it } from "vitest";
import {
  BOMB_PROFILES,
  assessNuclearExposure,
  compassLabel,
  distanceKm,
  exposurePenalty,
  falloutPolygon,
  getBlastRings,
  pointInPolygon,
} from "./nuclear";

const center = { lat: 39.5, lng: -98.35 };

describe("nuclear geometry", () => {
  it("measures about 111 km per degree of latitude", () => {
    const distance = distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("keeps blast rings ordered from the fireball outward", () => {
    for (const profile of BOMB_PROFILES) {
      const radii = getBlastRings(profile).map((ring) => ring.radiusKm);
      const sorted = radii.slice().sort((left, right) => left - right);
      expect(radii).toEqual(sorted);
    }
  });

  it("assigns a penalty to every modeled ring", () => {
    for (const ring of getBlastRings(BOMB_PROFILES[0])) {
      expect(
        exposurePenalty({
          distanceKm: 0,
          insideRing: ring.label,
          inFallout: false,
        }),
      ).toBeGreaterThan(0);
    }
  });

  it("treats the reference ground zero as a fireball", () => {
    const exposure = assessNuclearExposure(center, center, BOMB_PROFILES[1], 90);
    expect(exposure.distanceKm).toBe(0);
    expect(exposure.insideRing).toBe("Fireball");
    expect(exposurePenalty(exposure)).toBe(72);
  });

  it("counts the downwind plume and excludes a distant point", () => {
    const profile = BOMB_PROFILES[0];
    const polygon = falloutPolygon(center, profile.yieldKt, 90);
    const inside = {
      lat: polygon.reduce((sum, point) => sum + point.lat, 0) / polygon.length,
      lng: polygon.reduce((sum, point) => sum + point.lng, 0) / polygon.length,
    };
    const exposure = assessNuclearExposure(inside, center, profile, 90);
    expect(pointInPolygon(inside, polygon)).toBe(true);
    expect(exposure.inFallout).toBe(true);
    expect(exposure.insideRing).toBeUndefined();

    const distant = assessNuclearExposure({ lat: 25, lng: -80 }, center, profile, 90);
    expect(distant.inFallout).toBe(false);
    expect(distant.insideRing).toBeUndefined();
    expect(exposurePenalty(distant)).toBe(0);
  });

  it("names compass directions from the fallout bearing", () => {
    expect(compassLabel(0)).toBe("N");
    expect(compassLabel(70)).toBe("ENE");
    expect(compassLabel(90)).toBe("E");
    expect(compassLabel(360)).toBe("N");
  });
});
