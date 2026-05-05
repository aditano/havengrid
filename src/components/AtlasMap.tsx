import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import * as esri from "esri-leaflet";
import type { BombProfile } from "../lib/nuclear";
import { falloutPolygon, getBlastRings } from "../lib/nuclear";
import {
  DROUGHT_LAYER,
  NRI_COUNTY_FIELDS,
  NRI_COUNTY_LAYER,
  POWER_OUTAGE_LAYER,
  type CountyAttributes,
  type LiveData,
  type SelectedCounty,
} from "../data/sources";
import {
  calculateCountyScore,
  countyName,
  scoreToColor,
  type Preparedness,
  type ScenarioId,
} from "../lib/score";

type AtlasMapProps = {
  scenarioId: ScenarioId;
  preparedness: Preparedness;
  selected: SelectedCounty | null;
  liveData?: LiveData;
  bomb: BombProfile;
  windDirection: number;
  onCountySelect: (selection: SelectedCounty) => void;
};

const US_CENTER: [number, number] = [39.5, -98.35];
const STYLE_CACHE_LIMIT = 50000;

export default function AtlasMap({
  scenarioId,
  preparedness,
  selected,
  liveData,
  bomb,
  windDirection,
  onCountySelect,
}: AtlasMapProps) {
  const blastRings = useMemo(() => getBlastRings(bomb), [bomb]);
  const showDrought = ["drought", "food", "wildfire"].includes(scenarioId);
  const showPower = scenarioId === "power";
  const showQuakes = scenarioId === "earthquake" || scenarioId === "overview";

  return (
    <div className="atlas-map-wrap">
      <MapContainer
        className="atlas-map"
        center={US_CENTER}
        zoom={4}
        minZoom={3}
        maxZoom={11}
        preferCanvas
        scrollWheelZoom
        maxBounds={[
          [16, -170],
          [72, -52],
        ]}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CountyRiskLayer
          scenarioId={scenarioId}
          preparedness={preparedness}
          selectedFips={selected?.attrs.STCOFIPS}
          onCountySelect={onCountySelect}
        />
        {showDrought ? <DroughtOverlay /> : null}
        {showPower ? <PowerOverlay /> : null}
        {selected ? (
          <>
            <SelectionFocus selected={selected} />
            <CircleMarker
              center={selected.point}
              radius={8}
              pathOptions={{
                color: "#111827",
                fillColor: "#ffffff",
                fillOpacity: 1,
                weight: 3,
              }}
            />
          </>
        ) : null}
        {selected && scenarioId === "nuclear" ? (
          <>
            {blastRings
              .slice()
              .reverse()
              .map((ring) => (
                <Circle
                  key={ring.label}
                  center={selected.point}
                  radius={ring.radiusKm * 1000}
                  pathOptions={{
                    color: ring.color,
                    fillColor: ring.color,
                    fillOpacity: ring.fillOpacity,
                    weight: 2,
                  }}
                />
              ))}
            <Polygon
              positions={falloutPolygon(selected.point, bomb.yieldKt, windDirection)}
              pathOptions={{
                color: "#5b21b6",
                fillColor: "#7c3aed",
                fillOpacity: 0.16,
                weight: 2,
                dashArray: "7 7",
              }}
            />
          </>
        ) : null}
        {showQuakes && liveData
          ? liveData.earthquakes.map((quake) => (
              <CircleMarker
                key={quake.id}
                center={[quake.lat, quake.lon]}
                radius={Math.max(4, Math.min(13, quake.magnitude * 2.5))}
                pathOptions={{
                  color: "#6d28d9",
                  fillColor: "#a855f7",
                  fillOpacity: 0.42,
                  weight: 1.5,
                }}
              />
            ))
          : null}
      </MapContainer>
      <div className="map-legend" aria-label="Map score legend">
        <span className="legend-chip low" />
        <span>Worst</span>
        <span className="legend-track" />
        <span>Best</span>
        <span className="legend-chip high" />
      </div>
      {selected && scenarioId === "nuclear" ? (
        <div className="blast-legend">
          {blastRings.map((ring) => (
            <span key={ring.label}>
              <i style={{ backgroundColor: ring.color }} />
              {ring.label} {ring.radiusKm.toFixed(ring.radiusKm > 10 ? 0 : 1)} km
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CountyRiskLayer({
  scenarioId,
  preparedness,
  selectedFips,
  onCountySelect,
}: {
  scenarioId: ScenarioId;
  preparedness: Preparedness;
  selectedFips?: string;
  onCountySelect: (selection: SelectedCounty) => void;
}) {
  const map = useMap();
  const layerRef = useRef<any>();
  const onCountySelectRef = useRef(onCountySelect);
  const stateRef = useRef({ scenarioId, preparedness, selectedFips });
  const colorCacheRef = useRef(new Map<string, string>());
  const countyRenderer = useMemo(() => L.canvas({ padding: 0.4 }), []);
  onCountySelectRef.current = onCountySelect;
  stateRef.current = { scenarioId, preparedness, selectedFips };

  useEffect(() => {
    const layer = esri.featureLayer({
      url: NRI_COUNTY_LAYER,
      where: "STATEABBRV NOT IN ('AS','GU','MP','PR','VI')",
      fields: NRI_COUNTY_FIELDS,
      renderer: countyRenderer,
      simplifyFactor: 0.75,
      precision: 4,
      style: (feature: { properties: CountyAttributes }) =>
        countyStyle(
          feature.properties,
          stateRef.current.scenarioId,
          stateRef.current.preparedness,
          stateRef.current.selectedFips,
          colorCacheRef.current,
        ),
    });

    layer.on("click", (event: any) => {
      const attrs = event.layer?.feature?.properties as CountyAttributes | undefined;
      if (!attrs) {
        return;
      }
      onCountySelectRef.current({
        attrs,
        point: { lat: event.latlng.lat, lng: event.latlng.lng },
      });
    });

    layer.on("mouseover", (event: any) => {
      event.layer.setStyle({ weight: 2, color: "#111827", fillOpacity: 0.78 });
      const attrs = event.layer?.feature?.properties as CountyAttributes | undefined;
      if (attrs) {
        event.layer.bindTooltip(countyName(attrs), { sticky: true }).openTooltip();
      }
    });

    layer.on("mouseout", (event: any) => {
      const attrs = event.layer?.feature?.properties as CountyAttributes | undefined;
      if (attrs) {
        event.layer.setStyle(
          countyStyle(
            attrs,
            stateRef.current.scenarioId,
            stateRef.current.preparedness,
            stateRef.current.selectedFips,
            colorCacheRef.current,
          ),
        );
      }
    });

    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = undefined;
    };
  }, [countyRenderer, map]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      layerRef.current?.setStyle((feature: { properties: CountyAttributes }) =>
        countyStyle(
          feature.properties,
          scenarioId,
          preparedness,
          selectedFips,
          colorCacheRef.current,
        ),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [preparedness, scenarioId, selectedFips]);

  return null;
}

function DroughtOverlay() {
  const map = useMap();
  const renderer = useMemo(() => L.canvas({ padding: 0.35 }), []);

  useEffect(() => {
    const layer = esri.featureLayer({
      url: DROUGHT_LAYER,
      fields: ["dm", "update_dat"],
      renderer,
      simplifyFactor: 0.9,
      precision: 3,
      style: (feature: { properties: { dm?: number } }) => droughtStyle(feature.properties.dm),
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, renderer]);

  return null;
}

function PowerOverlay() {
  const map = useMap();
  const renderer = useMemo(() => L.canvas({ padding: 0.35 }), []);

  useEffect(() => {
    const layer = esri.featureLayer({
      url: POWER_OUTAGE_LAYER,
      fields: ["perc_out", "customers_out", "name"],
      renderer,
      simplifyFactor: 0.9,
      precision: 3,
      style: (feature: { properties: { perc_out?: number } }) => {
        const percentOut = Number(feature.properties.perc_out ?? 0);
        return {
          color: "#111827",
          weight: 0.4,
          fillColor: outageColor(percentOut),
          fillOpacity: percentOut > 0 ? 0.62 : 0.08,
          opacity: 0.32,
        };
      },
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, renderer]);

  return null;
}

function SelectionFocus({ selected }: { selected: SelectedCounty }) {
  const map = useMap();
  const selectedId = selected.attrs.STCOFIPS;

  useEffect(() => {
    const targetZoom = Math.max(map.getZoom(), 6);
    map.flyTo(selected.point, targetZoom, { duration: 0.55 });
  }, [map, selected.point, selectedId]);

  return null;
}

function countyStyle(
  attrs: CountyAttributes,
  scenarioId: ScenarioId,
  preparedness: Preparedness,
  selectedFips?: string,
  colorCache?: Map<string, string>,
): L.PathOptions {
  const fillColor = cachedScoreColor(attrs, scenarioId, preparedness, colorCache);
  const isSelected = selectedFips && attrs.STCOFIPS === selectedFips;

  return {
    color: isSelected ? "#111827" : "#374151",
    weight: isSelected ? 2.3 : 0.45,
    fillColor,
    fillOpacity: isSelected ? 0.82 : 0.58,
    opacity: isSelected ? 0.96 : 0.36,
  };
}

function cachedScoreColor(
  attrs: CountyAttributes,
  scenarioId: ScenarioId,
  preparedness: Preparedness,
  colorCache?: Map<string, string>,
): string {
  if (!colorCache) {
    return scoreToColor(calculateCountyScore(attrs, scenarioId, preparedness).score);
  }

  if (colorCache.size > STYLE_CACHE_LIMIT) {
    colorCache.clear();
  }

  const key = [
    attrs.STCOFIPS ?? attrs.NRI_ID ?? attrs.OBJECTID,
    scenarioId,
    preparedness.supplyDays,
    preparedness.waterDays,
    Number(preparedness.generator),
    Number(preparedness.evacuationPlan),
  ].join(":");
  const cached = colorCache.get(key);
  if (cached) {
    return cached;
  }

  const color = scoreToColor(calculateCountyScore(attrs, scenarioId, preparedness).score);
  colorCache.set(key, color);
  return color;
}

function droughtStyle(dm = -1): L.PathOptions {
  const colors = ["#facc15", "#f59e0b", "#f97316", "#dc2626", "#7f1d1d"];
  return {
    color: "#7c2d12",
    weight: 0,
    fillColor: colors[dm] ?? "#ffffff",
    fillOpacity: dm >= 0 ? 0.32 : 0,
    opacity: 0,
  };
}

function outageColor(percentOut: number): string {
  if (percentOut >= 20) return "#991b1b";
  if (percentOut >= 10) return "#ef4444";
  if (percentOut >= 5) return "#f97316";
  if (percentOut > 0) return "#facc15";
  return "#86efac";
}
