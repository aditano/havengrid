import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CloudLightning,
  Flame,
  MapPin,
  Radiation,
  RefreshCw,
  ShieldCheck,
  SunMedium,
  Waves,
  Wheat,
  Zap,
} from "lucide-react";
import AtlasMap from "./components/AtlasMap";
import CountySearch from "./components/CountySearch";
import LiveConditions from "./components/LiveConditions";
import {
  fetchCountyAttributes,
  fetchCountyCentroid,
  fetchLiveData,
  type CountyAttributes,
  type LiveData,
  type MapTarget,
  type SelectedCounty,
} from "./data/sources";
import {
  assessNuclearExposure,
  BOMB_PROFILES,
  compassLabel,
  distanceKm,
  formatDistanceKm,
} from "./lib/nuclear";
import {
  SCENARIOS,
  calculateCountyScore,
  countyName,
  formatScore,
  rankCounties,
  scoreToColor,
  type Preparedness,
  type RankedCounty,
  type ScenarioId,
} from "./lib/score";

const PREPAREDNESS_KEY = "havengrid:preparedness:v1";

const DEFAULT_PREPAREDNESS: Preparedness = {
  supplyDays: 10,
  waterDays: 5,
  generator: false,
  evacuationPlan: true,
};

const scenarioIcons: Record<ScenarioId, typeof Activity> = {
  overview: Activity,
  nuclear: Radiation,
  wildfire: Flame,
  flood: Waves,
  earthquake: Activity,
  storm: CloudLightning,
  power: Zap,
  food: Wheat,
  drought: SunMedium,
};

