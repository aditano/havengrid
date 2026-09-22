import { describe, expect, it } from "vitest";
import type { CountyAttributes, LiveData } from "../data/sources";
import {
  calculateCountyScore,
  countyName,
  rankCounties,
  type Preparedness,
} from "./score";

const preparedness: Preparedness = {
  supplyDays: 10,
  waterDays: 5,
  generator: false,
  evacuationPlan: true,
};

const county: CountyAttributes = {
  STCOFIPS: "06037",
  COUNTY: "Los Angeles",
  COUNTYTYPE: "County",
  STATEABBRV: "CA",
  POPULATION: 10000000,
  AREA: 4000,
  RISK_SCORE: 80,
  SOVI_SCORE: 60,
  RESL_SCORE: 40,
  WFIR_RISKS: 70,
  HWAV_RISKS: 55,
  DRGT_RISKS: 40,
  ERQK_RISKS: 90,
};

function liveData(overrides: Partial<LiveData> = {}): LiveData {
  return {
    alerts: [],
    earthquakes: [],
    statuses: [],
    fetchedAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateCountyScore", () => {
  it("stays inside the continuity scale", () => {
    const score = calculateCountyScore(county, "overview", preparedness);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(score.score)).toBe(true);
  });

  it("treats a higher scenario hazard as a lower score", () => {
    const exposed = calculateCountyScore(
      { ...county, WFIR_RISKS: 95, HWAV_RISKS: 95 },
      "wildfire",
      preparedness,
    );
    const sheltered = calculateCountyScore(
      { ...county, WFIR_RISKS: 5, HWAV_RISKS: 5 },
      "wildfire",
      preparedness,
    );
    expect(exposed.score).toBeLessThan(sheltered.score);
  });

  it("rewards stored supplies", () => {
    const unprepared = calculateCountyScore(county, "overview", {
      ...preparedness,
      supplyDays: 0,
      waterDays: 0,
    });
    const prepared = calculateCountyScore(county, "overview", {
      ...preparedness,
      supplyDays: 30,
      waterDays: 14,
    });
    expect(prepared.score).toBeGreaterThan(unprepared.score);
  });

  it("applies an extreme weather alert to storm continuity", () => {
    const calm = calculateCountyScore(county, "storm", preparedness);
    const warned = calculateCountyScore(
      county,
      "storm",
      preparedness,
      liveData({
        alerts: [
          {
            id: "alert-1",
            event: "Tornado Warning",
            headline: "Tornado warning",
            severity: "Extreme",
            urgency: "Immediate",
            certainty: "Observed",
          },
        ],
      }),
    );
    expect(warned.livePenalty).toBeGreaterThan(0);
    expect(warned.score).toBeLessThan(calm.score);
  });

  it("keeps a finite score when the drought category is not a number", () => {
    const score = calculateCountyScore(
      county,
      "drought",
      preparedness,
      liveData({ drought: { dm: Number.NaN, label: "Unknown" } }),
    );
    expect(Number.isFinite(score.score)).toBe(true);
    expect(score.livePenalty).toBe(0);
  });

  it("ignores non-numeric outage and earthquake values", () => {
    const calm = calculateCountyScore(county, "overview", preparedness);
    const dirty = calculateCountyScore(
      county,
      "overview",
      preparedness,
      liveData({
        power: { percentOut: Number.NaN },
        earthquakes: [
          {
            id: "q1",
            place: "Unknown",
            magnitude: Number.NaN,
            time: "2026-09-22T00:00:00.000Z",
            lat: 34,
            lon: -118,
          },
        ],
      }),
    );
    expect(Number.isFinite(dirty.score)).toBe(true);
    expect(dirty.score).toBe(calm.score);
  });

  it("lowers the nuclear score when the home point is at ground zero", () => {
    const baseline = calculateCountyScore(county, "nuclear", preparedness);
    const exposed = calculateCountyScore(county, "nuclear", preparedness, undefined, {
      distanceKm: 0,
      insideRing: "Fireball",
      inFallout: true,
    });
    expect(exposed.exposurePenalty).toBe(72);
    expect(exposed.score).toBeLessThan(baseline.score);
    expect(exposed.summary.toLowerCase()).toContain("fireball");
  });

  it("ignores blast exposure outside the nuclear scenario", () => {
    const baseline = calculateCountyScore(county, "overview", preparedness);
    const exposed = calculateCountyScore(county, "overview", preparedness, undefined, {
      distanceKm: 0,
      insideRing: "Fireball",
      inFallout: true,
    });
    expect(exposed.exposurePenalty).toBe(0);
    expect(exposed.score).toBe(baseline.score);
  });
});

describe("county rankings and names", () => {
  it("formats parish names and leaves ordinary counties plain", () => {
    expect(countyName(county)).toBe("Los Angeles, CA");
    expect(
      countyName({
        COUNTY: "Orleans",
        COUNTYTYPE: "Parish",
        STATEABBRV: "LA",
      }),
    ).toBe("Orleans Parish, LA");
  });

  it("orders the best and worst modeled counties", () => {
    const calm = { ...county, STCOFIPS: "00001", COUNTY: "Calm", RISK_SCORE: 5 };
    const stressed = { ...county, STCOFIPS: "00002", COUNTY: "Stressed", RISK_SCORE: 99 };
    const rankings = rankCounties([stressed, calm], "overview", preparedness);
    expect(rankings.best[0]?.county.COUNTY).toBe("Calm");
    expect(rankings.worst[0]?.county.COUNTY).toBe("Stressed");
    expect(rankings.best[0]?.score).toBeGreaterThan(rankings.worst[0]?.score ?? 0);
  });
});
