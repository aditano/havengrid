import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import * as esri from "esri-leaflet";
import type { BlastRing, BombProfile } from "../lib/nuclear";
import { falloutPolygon, getBlastRings } from "../lib/nuclear";
import {
  DROUGHT_LAYER,
  NRI_COUNTY_FIELDS,
  NRI_COUNTY_LAYER,
  POWER_OUTAGE_LAYER,
  type CountyAttributes,
  type LiveData,
  type MapTarget,
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
  nuclearTarget: MapTarget | null;
  liveData?: LiveData;
  bomb: BombProfile;
  windDirection: number;
  mapClickTarget: MapClickTarget;
  onCountySelect: (selection: SelectedCounty) => void;
  onNuclearTargetSelect: (target: MapTarget) => void;
};

type MapClickTarget = "home" | "blast";

const US_CENTER: [number, number] = [39.5, -98.35];
const STYLE_CACHE_LIMIT = 50000;
const VISUAL_OVERLAY_PANE = "visual-overlay-pane";

export default function AtlasMap({
  scenarioId,
  preparedness,
  selected,
  nuclearTarget,
  liveData,
  bomb,
  windDirection,
  mapClickTarget,
  onCountySelect,
  onNuclearTargetSelect,
}: AtlasMapProps) {
  const blastRings = useMemo(() => getBlastRings(bomb), [bomb]);
  const showDrought = ["drought", "food", "wildfire"].includes(scenarioId);
  const showPower = scenarioId === "power";
  const showQuakes = scenarioId === "earthquake" || scenarioId === "overview";
  const showNuclearTarget = scenarioId === "nuclear" && nuclearTarget;

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
          mapClickTarget={mapClickTarget}
          onCountySelect={onCountySelect}
          onNuclearTargetSelect={onNuclearTargetSelect}
        />
        {showDrought ? <DroughtOverlay /> : null}
        {showPower ? <PowerOverlay /> : null}
        {selected ? (
          <>
            <SelectionFocus selected={selected} />
            <CircleMarker
              center={selected.point}
              radius={8}
              interactive={false}
              pathOptions={{
                color: "#111827",
                fillColor: "#ffffff",
                fillOpacity: 1,
                weight: 3,
              }}
            />
          </>
        ) : null}
        {showNuclearTarget ? (
          <>
            <CircleMarker
              center={nuclearTarget.point}
              radius={11}
              interactive={false}
              pathOptions={{
                color: "#7f1d1d",
                fillColor: "#fee2e2",
                fillOpacity: 1,
                weight: 3,
              }}
            />
            <CircleMarker
              center={nuclearTarget.point}
              radius={4}
              interactive={false}
              pathOptions={{
                color: "#7f1d1d",
                fillColor: "#dc2626",
                fillOpacity: 1,
                weight: 1,
              }}
            />
            {blastRings
              .slice()
              .reverse()
              .map((ring) => (
                <Circle
                  key={ring.label}
                  center={nuclearTarget.point}
                  radius={ring.radiusKm * 1000}
                  interactive={false}
                  pathOptions={{
                    color: ring.color,
                    fillColor: ring.color,
                    fillOpacity: ring.fillOpacity,
                    weight: 2,
                  }}
                />
              ))}
            <Polygon
              positions={falloutPolygon(nuclearTarget.point, bomb.yieldKt, windDirection)}
              interactive={false}
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
                interactive={false}
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
      <MapKey
        scenarioId={scenarioId}
        selected={selected}
        nuclearTarget={nuclearTarget}
        blastRings={blastRings}
        showDrought={showDrought}
        showPower={showPower}
        showQuakes={showQuakes}
      />
    </div>
  );
}

function MapKey({
  scenarioId,
  selected,
  nuclearTarget,
  blastRings,
  showDrought,
  showPower,
  showQuakes,
}: {
  scenarioId: ScenarioId;
  selected: SelectedCounty | null;
  nuclearTarget: MapTarget | null;
  blastRings: BlastRing[];
  showDrought: boolean;
  showPower: boolean;
  showQuakes: boolean;
}) {
  return (
    <div className="map-key" aria-label="Map key">
      <div className="map-key-title">Map key</div>
      <div className="key-row score-key">
        <span className="legend-chip low" />
        <span className="legend-track" />
        <span className="legend-chip high" />
        <strong>Low to high continuity score</strong>
      </div>
      {selected ? (
        <div className="key-row">
          <span className="key-symbol home-pin" />
          <span>Home county marker</span>
        </div>
      ) : null}
      {scenarioId === "nuclear" ? (
        <>
          <div className="key-row">
            <span className="key-symbol ground-zero-pin" />
            <span>Ground zero marker</span>
          </div>
          {nuclearTarget
            ? blastRings.map((ring) => (
                <div className="key-row" key={ring.label}>
                  <span
                    className="key-symbol blast-ring"
                    style={{ borderColor: ring.color, backgroundColor: ring.color }}
                  />
                  <span>
                    {ring.label} {ring.radiusKm.toFixed(ring.radiusKm > 10 ? 0 : 1)} km
                  </span>
                </div>
              ))
            : null}
          <div className="key-row">
            <span className="key-symbol fallout-plume" />
            <span>Purple fallout estimate</span>
          </div>
        </>
      ) : null}
      {showQuakes ? (
        <div className="key-row">
          <span className="key-symbol quake-dot" />
          <span>Purple circles: recent USGS earthquakes</span>
        </div>
      ) : null}
      {showDrought ? (
        <div className="key-row">
          <span className="key-symbol drought-wash" />
          <span>Yellow to red wash: drought category</span>
        </div>
      ) : null}
      {showPower ? (
        <div className="key-row">
          <span className="key-symbol outage-wash" />
          <span>Yellow to red wash: outage share</span>
        </div>
      ) : null}
    </div>
  );
}

function CountyRiskLayer({
  scenarioId,
  preparedness,
  selectedFips,
  mapClickTarget,
  onCountySelect,
  onNuclearTargetSelect,
}: {
  scenarioId: ScenarioId;
  preparedness: Preparedness;
  selectedFips?: string;
  mapClickTarget: MapClickTarget;
  onCountySelect: (selection: SelectedCounty) => void;
  onNuclearTargetSelect: (target: MapTarget) => void;
}) {
  const map = useMap();
  const layerRef = useRef<any>();
  const onCountySelectRef = useRef(onCountySelect);
  const onNuclearTargetSelectRef = useRef(onNuclearTargetSelect);
  const stateRef = useRef({ scenarioId, preparedness, selectedFips });
  const mapClickTargetRef = useRef(mapClickTarget);
  const colorCacheRef = useRef(new Map<string, string>());
  const countyRenderer = useMemo(() => L.canvas({ padding: 0.4 }), []);
  onCountySelectRef.current = onCountySelect;
  onNuclearTargetSelectRef.current = onNuclearTargetSelect;
  stateRef.current = { scenarioId, preparedness, selectedFips };
  mapClickTargetRef.current = mapClickTarget;

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
      const target = {
        attrs,
        point: { lat: event.latlng.lat, lng: event.latlng.lng },
      };

      if (mapClickTargetRef.current === "blast") {
        onNuclearTargetSelectRef.current(target);
      } else {
        onCountySelectRef.current(target);
      }
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
  const renderer = useMemo(
    () => L.canvas({ padding: 0.35, pane: VISUAL_OVERLAY_PANE }),
    [],
  );

  useEffect(() => {
    const pane = ensureVisualOverlayPane(map);
    const layer = esri.featureLayer({
      url: DROUGHT_LAYER,
      fields: ["dm", "update_dat"],
      pane,
      renderer,
      interactive: false,
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
  const renderer = useMemo(
    () => L.canvas({ padding: 0.35, pane: VISUAL_OVERLAY_PANE }),
    [],
  );

  useEffect(() => {
    const pane = ensureVisualOverlayPane(map);
    const layer = esri.featureLayer({
      url: POWER_OUTAGE_LAYER,
      fields: ["perc_out", "customers_out", "name"],
      pane,
      renderer,
      interactive: false,
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

function ensureVisualOverlayPane(map: L.Map): string {
  const pane = map.getPane(VISUAL_OVERLAY_PANE) ?? map.createPane(VISUAL_OVERLAY_PANE);
  pane.style.zIndex = "430";
  pane.style.pointerEvents = "none";
  return VISUAL_OVERLAY_PANE;
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