type MapClickTarget = "home" | "blast";

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("overview");
  const [selected, setSelected] = useState<SelectedCounty | null>(null);
  const [nuclearTarget, setNuclearTarget] = useState<MapTarget | null>(null);
  const [mapClickTarget, setMapClickTarget] = useState<MapClickTarget>("home");
  const [counties, setCounties] = useState<CountyAttributes[]>([]);
  const [countyLoadError, setCountyLoadError] = useState<string | null>(null);
  const [countyReload, setCountyReload] = useState(0);
  const [liveData, setLiveData] = useState<LiveData | undefined>();
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveNonce, setLiveNonce] = useState(0);
  const [preparedness, setPreparedness] = useState(readPreparedness);
  const [bombId, setBombId] = useState(BOMB_PROFILES[1].id);
  const [windDirection, setWindDirection] = useState(70);
  const [locatingFips, setLocatingFips] = useState<string | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const locateRequest = useRef(0);
  const mapPanelRef = useRef<HTMLElement | null>(null);

  const selectedBomb =
    BOMB_PROFILES.find((profile) => profile.id === bombId) ?? BOMB_PROFILES[1];
  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];
  const activeMapClickTarget = scenarioId === "nuclear" ? mapClickTarget : "home";
  const exposure =
    scenarioId === "nuclear" && selected && nuclearTarget
      ? assessNuclearExposure(selected.point, nuclearTarget.point, selectedBomb, windDirection)
      : undefined;
  const selectedScore = selected
    ? calculateCountyScore(selected.attrs, scenarioId, preparedness, liveData, exposure)
    : undefined;
  const selectedFillColor = selectedScore ? scoreToColor(selectedScore.score) : undefined;
  const selectionKey = selected
    ? `${selected.attrs.STCOFIPS ?? ""}:${selected.point.lat}:${selected.point.lng}`
    : "";
  const selectionKeyRef = useRef(selectionKey);

  const rankings = useMemo(
    () => rankCounties(counties, scenarioId, preparedness),
    [counties, preparedness, scenarioId],
  );

  useEffect(() => {
    let active = true;
    setCountyLoadError(null);

    fetchCountyAttributes()
      .then((rows) => {
        if (active) {
          setCounties(rows);
          setCountyLoadError(null);
        }
      })
      .catch((error) => {
        if (active) {
          setCountyLoadError(error instanceof Error ? error.message : "County data failed");
        }
      });

    return () => {
      active = false;
    };
  }, [countyReload]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREPAREDNESS_KEY, JSON.stringify(preparedness));
    } catch {
      // Storage can be unavailable. The current session still keeps the controls.
    }
  }, [preparedness]);

  useEffect(() => {
    if (scenarioId !== "nuclear" && mapClickTarget !== "home") {
      setMapClickTarget("home");
    }
  }, [mapClickTarget, scenarioId]);

  useEffect(() => {
    if (!selected) {
      setLiveData(undefined);
      setLiveLoading(false);
      return;
    }

    const selectionChanged = selectionKeyRef.current !== selectionKey;
    selectionKeyRef.current = selectionKey;
    if (selectionChanged) {
      setLiveData(undefined);
    }

    let active = true;
    setLiveLoading(true);
    fetchLiveData(selected)
      .then((data) => {
        if (active) {
          setLiveData(data);
        }
      })
      .catch(() => {
        if (active && selectionChanged) {
          setLiveData(undefined);
        }
      })
      .finally(() => {
        if (active) {
          setLiveLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selected, selectionKey, liveNonce]);

  async function selectKnownCounty(attrs: CountyAttributes) {
    const fips = attrs.STCOFIPS;
    if (!fips) {
      return;
    }

    const requestId = locateRequest.current + 1;
    locateRequest.current = requestId;
    setLocatingFips(fips);
    setLocateError(null);

    try {
      const point = await fetchCountyCentroid(fips);
      if (locateRequest.current !== requestId) {
        return;
      }
      if (!point) {
        setLocateError("That county has no map point in the public layer.");
        return;
      }
      setSelected({ attrs, point });
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      mapPanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
    } catch (error) {
      if (locateRequest.current !== requestId) {
        return;
      }
      setLocateError(error instanceof Error ? error.message : "Couldn't locate that county");
    } finally {
      if (locateRequest.current === requestId) {
        setLocatingFips(null);
      }
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={24} strokeWidth={2.3} />
          </div>
          <div>
            <h1>HavenGrid</h1>
            <p>Public-risk simulator for U.S. location resilience</p>
          </div>
        </div>
        <div className="topbar-status">
          <span
            className={
              counties.length ? "status-dot ready" : countyLoadError ? "status-dot error" : "status-dot"
            }
          />
          <span>
            {counties.length
              ? `${counties.length.toLocaleString()} counties loaded`
              : countyLoadError ?? "Loading public county data"}
          </span>
          {countyLoadError ? (
            <button
              className="text-button"
              type="button"
              onClick={() => setCountyReload((current) => current + 1)}
            >
              Try again
            </button>
          ) : null}
        </div>
      </header>

      <main className="workspace">
        <section className="map-panel" aria-label="U.S. risk map" ref={mapPanelRef}>
          <AtlasMap
            scenarioId={scenarioId}
            preparedness={preparedness}
            selected={selected}
            selectedFillColor={selectedFillColor}
            nuclearTarget={nuclearTarget}
            liveData={liveData}
            bomb={selectedBomb}
            windDirection={windDirection}
            mapClickTarget={activeMapClickTarget}
            onCountySelect={setSelected}
            onNuclearTargetSelect={setNuclearTarget}
          />
        </section>

        <aside className="control-panel">
          <section className="panel-section">
            <CountySearch
              counties={counties}
              countyLoadError={countyLoadError}
              locatingFips={locatingFips}
              error={locateError}
              onSelect={(county) => {
                void selectKnownCounty(county);
              }}
            />
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <Activity size={18} />
              <span>Scenario</span>
            </div>
            <div className="scenario-grid">
              {SCENARIOS.map((item) => {
                const Icon = scenarioIcons[item.id];
                return (
                  <button
                    key={item.id}
                    className={`scenario-button ${scenarioId === item.id ? "active" : ""}`}
                    type="button"
                    aria-pressed={scenarioId === item.id}
                    onClick={() => setScenarioId(item.id)}
                    title={item.description}
                  >
                    <Icon size={17} />
                    <span>{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>
            <p className="scenario-description">{scenario.description}</p>
          </section>

          {scenarioId === "nuclear" ? (
            <section className="panel-section">
              <div className="section-heading">
                <Radiation size={18} />
                <span>Reference device</span>
              </div>
              <label className="field-label" htmlFor="bomb-profile">
                Yield profile
              </label>
              <select
                id="bomb-profile"
                value={bombId}
                onChange={(event) => setBombId(event.target.value)}
              >
                {BOMB_PROFILES.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <p className="field-note">{selectedBomb.description}</p>

              <div className="field-label" id="map-click-target-label">
                Map click target
              </div>
              <div
                className="segmented-control"
                role="group"
                aria-labelledby="map-click-target-label"
              >
                <button
                  className={mapClickTarget === "home" ? "active" : ""}
                  type="button"
                  aria-pressed={mapClickTarget === "home"}
                  onClick={() => setMapClickTarget("home")}
                >
                  Home county
                </button>
                <button
                  className={mapClickTarget === "blast" ? "active" : ""}
                  type="button"
                  aria-pressed={mapClickTarget === "blast"}
                  onClick={() => setMapClickTarget("blast")}
                >
                  Ground zero
                </button>
              </div>
              <div className="target-readout">
                <div>
                  <span>Home county</span>
                  <strong>{selected ? countyName(selected.attrs) : "None selected"}</strong>
                </div>
                <div>
                  <span>Ground zero</span>
                  <strong>{formatTargetName(nuclearTarget)}</strong>
                </div>
              </div>
              {selected && nuclearTarget ? (
                <p className="field-note">
                  Home point is {formatDistanceKm(distanceKm(selected.point, nuclearTarget.point))} from
                  ground zero.
                </p>
              ) : (
                <p className="field-note">
                  Set a ground zero to include modeled blast and fallout in the county score.
                </p>
              )}
              {selected ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setNuclearTarget({ attrs: selected.attrs, point: selected.point })
                  }
                >
                  Use home point
                </button>
              ) : null}

              <label className="field-label" htmlFor="wind-direction">
                Fallout blows toward
              </label>
              <input
                id="wind-direction"
                type="range"
                min="0"
                max="359"
                value={windDirection}
                onChange={(event) => setWindDirection(Number(event.target.value))}
              />
              <div className="range-readout">
                {windDirection}° {compassLabel(windDirection)}
              </div>
            </section>
          ) : null}

          <section className="panel-section">
            <div className="section-heading">
              <ShieldCheck size={18} />
              <span>Preparedness</span>
            </div>
            <Slider
              label="Shelf-stable food"
              value={preparedness.supplyDays}
              min={0}
              max={30}
              suffix="days"
              onChange={(value) =>
                setPreparedness((current) => ({ ...current, supplyDays: value }))
              }
            />
            <Slider
              label="Stored water"
              value={preparedness.waterDays}
              min={0}
              max={14}
              suffix="days"
              onChange={(value) =>
                setPreparedness((current) => ({ ...current, waterDays: value }))
              }
            />
            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={preparedness.generator}
                  onChange={(event) =>
                    setPreparedness((current) => ({
                      ...current,
                      generator: event.target.checked,
                    }))
                  }
                />
                Backup power
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preparedness.evacuationPlan}
                  onChange={(event) =>
                    setPreparedness((current) => ({
                      ...current,
                      evacuationPlan: event.target.checked,
                    }))
                  }
                />
                Evacuation plan
              </label>
            </div>
          </section>

          <section className="panel-section selected-section">
            <div className="section-heading">
              <MapPin size={18} />
              <span>Selected location</span>
              {selected ? (
                <button
                  className={liveLoading ? "icon-button spinning" : "icon-button"}
                  type="button"
                  aria-label="Refresh live feeds"
                  disabled={liveLoading}
                  onClick={() => setLiveNonce((current) => current + 1)}
                >
                  <RefreshCw size={15} />
                </button>
              ) : null}
            </div>

            {selected && selectedScore ? (
              <>
                <div className="score-block">
                  <div
                    className="score-ring"
                    style={{
                      background: `conic-gradient(${scoreToColor(
                        selectedScore.score,
                      )} ${selectedScore.score * 3.6}deg, #e5e7eb 0deg)`,
                    }}
                  >
                    <div>
                      <strong>{formatScore(selectedScore.score)}</strong>
                      <span>{selectedScore.label}</span>
                    </div>
                  </div>
                  <div className="score-copy">
                    <h2>{countyName(selected.attrs)}</h2>
                    <p>{selectedScore.summary}</p>
                  </div>
                </div>
                <div className="metric-grid">
                  <Metric label="Hazard" value={selectedScore.hazard} />
                  <Metric label="Vulnerability" value={selectedScore.vulnerability} />
                  <Metric label="Resilience" value={selectedScore.resilience} />
                  <Metric
                    label={scenarioId === "nuclear" ? "Exposure" : "Live impact"}
                    value={
                      scenarioId === "nuclear"
                        ? selectedScore.exposurePenalty
                        : selectedScore.livePenalty
                    }
                  />
                </div>
              </>
            ) : (
              <div className="empty-state">
                <MapPin size={28} />
                <p>Search for a county or click the map.</p>
              </div>
            )}
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <AlertTriangle size={18} />
              <span>Live feeds</span>
              {liveLoading ? <span className="mini-loader">Refreshing</span> : null}
            </div>
            {liveData ? (
              <LiveConditions liveData={liveData} />
            ) : (
              <p className="field-note">
                {liveLoading
                  ? "Checking live feeds."
                  : "Live source checks appear after a location is selected."}
              </p>
            )}
          </section>

          <section className="panel-section ranking-section">
            <div className="section-heading">
              <ShieldCheck size={18} />
              <span>Best and worst</span>
            </div>
            <RankingList
              title="Best modeled counties"
              rows={rankings.best}
              locatingFips={locatingFips}
              emptyMessage={countyLoadError ?? "Loading county rankings"}
              onSelect={(county) => {
                void selectKnownCounty(county);
              }}
            />
            <RankingList
              title="Worst modeled counties"
              rows={rankings.worst}
              locatingFips={locatingFips}
              emptyMessage={countyLoadError ?? "Loading county rankings"}
              onSelect={(county) => {
                void selectKnownCounty(county);
              }}
            />
          </section>

          <section className="source-links">
            <a href="https://hazards.fema.gov/nri/data-resources" target="_blank" rel="noreferrer">
              FEMA NRI
            </a>
            <a href="https://www.weather.gov/documentation/services-web-alerts" target="_blank" rel="noreferrer">
              NOAA alerts
            </a>
            <a href="https://gis.fema.gov/arcgis/rest/services/Partner/PowerOutages_EAGLE_I/FeatureServer" target="_blank" rel="noreferrer">
              EAGLE-I outages
            </a>
            <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noreferrer">
              USGS quakes
            </a>
            <a href="https://www.drought.gov/data-maps-tools/us-drought-monitor" target="_blank" rel="noreferrer">
              Drought Monitor
            </a>
          </section>
        </aside>
      </main>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        <strong>
          {value} {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{formatScore(value)}</strong>
    </div>
  );
}

function RankingList({
  title,
  rows,
  locatingFips,
  emptyMessage,
  onSelect,
}: {
  title: string;
  rows: RankedCounty[];
  locatingFips: string | null;
  emptyMessage: string;
  onSelect: (county: CountyAttributes) => void;
}) {
  return (
    <div className="ranking-list">
      <h3>{title}</h3>
      {rows.length ? (
        rows.map((row) => (
          <button
            className="rank-row"
            key={row.county.STCOFIPS}
            type="button"
            title={`Show ${countyName(row.county)}`}
            onClick={() => onSelect(row.county)}
          >
            <span>{countyName(row.county)}</span>
            <strong style={{ color: scoreToColor(row.score) }}>
              {locatingFips === row.county.STCOFIPS ? "…" : formatScore(row.score)}
            </strong>
          </button>
        ))
      ) : (
        <p className="field-note">{emptyMessage}</p>
      )}
    </div>
  );
}

function formatTargetName(target: MapTarget | null): string {
  if (!target) {
    return "None selected";
  }

  if (target.attrs) {
    return countyName(target.attrs);
  }

  return `${target.point.lat.toFixed(3)}, ${target.point.lng.toFixed(3)}`;
}

function readPreparedness(): Preparedness {
  try {
    const raw = window.localStorage.getItem(PREPAREDNESS_KEY);
    if (!raw) {
      return DEFAULT_PREPAREDNESS;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_PREPAREDNESS;
    }

    const value = parsed as Partial<Record<keyof Preparedness, unknown>>;
    return {
      supplyDays: boundedNumber(value.supplyDays, 0, 30, DEFAULT_PREPAREDNESS.supplyDays),
      waterDays: boundedNumber(value.waterDays, 0, 14, DEFAULT_PREPAREDNESS.waterDays),
      generator: value.generator === true,
      evacuationPlan: value.evacuationPlan !== false,
    };
  } catch {
    return DEFAULT_PREPAREDNESS;
  }
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}
