import { useId, useMemo, useState } from "react";
import type { CountyAttributes } from "../data/sources";
import { countyName } from "../lib/score";
import { searchCounties } from "../lib/search";

type CountySearchProps = {
  counties: CountyAttributes[];
  countyLoadError: string | null;
  locatingFips: string | null;
  error: string | null;
  onSelect: (county: CountyAttributes) => void;
};

export default function CountySearch({
  counties,
  countyLoadError,
  locatingFips,
  error,
  onSelect,
}: CountySearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const results = useMemo(() => searchCounties(counties, query), [counties, query]);
  const open = query.trim().length >= 2;
  const highlightedIndex = results.length ? activeIndex % results.length : 0;
  const activeResult = results[highlightedIndex];

  return (
    <div className="county-search">
      <label className="field-label" htmlFor="county-search">
        Find a county
      </label>
      <input
        id="county-search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeResult?.STCOFIPS ? `${listId}-${activeResult.STCOFIPS}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={
          counties.length
            ? "County, state, or FIPS"
            : countyLoadError
              ? "Counties unavailable"
              : "Loading counties"
        }
        disabled={!counties.length}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) =>
              results.length ? (current - 1 + results.length) % results.length : 0,
            );
          } else if (event.key === "Enter" && activeResult) {
            event.preventDefault();
            onSelect(activeResult);
            setQuery("");
          } else if (event.key === "Escape") {
            setQuery("");
          }
        }}
      />
      {open ? (
        <ul className="search-results" id={listId} role="listbox">
          {results.length ? (
            results.map((county, index) => {
              const fips = county.STCOFIPS ?? String(index);
              const locating = locatingFips === county.STCOFIPS;
              return (
                <li key={fips}>
                  <button
                    id={`${listId}-${fips}`}
                    className={`search-result ${index === highlightedIndex ? "active" : ""}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === highlightedIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onSelect(county);
                      setQuery("");
                    }}
                  >
                    <span>{countyName(county)}</span>
                    <strong>{locating ? "Locating" : county.STCOFIPS}</strong>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="search-empty">
              {counties.length ? "No matching counties" : countyLoadError ?? "County list is still loading"}
            </li>
          )}
        </ul>
      ) : null}
      {locatingFips && !open ? <p className="field-note">Locating that county on the map.</p> : null}
      {error ? (
        <p className="field-note search-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
