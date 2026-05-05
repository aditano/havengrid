import type { CountyAttributes, LiveData } from "../data/sources";

export type ScenarioId =
  | "overview"
  | "nuclear"
  | "wildfire"
  | "flood"
  | "earthquake"
  | "storm"
  | "power"
  | "food"
  | "drought";

export type Preparedness = {
  supplyDays: number;
  waterDays: number;
  generator: boolean;
  evacuationPlan: boolean;
};

export type ScoreBreakdown = {
  score: number;
  hazard: number;
  vulnerability: number;
  resilience: number;
  livePenalty: number;
  preparednessBonus: number;
  label: string;
  summary: string;
};

export type Scenario = {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  description: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "overview",
    label: "All risks",
    shortLabel: "All",
    description: "Composite public hazard, vulnerability, and resilience picture.",
  },
  {
    id: "nuclear",
    label: "Nuclear strike",
    shortLabel: "Nuclear",
    description: "Regional continuity stress plus reference blast visualization.",
  },
  {
    id: "wildfire",
    label: "Wildfire",
    shortLabel: "Fire",
    description: "FEMA wildfire risk, live alerts, resilience, and readiness.",
  },
  {
    id: "flood",
    label: "Flooding",
    shortLabel: "Flood",
    description: "Coastal, riverine, hurricane, and current alert pressure.",
  },
  {
    id: "earthquake",
    label: "Earthquake",
    shortLabel: "Quake",
    description: "FEMA earthquake risk with recent USGS events near the pin.",
  },
  {
    id: "storm",
    label: "Major storm",
    shortLabel: "Storm",
    description: "Hurricane, tornado, hail, wind, lightning, and winter weather stress.",
  },
  {
    id: "power",
    label: "Power outage",
    shortLabel: "Power",
    description: "Live EAGLE-I outage data blended with weather outage drivers.",
  },
  {
    id: "food",
    label: "Food shortage",
    shortLabel: "Food",
    description: "Drought, heat, agriculture exposure, social vulnerability, and resilience.",
  },
  {
    id: "drought",
    label: "Drought",
    shortLabel: "Drought",
    description: "FEMA drought risk plus the current U.S. Drought Monitor category.",
  },
];

export function calculateCountyScore(
  attrs: CountyAttributes,
  scenarioId: ScenarioId,
  preparedness: Preparedness,
  liveData?: LiveData,
): ScoreBreakdown {
  const hazard = getScenarioHazard(attrs, scenarioId);
  const vulnerability = fieldValue(attrs, "SOVI_SCORE", 48);
  const resilience = fieldValue(attrs, "RESL_SCORE", 52);
  const livePenalty = getLivePenalty(scenarioId, liveData);
  const preparednessBonus = getPreparednessBonus(preparedness, scenarioId);

  const score = clamp(
    82 - hazard * 0.56 - vulnerability * 0.17 + resilience * 0.24 - livePenalty + preparednessBonus,
    0,
    100,
  );
  const label = scoreLabel(score);

  return {
    score,
    hazard,
    vulnerability,
    resilience,
    livePenalty,
    preparednessBonus,
    label,
    summary: getScoreSummary(score, scenarioId),
  };
}

export function getScenarioHazard(
  attrs: CountyAttributes,
  scenarioId: ScenarioId,
): number {
  switch (scenarioId) {
    case "nuclear":
      return average([
        densityRisk(attrs),
        100 - fieldValue(attrs, "RESL_SCORE", 50),
        fieldValue(attrs, "SOVI_SCORE", 48),
      ]);
    case "wildfire":
      return average([fieldValue(attrs, "WFIR_RISKS", 35), fieldValue(attrs, "HWAV_RISKS", 35)]);
    case "flood":
      return average([
        fieldValue(attrs, "CFLD_RISKS", 20),
        fieldValue(attrs, "IFLD_RISKS", 35),
        fieldValue(attrs, "HRCN_RISKS", 25),
      ]);
    case "earthquake":
      return fieldValue(attrs, "ERQK_RISKS", 25);
    case "storm":
      return average([
        fieldValue(attrs, "HRCN_RISKS", 25),
        fieldValue(attrs, "TRND_RISKS", 35),
        fieldValue(attrs, "SWND_RISKS", 35),
        fieldValue(attrs, "HAIL_RISKS", 35),
        fieldValue(attrs, "LTNG_RISKS", 35),
        fieldValue(attrs, "WNTW_RISKS", 35),
        fieldValue(attrs, "ISTM_RISKS", 30),
      ]);
    case "power":
      return average([
        fieldValue(attrs, "HWAV_RISKS", 35),
        fieldValue(attrs, "CWAV_RISKS", 35),
        fieldValue(attrs, "HRCN_RISKS", 25),
        fieldValue(attrs, "SWND_RISKS", 35),
        fieldValue(attrs, "WNTW_RISKS", 35),
        100 - fieldValue(attrs, "RESL_SCORE", 50),
      ]);
    case "food":
      return average([
        fieldValue(attrs, "DRGT_RISKS", 35),
        fieldValue(attrs, "HWAV_RISKS", 35),
        fieldValue(attrs, "SOVI_SCORE", 48),
        agricultureExposure(attrs),
        100 - fieldValue(attrs, "RESL_SCORE", 50),
      ]);
    case "drought":
      return average([fieldValue(attrs, "DRGT_RISKS", 35), fieldValue(attrs, "HWAV_RISKS", 35)]);
    case "overview":
    default:
      return fieldValue(attrs, "RISK_SCORE", 45);
  }
}

