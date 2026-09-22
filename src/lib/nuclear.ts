import type { LatLngLiteral } from "leaflet";

export type BombProfile = {
  id: string;
  name: string;
  yieldKt: number;
  description: string;
};

export type BlastRing = {
  label: string;
  radiusKm: number;
  color: string;
  fillOpacity: number;
};

export const BOMB_PROFILES: BombProfile[] = [
  {
    id: "small-10",
    name: "10 kt reference",
    yieldKt: 10,
    description: "Small fission-scale reference device",
  },
  {
    id: "little-boy-15",
    name: "15 kt Little Boy scale",
    yieldKt: 15,
    description: "Historic Hiroshima-scale reference yield",
  },
  {
    id: "w76-90",
    name: "90 kt warhead scale",
    yieldKt: 90,
    description: "Modern strategic-warhead reference yield",
  },
  {
    id: "w87-300",
    name: "300 kt warhead scale",
    yieldKt: 300,
    description: "Large strategic-warhead reference yield",
  },
  {
    id: "b83-1200",
    name: "1.2 Mt high-yield scale",
    yieldKt: 1200,
    description: "Very large thermonuclear reference yield",
  },
];

export function getBlastRings(profile: BombProfile): BlastRing[] {
  const blastScale = Math.cbrt(profile.yieldKt / 15);
  const thermalScale = Math.pow(profile.yieldKt / 15, 0.41);

  return [
    {
      label: "Fireball",
      radiusKm: 0.18 * blastScale,
      color: "#7f1d1d",
      fillOpacity: 0.38,
    },
    {
      label: "Severe blast",
      radiusKm: 0.72 * blastScale,
      color: "#dc2626",
      fillOpacity: 0.24,
    },
    {
      label: "Heavy damage",
      radiusKm: 1.45 * blastScale,
      color: "#f97316",
      fillOpacity: 0.18,
    },
    {
      label: "Thermal exposure",
      radiusKm: 2.25 * thermalScale,
      color: "#facc15",
      fillOpacity: 0.12,
    },
    {
      label: "Light damage",
      radiusKm: 4.8 * blastScale,
      color: "#38bdf8",
      fillOpacity: 0.08,
    },
  ];
}

export type NuclearExposure = {
  distanceKm: number;
  insideRing?: string;
  inFallout: boolean;
};

const RING_PENALTIES: Record<string, number> = {
  Fireball: 72,
  "Severe blast": 50,
  "Heavy damage": 34,
  "Thermal exposure": 20,
  "Light damage": 12,
};

const COMPASS_LABELS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export function distanceKm(from: LatLngLiteral, to: LatLngLiteral): number {
  const radiusKm = 6371;
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;

  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function assessNuclearExposure(
  home: LatLngLiteral,
  groundZero: LatLngLiteral,
  bomb: BombProfile,
  windDirection: number,
): NuclearExposure {
  const distance = distanceKm(home, groundZero);
  const rings = getBlastRings(bomb).slice().sort((a, b) => a.radiusKm - b.radiusKm);
  const insideRing = rings.find((ring) => distance <= ring.radiusKm)?.label;
  const inFallout = pointInPolygon(
    home,
    falloutPolygon(groundZero, bomb.yieldKt, windDirection),
  );

  return {
    distanceKm: distance,
    insideRing,
    inFallout,
  };
}

export function exposurePenalty(exposure: NuclearExposure): number {
  const ringPenalty = exposure.insideRing ? (RING_PENALTIES[exposure.insideRing] ?? 0) : 0;
  const falloutPenalty = exposure.inFallout ? 16 : 0;
  return Math.min(72, Math.max(ringPenalty, falloutPenalty));
}

export function describeExposure(exposure: NuclearExposure): string {
  const distance = formatDistanceKm(exposure.distanceKm);

  if (exposure.distanceKm < 0.05) {
    return "The home point is at the reference ground zero, inside the modeled fireball.";
  }

  if (exposure.insideRing) {
    return `The home point is inside the modeled ${exposure.insideRing.toLowerCase()} zone, ${distance} from the reference ground zero.`;
  }

  if (exposure.inFallout) {
    return `The home point is outside the blast rings and inside the modeled fallout plume, ${distance} from ground zero.`;
  }

  return `The home point is ${distance} from the reference ground zero, outside the modeled blast and fallout.`;
}

export function formatDistanceKm(distance: number): string {
  if (distance < 10) {
    return `${distance.toFixed(1)} km`;
  }
  return `${Math.round(distance)} km`;
}

export function compassLabel(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % COMPASS_LABELS.length;
  return COMPASS_LABELS[index] ?? "N";
}

export function pointInPolygon(point: LatLngLiteral, polygon: LatLngLiteral[]): boolean {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) {
      continue;
    }

    const crossesLatitude = currentPoint.lat > point.lat !== previousPoint.lat > point.lat;
    if (!crossesLatitude) {
      continue;
    }

    const longitudeAtLatitude =
      ((previousPoint.lng - currentPoint.lng) * (point.lat - currentPoint.lat)) /
        (previousPoint.lat - currentPoint.lat) +
      currentPoint.lng;
    if (point.lng < longitudeAtLatitude) {
      inside = !inside;
    }
  }

  return inside;
}

export function falloutPolygon(
  center: LatLngLiteral,
  yieldKt: number,
  bearingDegrees: number,
): LatLngLiteral[] {
  const plumeLength = Math.min(420, 34 * Math.sqrt(yieldKt / 15));
  const plumeWidth = Math.max(8, plumeLength * 0.24);
  const downwind = offsetPoint(center, bearingDegrees, plumeLength);
  const leftMid = offsetPoint(
    offsetPoint(center, bearingDegrees, plumeLength * 0.38),
    bearingDegrees - 90,
    plumeWidth * 0.55,
  );
  const rightMid = offsetPoint(
    offsetPoint(center, bearingDegrees, plumeLength * 0.38),
    bearingDegrees + 90,
    plumeWidth * 0.55,
  );
  const leftFar = offsetPoint(downwind, bearingDegrees - 90, plumeWidth * 0.18);
  const rightFar = offsetPoint(downwind, bearingDegrees + 90, plumeWidth * 0.18);

  return [center, leftMid, leftFar, downwind, rightFar, rightMid];
}

function offsetPoint(
  origin: LatLngLiteral,
  bearingDegrees: number,
  distance: number,
): LatLngLiteral {
  const radiusKm = 6371;
  const bearing = toRadians(bearingDegrees);
  const angularDistance = distance / radiusKm;
  const lat1 = toRadians(origin.lat);
  const lon1 = toRadians(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: toDegrees(lat2),
    lng: toDegrees(lon2),
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
