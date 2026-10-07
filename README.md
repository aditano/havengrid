# HavenGrid

HavenGrid is a browser app for exploring U.S. county resilience. Choose a county and a scenario, and it combines FEMA National Risk Index scores with live public hazard feeds and household preparedness assumptions to produce a continuity score.

The live site is [https://aditano.github.io/havengrid/](https://aditano.github.io/havengrid/).

## Features

- Interactive map of U.S. counties, colored by the continuity score for the selected scenario and preparedness settings.
- Choose a county by clicking the map, searching by county name, state, or five-digit FIPS code, or picking a county from the best and worst lists.
- Scenarios: all risks, nuclear strike, wildfire, flooding, earthquake, major storm, power outage, food shortage, and drought.
- Nuclear scenario with public reference yields, a separate ground-zero pin, wind direction, and approximate blast and fallout rings. That modeled distance is included in the selected county's score.
- Live checks for the selected location: National Weather Service alerts, EAGLE-I power outages, the current U.S. Drought Monitor category, and USGS earthquakes within 250 km over the past 30 days. When the outage feed requires an access token, the panel says so.
- Household preparedness controls for stored food, stored water, backup power, and an evacuation plan. Those choices are saved in this browser.
- The five highest and five lowest modeled counties for the active scenario.

The nuclear rings are an educational approximation based on public yield scaling. For an actual emergency, follow instructions from local authorities.

## Run locally

The GitHub Actions deploy workflow uses Node.js 22. From the repository root:

```bash
npm install
npm run dev
```

Vite prints a local URL. Open the app at [http://127.0.0.1:5173/havengrid/](http://127.0.0.1:5173/havengrid/). The `/havengrid/` base path matches the GitHub Pages site.

Other commands:

```bash
npm test
npm run build
npm run preview
```

`npm test` runs the Vitest suite. `npm run build` typechecks and writes the production site to `dist/`. `npm run preview` serves that build on `127.0.0.1`. Pushes to `main` run the tests, build the site, and deploy it to GitHub Pages.

## Tech stack

- React 18 and TypeScript
- Vite 6
- Leaflet, React Leaflet, and Esri Leaflet for the map
- Lucide React for icons
- Vitest for tests
- GitHub Actions for the GitHub Pages deploy

## Public data

- FEMA National Risk Index county layer: natural hazard risk, social vulnerability, and community resilience.
- FEMA EAGLE-I power outage layer: customers reported out, by county.
- NOAA National Weather Service active alerts API.
- USGS Earthquake Hazards Program event feed.
- U.S. Drought Monitor through the FEMA drought map service.

## License

Copyright (C) 2026 Anthony DiTano.

HavenGrid is free software under the GNU General Public License version 3, or any later version (`GPL-3.0-or-later`). The full license text is in [LICENSE](LICENSE).

Third-party assets and code keep their own licenses. Those exceptions are:

| Component | License |
| --- | --- |
| Leaflet | BSD-2-Clause |
| React Leaflet | Hippocratic License 2.1 |
| Esri Leaflet | Apache License 2.0 |
| React and React DOM | MIT License |
| Lucide React | ISC License |
| Vite, Vitest, and @vitejs/plugin-react | MIT License |
| TypeScript | Apache License 2.0 |
| @types/leaflet, @types/react, and @types/react-dom | MIT License |
| OpenStreetMap map tiles | [Open Database License (ODbL)](https://www.openstreetmap.org/copyright) |

Public data from FEMA, NOAA, USGS, and the U.S. Drought Monitor remains under those providers' terms.
