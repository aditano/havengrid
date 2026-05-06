import type { LatLngLiteral } from "leaflet";

export const NRI_COUNTY_LAYER =
  "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0";

export const DROUGHT_LAYER =
  "https://gis.fema.gov/arcgis/rest/services/Partner/Drought_Current/MapServer/0";

export const POWER_OUTAGE_LAYER =
  "https://gis.fema.gov/arcgis/rest/services/Partner/PowerOutages_EAGLE_I/FeatureServer/0";

export const NWS_ALERTS_ENDPOINT = "https://api.weather.gov/alerts/active";
export const USGS_EARTHQUAKE_ENDPOINT =
  "https://earthquake.usgs.gov/fdsnws/event/1/query";

export const NRI_COUNTY_FIELDS = [
  "OBJECTID",
  "NRI_ID",
  "STATE",
  "STATEABBRV",
  "COUNTY",
  "COUNTYTYPE",
  "STCOFIPS",
  "POPULATION",
  "AREA",
  "RISK_SCORE",
  "RISK_RATNG",
  "EAL_SCORE",
  "SOVI_SCORE",
  "SOVI_RATNG",
  "RESL_SCORE",
  "RESL_RATNG",
  "AGRIVALUE",
  "BUILDVALUE",
  "WFIR_RISKS",
  "HWAV_RISKS",
  "CFLD_RISKS",
  "IFLD_RISKS",
  "HRCN_RISKS",
  "ERQK_RISKS",
  "TRND_RISKS",
  "SWND_RISKS",
  "HAIL_RISKS",
  "LTNG_RISKS",
  "WNTW_RISKS",
  "ISTM_RISKS",
  "CWAV_RISKS",
  "DRGT_RISKS",
  "NRI_VER",
];

export type CountyAttributes = {
  OBJECTID?: number;
  NRI_ID?: string;
  STATE?: string;
  STATEABBRV?: string;
  COUNTY?: string;
  COUNTYTYPE?: string;
  STCOFIPS?: string;
  POPULATION?: number;
  AREA?: number;
  RISK_SCORE?: number;
  RISK_RATNG?: string;
  EAL_SCORE?: number;
  SOVI_SCORE?: number;
  SOVI_RATNG?: string;
  RESL_SCORE?: number;
  RESL_RATNG?: string;
  AGRIVALUE?: number;
  BUILDVALUE?: number;
  NRI_VER?: string;
  [key: string]: number | string | undefined;
};

export type SelectedCounty = {
  attrs: CountyAttributes;
  point: LatLngLiteral;
};

export type MapTarget = {
  attrs?: CountyAttributes;
  point: LatLngLiteral;
};

export type WeatherAlert = {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  certainty: string;
  effective?: string;
  ends?: string;
};

export type PowerOutage = {
  county?: string;
  state?: string;
  totalCustomers?: number;
  customersOut?: number;
  percentOut?: number;
  updatedAt?: string;
};

export type DroughtStatus = {
  dm: number;
  label: string;
  updatedAt?: string;
};

export type EarthquakeEvent = {
  id: string;
  place: string;
  magnitude: number;
  time: string;
  lat: number;
  lon: number;
  url?: string;
};

export type SourceStatus = {
  name: string;
  status: "ready" | "error" | "loading";
  detail: string;
};

export type LiveData = {
  alerts: WeatherAlert[];
  power?: PowerOutage;
  drought?: DroughtStatus;
  earthquakes: EarthquakeEvent[];
  statuses: SourceStatus[];
  fetchedAt: string;
};

const DROUGHT_LABELS: Record<number, string> = {
  0: "Abnormally dry",
  1: "Moderate drought",
  2: "Severe drought",
  3: "Extreme drought",
  4: "Exceptional drought",
};

const EXCLUDED_TERRITORIES = new Set(["AS", "GU", "MP", "PR", "VI"]);

