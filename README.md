# Workspace Management

![Workspace Management social preview](assets/Preview3.jpg)

A single-page BBL prototype for furniture ordering, workspace planning, circular reuse, and building occupancy.

> [!CAUTION]
> This is an unofficial mockup for demonstration purposes only. All records are fictional, not every function is implemented, and it is not intended for production use.

## Demo

**Live demo:** https://bbl-dres.github.io/workspace-management/

**Floor-plan editor:** https://bbl-dres.github.io/workspace-management/floorplan-editor/index.html#/b-2011/b-2011-4

## Features

- Browse and search a furniture catalogue, open product details, and manage a cart.
- Find reusable furniture, inspect items, scan identifiers, and register items for circulation.
- Explore workspace-planning guidance, Multispace modules, examples, and CAD downloads.
- Navigate occupancy from country and canton through buildings, floors, rooms, and assets.
- Search addresses and switch between interactive basemaps.
- Measure spaces, place furniture, explore 3D terrain, and prepare print views.
- Edit floor plans in the dedicated browser-based editor.

## Run locally

The app fetches static JSON and GeoJSON files, so serve the repository over HTTP:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Design guide](docs/DESIGNGUIDE.md)
- [Data model](docs/DATAMODEL.md)

## License

No software license has been specified for this repository. Contact the repository owner before copying, modifying, or redistributing its contents.
