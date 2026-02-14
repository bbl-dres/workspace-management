# BBL Workspace Management

A single-page application (SPA) prototype for the Swiss Federal Office for Buildings and Logistics (BBL). It manages workspace infrastructure — furniture ordering, office planning, circular economy, and building occupancy — for the Swiss Federal Administration.

<p align="center">
  <img src="assets/Preview1.jpg" width="45%" style="vertical-align: top;"/>
  <img src="assets/Preview2.jpg" width="45%" style="vertical-align: top;"/>
</p>

## Tech Stack

- **Vanilla HTML / CSS / JavaScript** — no frameworks or build tools
- **Mapbox GL JS** for interactive building maps with Swisstopo address search
- **Hash-based routing** (`#/shop`, `#/occupancy/building-id`, etc.)
- **Static JSON data** in `data/` — no backend required

## Modules

| Route | Module | Description |
|---|---|---|
| `#/shop` | Product Catalog | Hierarchical category tree, search, sort, product detail pages |
| `#/circular` | Circular Economy | Browse & register used furniture for reuse |
| `#/planning` | Workspace Planning | Style worlds, planning examples, CAD downloads |
| `#/occupancy` | Occupancy Planning | Spatial tree (Country > Canton > Building > Floor), interactive Mapbox map with building markers, metrics tables |

## Map Features

The occupancy map includes:

- **Navigation controls** (zoom, home, 3D toggle) — right side, vertically centered
- **Address search** — click-to-expand input (Swisstopo geocoding API)
- **Background switcher** — Light, Standard, Aerial, Hybrid (bottom-right)
- **Scale bar** (bottom-left)
- **Persistent map style** via URL parameter (`?bg=satellite-v9`)
- Map survives selection changes (pan/zoom only, no reload)

## Project Structure

```
index.html          Single entry point
css/
  tokens.css        Design tokens (colors, spacing, typography)
  style.css         All component styles
js/
  app.js            Application logic, routing, rendering
data/
  products.json     Furniture catalog
  buildings.json    Building metadata + floor hierarchy
  buildings.geojson Building coordinates for map
  furniture-items.json  Circular economy items
  sites.json        Site/canton groupings
  floors.json       Floor details with room lists
  stilwelten.json   Style world inspirations
  planungsbeispiele.json  Planning examples
  cad-sections.json CAD download sections
  categories.json   Product category tree
docs/
  REQUIREMENTS.md   Functional requirements (German)
  DESIGNGUIDE.md    Design system guide
  DATAMODEL.md      Data model documentation
```

## Running

Open `index.html` in a browser. No build step required.

A Mapbox access token is embedded for the prototype. For production use, replace it with a restricted token.

## Design System

Follows the modern Swiss Confederation Corporate Design (CD Bund) with the Noto Sans typeface. See [DESIGNGUIDE.md](docs/DESIGNGUIDE.md) for details.