export async function fetchCountyAttributes(): Promise<CountyAttributes[]> {
  const rows: CountyAttributes[] = [];
  let offset = 0;
  const pageSize = 2000;

  while (true) {
    const params = new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: NRI_COUNTY_FIELDS.join(","),
      returnGeometry: "false",
      orderByFields: "STCOFIPS",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });

    const response = await fetch(`${NRI_COUNTY_LAYER}/query?${params}`);
    if (!response.ok) {
      throw new Error(`FEMA NRI request failed: ${response.status}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message ?? "FEMA NRI request failed");
    }

    const features = payload.features ?? [];
    rows.push(
      ...features
        .map((feature: { attributes: CountyAttributes }) => feature.attributes)
        .filter((attrs: CountyAttributes) => {
          return attrs.STATEABBRV && !EXCLUDED_TERRITORIES.has(attrs.STATEABBRV);
        }),
    );

    if (features.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return rows;
}

export async function fetchLiveData(
  selection: SelectedCounty,
): Promise<LiveData> {
  const statuses: SourceStatus[] = [
    { name: "NOAA alerts", status: "loading", detail: "Checking active alerts" },
    { name: "EAGLE-I outages", status: "loading", detail: "Checking county outages" },
    { name: "U.S. Drought Monitor", status: "loading", detail: "Checking drought polygon" },
    { name: "USGS earthquakes", status: "loading", detail: "Checking recent events" },
  ];

  const [alerts, power, drought, earthquakes] = await Promise.allSettled([
    fetchWeatherAlerts(selection.point),
    fetchPowerOutage(selection.attrs.STCOFIPS),
    fetchDroughtStatus(selection.point),
    fetchEarthquakes(selection.point),
  ]);

  const alertRows = unwrapResult(alerts, []);
  const powerRow = unwrapResult(power, undefined);
  const droughtRow = unwrapResult(drought, undefined);
  const quakeRows = unwrapResult(earthquakes, []);

  statuses[0] = resultStatus(
    "NOAA alerts",
    alerts,
    `${alertRows.length} active alert${alertRows.length === 1 ? "" : "s"}`,
  );
  statuses[1] = resultStatus(
    "EAGLE-I outages",
    power,
    powerRow
      ? `${formatNumber(powerRow.customersOut ?? 0)} customers out`
      : "No county outage record returned",
  );
  statuses[2] = resultStatus(
    "U.S. Drought Monitor",
    drought,
    droughtRow ? droughtRow.label : "No drought polygon at point",
  );
  statuses[3] = resultStatus(
    "USGS earthquakes",
    earthquakes,
    `${quakeRows.length} events within 250 km in 30 days`,
  );

  return {
    alerts: alertRows,
    power: powerRow,
    drought: droughtRow,
    earthquakes: quakeRows,
    statuses,
    fetchedAt: new Date().toISOString(),
  };
}

function unwrapResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function resultStatus<T>(
  name: string,
  result: PromiseSettledResult<T>,
  readyDetail: string,
): SourceStatus {
  if (result.status === "fulfilled") {
    return { name, status: "ready", detail: readyDetail };
  }

  return {
    name,
    status: "error",
    detail: result.reason instanceof Error ? result.reason.message : "Source failed",
  };
}

async function fetchWeatherAlerts(point: LatLngLiteral): Promise<WeatherAlert[]> {
  const params = new URLSearchParams({
    point: `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`,
  });
  const response = await fetch(`${NWS_ALERTS_ENDPOINT}?${params}`, {
    headers: {
      Accept: "application/geo+json, application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`NOAA alerts failed: ${response.status}`);
  }
  const payload = await response.json();
  return (payload.features ?? []).map(
    (feature: {
      id: string;
      properties: {
        event?: string;
        headline?: string;
        severity?: string;
        urgency?: string;
        certainty?: string;
        effective?: string;
        ends?: string;
      };
    }) => ({
      id: feature.id,
      event: feature.properties.event ?? "Weather alert",
      headline: feature.properties.headline ?? "Active alert",
      severity: feature.properties.severity ?? "Unknown",
      urgency: feature.properties.urgency ?? "Unknown",
      certainty: feature.properties.certainty ?? "Unknown",
      effective: feature.properties.effective,
      ends: feature.properties.ends,
    }),
  );
}

async function fetchPowerOutage(fips?: string): Promise<PowerOutage | undefined> {
  if (!fips) {
    return undefined;
  }
  const params = new URLSearchParams({
    f: "json",
    where: `fips='${fips}'`,
    outFields:
      "name,state_name,fips,total_customers,customers_out,perc_out,time_stamp,update_dat",
    returnGeometry: "false",
    resultRecordCount: "1",
  });

  const response = await fetch(`${POWER_OUTAGE_LAYER}/query?${params}`);
  if (!response.ok) {
    throw new Error(`Power outage request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? "Power outage request failed");
  }

  const attrs = payload.features?.[0]?.attributes;
  if (!attrs) {
    return undefined;
  }

  return {
    county: attrs.name,
    state: attrs.state_name,
    totalCustomers: numberOrUndefined(attrs.total_customers),
    customersOut: numberOrUndefined(attrs.customers_out),
    percentOut: numberOrUndefined(attrs.perc_out),
    updatedAt: dateString(attrs.update_dat ?? attrs.time_stamp),
  };
}

async function fetchDroughtStatus(
  point: LatLngLiteral,
): Promise<DroughtStatus | undefined> {
  const geometry = JSON.stringify({
    x: point.lng,
    y: point.lat,
    spatialReference: { wkid: 4326 },
  });
  const params = new URLSearchParams({
    f: "json",
    geometry,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "dm,update_dat",
    returnGeometry: "false",
  });

  const response = await fetch(`${DROUGHT_LAYER}/query?${params}`);
  if (!response.ok) {
    throw new Error(`Drought Monitor request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? "Drought Monitor request failed");
  }

  const attrs = payload.features?.[0]?.attributes;
  if (!attrs) {
    return undefined;
  }

  const dm = Number(attrs.dm);
  return {
    dm,
    label: DROUGHT_LABELS[dm] ?? "No drought category",
    updatedAt: dateString(attrs.update_dat),
  };
}

async function fetchEarthquakes(point: LatLngLiteral): Promise<EarthquakeEvent[]> {
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const params = new URLSearchParams({
    format: "geojson",
    latitude: String(point.lat),
    longitude: String(point.lng),
    maxradiuskm: "250",
    starttime: startDate,
    orderby: "time",
    limit: "25",
  });

  const response = await fetch(`${USGS_EARTHQUAKE_ENDPOINT}?${params}`);
  if (!response.ok) {
    throw new Error(`USGS earthquake request failed: ${response.status}`);
  }

  const payload = await response.json();
  return (payload.features ?? []).map(
    (feature: {
      id: string;
      properties: { mag?: number; place?: string; time?: number; url?: string };
      geometry: { coordinates: [number, number, number] };
    }) => ({
      id: feature.id,
      place: feature.properties.place ?? "Earthquake",
      magnitude: feature.properties.mag ?? 0,
      time: new Date(feature.properties.time ?? Date.now()).toISOString(),
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      url: feature.properties.url,
    }),
  );
}

function numberOrUndefined(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function dateString(value: unknown): string | undefined {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return undefined;
  }
  return new Date(numberValue).toISOString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
