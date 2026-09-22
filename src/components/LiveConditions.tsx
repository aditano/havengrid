import type { DroughtStatus, EarthquakeEvent, LiveData, PowerOutage } from "../data/sources";

const VISIBLE_ALERTS = 4;
const VISIBLE_QUAKES = 3;

export default function LiveConditions({ liveData }: { liveData: LiveData }) {
  const quakes = liveData.earthquakes
    .slice()
    .sort((left, right) => right.magnitude - left.magnitude)
    .slice(0, VISIBLE_QUAKES);
  const alerts = liveData.alerts.slice(0, VISIBLE_ALERTS);
  const hiddenAlerts = liveData.alerts.length - alerts.length;
  const hiddenQuakes = liveData.earthquakes.length - quakes.length;

  return (
    <div className="live-conditions">
      <div className="source-list">
        {liveData.statuses.map((source) => (
          <div className="source-row" key={source.name}>
            <span className={`status-dot ${source.status}`} />
            <div>
              <strong>{source.name}</strong>
              <small>{source.detail}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="condition-grid">
        <Condition label="Power" value={powerSummary(liveData)} />
        <Condition label="Drought" value={droughtSummary(liveData)} />
      </div>

      {alerts.length ? (
        <div className="detail-block">
          <h3>Active alerts</h3>
          <div className="alert-list">
            {alerts.map((alert) => (
              <article className="alert-card" key={alert.id}>
                <div className="alert-title">
                  <strong>{alert.event}</strong>
                  <span className={`severity ${severityClass(alert.severity)}`}>{alert.severity}</span>
                </div>
                <p>{alert.headline}</p>
              </article>
            ))}
          </div>
          {hiddenAlerts > 0 ? <p className="detail-meta">{hiddenAlerts} more alerts</p> : null}
        </div>
      ) : null}

      {quakes.length ? (
        <div className="detail-block">
          <h3>Recent earthquakes</h3>
          <div className="quake-list">
            {quakes.map((quake) => (
              <article className="quake-card" key={quake.id}>
                <div className="alert-title">
                  <strong>M{quake.magnitude.toFixed(1)}</strong>
                  <span>{formatRelative(quake.time)}</span>
                </div>
                <QuakePlace quake={quake} />
              </article>
            ))}
          </div>
          {hiddenQuakes > 0 ? <p className="detail-meta">{hiddenQuakes} more events</p> : null}
        </div>
      ) : null}

      <p className="detail-meta">Checked {formatChecked(liveData.fetchedAt)}</p>
    </div>
  );
}

function Condition({ label, value }: { label: string; value: string }) {
  return (
    <div className="condition-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuakePlace({ quake }: { quake: EarthquakeEvent }) {
  if (!quake.url) {
    return <p>{quake.place}</p>;
  }

  return (
    <p>
      <a href={quake.url} target="_blank" rel="noreferrer">
        {quake.place}
      </a>
    </p>
  );
}

function powerSummary(liveData: LiveData): string {
  if (sourceFailed(liveData, "EAGLE-I outages")) {
    return "Unavailable";
  }

  return describePower(liveData.power);
}

function droughtSummary(liveData: LiveData): string {
  if (sourceFailed(liveData, "U.S. Drought Monitor")) {
    return "Unavailable";
  }

  return describeDrought(liveData.drought);
}

function sourceFailed(liveData: LiveData, name: string): boolean {
  return liveData.statuses.some((source) => source.name === name && source.status === "error");
}

function describePower(power?: PowerOutage): string {
  if (!power) {
    return "No county outage record";
  }

  const percent = power.percentOut ?? 0;
  const customers = power.customersOut ?? 0;
  if (percent <= 0 && customers <= 0) {
    return "No customers reported out";
  }

  const percentText = power.percentOut !== undefined ? `${formatPercent(power.percentOut)} out` : "Outage reported";
  const customerText =
    power.customersOut !== undefined ? `${formatCount(power.customersOut)} customers` : "";
  return [percentText, customerText].filter(Boolean).join(" · ");
}

function describeDrought(drought?: DroughtStatus): string {
  if (!drought) {
    return "No drought category here";
  }

  return drought.label;
}

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function severityClass(severity: string): string {
  switch (severity.toLowerCase()) {
    case "extreme":
    case "severe":
    case "moderate":
    case "minor":
      return severity.toLowerCase();
    default:
      return "unknown";
  }
}

function formatChecked(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const hours = Math.max(0, Math.round((Date.now() - date.getTime()) / 3_600_000));
  if (hours < 1) {
    return "Just now";
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
