# HavenGrid

HavenGrid is an interactive U.S. preparedness simulator. Pick a county, choose a scenario, and it blends public hazard data with local resilience indicators to show a continuity score, live warnings, best and worst counties, and map-based risk heat layers.

## What it does

- Shows an interactive U.S. map with county-level heat coloring.
- Lets you select a location by clicking a county, searching by name or FIPS code, or choosing a county from the best and worst lists.
- Simulates scenario families: nuclear blast exposure, natural disasters, power outages, food supply stress, drought, earthquake, wildfire, flood, and storm systems.
- Draws approximate nuclear blast zones for several public-yield reference devices, and folds that modeled distance into the selected county's continuity score.
- Pulls live or recently updated public data from free sources where browser-accessible feeds are available, including alert headlines, outage totals, drought category, and recent earthquakes.
- Adds household preparedness controls so the selected-location score reflects the scenario and your readiness assumptions. The preparedness controls are remembered in this browser.

## Public data sources

- FEMA National Risk Index county feature layer: natural hazard risk, social vulnerability, and community resilience.
- FEMA/EAGLE-I power outage feature layer: county-level reported customers out, updated hourly when the source is available.
- NOAA/National Weather Service active alerts API: current watches, warnings, advisories, and emergency alerts at the selected point.
- USGS Earthquake Hazards Program GeoJSON feeds: recent earthquake events around the selected point.
- U.S. Drought Monitor via FEMA map service: current drought categories.

The nuclear blast visualization is an educational approximation based on public yield scaling relationships. It is not emergency guidance, targeting analysis, or a substitute for official instructions.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal.

## GitHub Pages

Pushes to `main` deploy through GitHub Actions. The production site is built with the `/havengrid/` base path for GitHub Pages.