export function countyName(attrs: CountyAttributes): string {
  const county = attrs.COUNTY ?? "Unknown county";
  const type = attrs.COUNTYTYPE && attrs.COUNTYTYPE !== "County" ? ` ${attrs.COUNTYTYPE}` : "";
  const state = attrs.STATEABBRV ?? attrs.STATE ?? "";
  return `${county}${type}${state ? `, ${state}` : ""}`;
}

export function scoreToColor(score: number): string {
  if (score >= 82) return "#16784f";
  if (score >= 70) return "#42a36d";
  if (score >= 58) return "#c7b33a";
  if (score >= 44) return "#e8843a";
  return "#c83e4d";
}

export function scoreLabel(score: number): string {
  if (score >= 82) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 58) return "Stressed";
  if (score >= 44) return "Hard";
  return "Critical";
}

export function rankCounties(
  counties: CountyAttributes[],
  scenarioId: ScenarioId,
  preparedness: Preparedness,
): { best: CountyAttributes[]; worst: CountyAttributes[] } {
  const scored = counties
    .filter((county) => county.STCOFIPS && county.STATEABBRV)
    .map((county) => ({
      county,
      score: calculateCountyScore(county, scenarioId, preparedness).score,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    best: scored.slice(0, 5).map((row) => row.county),
    worst: scored.slice(-5).reverse().map((row) => row.county),
  };
}

export function formatScore(value: number): string {
  return String(Math.round(value));
}

export function fieldValue(
  attrs: CountyAttributes,
  field: string,
  fallback: number,
): number {
  const raw = attrs[field];
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return clamp(value, 0, 100);
}

export function densityRisk(attrs: CountyAttributes): number {
  const population = numeric(attrs.POPULATION);
  const area = numeric(attrs.AREA);
  if (!population || !area) {
    return 35;
  }
  const density = population / area;
  return clamp(Math.log10(density + 1) * 22, 0, 100);
}

function agricultureExposure(attrs: CountyAttributes): number {
  const agriculture = numeric(attrs.AGRIVALUE);
  const area = numeric(attrs.AREA);
  if (!agriculture || !area) {
    return 35;
  }
  return clamp(Math.log10(agriculture / area + 1) * 8, 0, 100);
}

function getLivePenalty(scenarioId: ScenarioId, liveData?: LiveData): number {
  if (!liveData) {
    return 0;
  }

  const alertPenalty =
    ["overview", "storm", "flood", "wildfire", "power"].includes(scenarioId)
      ? weatherAlertPenalty(liveData)
      : 0;
  const powerPenalty =
    scenarioId === "power" || scenarioId === "overview"
      ? clamp((liveData.power?.percentOut ?? 0) * 2.2, 0, 34)
      : 0;
  const droughtPenalty =
    ["drought", "food", "wildfire", "overview"].includes(scenarioId)
      ? (liveData.drought?.dm ?? 0) * 8
      : 0;
  const quakePenalty =
    scenarioId === "earthquake" || scenarioId === "overview"
      ? earthquakePenalty(liveData)
      : 0;

  return clamp(alertPenalty + powerPenalty + droughtPenalty + quakePenalty, 0, 52);
}

function getPreparednessBonus(
  preparedness: Preparedness,
  scenarioId: ScenarioId,
): number {
  const foodAndWater =
    Math.min(preparedness.supplyDays, 30) * 0.42 +
    Math.min(preparedness.waterDays, 14) * 0.55;
  const power = preparedness.generator && ["power", "storm", "nuclear"].includes(scenarioId) ? 6 : 2;
  const movement = preparedness.evacuationPlan ? 5 : 0;

  return clamp(foodAndWater + power + movement, 0, 24);
}

function weatherAlertPenalty(liveData: LiveData): number {
  return clamp(
    liveData.alerts.reduce((total, alert) => total + severityPenalty(alert.severity), 0),
    0,
    30,
  );
}

function severityPenalty(severity: string): number {
  switch (severity.toLowerCase()) {
    case "extreme":
      return 18;
    case "severe":
      return 12;
    case "moderate":
      return 7;
    case "minor":
      return 3;
    default:
      return 2;
  }
}

function earthquakePenalty(liveData: LiveData): number {
  return clamp(
    liveData.earthquakes.reduce((total, event) => {
      return total + Math.max(0, event.magnitude - 2) * 4;
    }, 0),
    0,
    32,
  );
}

function getScoreSummary(score: number, scenarioId: ScenarioId): string {
  const scenario = SCENARIOS.find((item) => item.id === scenarioId)?.shortLabel ?? "Scenario";
  if (score >= 82) {
    return `${scenario} continuity looks resilient here, assuming local conditions match the public datasets.`;
  }
  if (score >= 70) {
    return `${scenario} continuity looks workable, with some pressure points to watch.`;
  }
  if (score >= 58) {
    return `${scenario} continuity is mixed and would depend heavily on preparation and timing.`;
  }
  if (score >= 44) {
    return `${scenario} continuity looks difficult without outside support or early action.`;
  }
  return `${scenario} continuity looks highly stressed in this model.`;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numeric(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
