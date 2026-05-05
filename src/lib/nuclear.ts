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
  distanceKm: number,
): LatLngLiteral {
  const radiusKm = 6371;
  const bearing = toRadians(bearingDegrees);
  const angularDistance = distanceKm / radiusKm;
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
