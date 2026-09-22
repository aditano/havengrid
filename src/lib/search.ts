import type { CountyAttributes } from "../data/sources";
import { countyName } from "./score";

export function searchCounties(
  counties: CountyAttributes[],
  query: string,
  limit = 8,
): CountyAttributes[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 2) {
    return [];
  }

  const terms = normalized.split(" ");
  return counties
    .filter((county) => county.STCOFIPS && matchesCounty(county, terms))
    .sort((left, right) => {
      const scoreDelta = matchScore(right, normalized, terms) - matchScore(left, normalized, terms);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return countyName(left).localeCompare(countyName(right));
    })
    .slice(0, limit);
}

function matchesCounty(county: CountyAttributes, terms: string[]): boolean {
  const haystack = [county.COUNTY, county.COUNTYTYPE, county.STATEABBRV, county.STATE, county.STCOFIPS]
    .filter((value) => value)
    .join(" ")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function matchScore(county: CountyAttributes, normalized: string, terms: string[]): number {
  const name = (county.COUNTY ?? "").toLowerCase();
  const abbreviation = (county.STATEABBRV ?? "").toLowerCase();
  const fips = county.STCOFIPS ?? "";
  let score = 0;

  if (fips === normalized) {
    score += 120;
  }
  if (name === normalized || name === terms[0]) {
    score += 80;
  }
  if (terms[0] && name.startsWith(terms[0])) {
    score += 40;
  }
  if (terms.some((term) => term.length === 2 && term === abbreviation)) {
    score += 25;
  }

  return score;
}
