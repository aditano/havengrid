import { describe, expect, it } from "vitest";
import type { CountyAttributes } from "../data/sources";
import { searchCounties } from "./search";

const counties: CountyAttributes[] = [
  { STCOFIPS: "48269", COUNTY: "King", COUNTYTYPE: "County", STATEABBRV: "TX", STATE: "Texas" },
  { STCOFIPS: "53033", COUNTY: "King", COUNTYTYPE: "County", STATEABBRV: "WA", STATE: "Washington" },
  { STCOFIPS: "36047", COUNTY: "Kings", COUNTYTYPE: "County", STATEABBRV: "NY", STATE: "New York" },
  {
    STCOFIPS: "06037",
    COUNTY: "Los Angeles",
    COUNTYTYPE: "County",
    STATEABBRV: "CA",
    STATE: "California",
  },
  {
    STCOFIPS: "22071",
    COUNTY: "Orleans",
    COUNTYTYPE: "Parish",
    STATEABBRV: "LA",
    STATE: "Louisiana",
  },
];

describe("searchCounties", () => {
  it("waits for at least two characters", () => {
    expect(searchCounties(counties, "k")).toEqual([]);
    expect(searchCounties(counties, "  ")).toEqual([]);
  });

  it("prefers the state abbreviation when several counties share a name", () => {
    const matches = searchCounties(counties, "king wa");
    expect(matches.map((county) => county.STCOFIPS)).toEqual(["53033"]);
  });

  it("finds a county by FIPS code or parish name", () => {
    expect(searchCounties(counties, "06037")[0]?.COUNTY).toBe("Los Angeles");
    expect(searchCounties(counties, "orleans parish")[0]?.STCOFIPS).toBe("22071");
  });
});
