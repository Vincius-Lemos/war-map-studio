# MAP-DRAW — Tactical Map

[Leia em português](README.pt-BR.md) · [Credits and licenses](CREDITS.md)

A browser tool to draw military movements, advances, territorial control and battle animations on real maps, with a timeline, flags, historical maps by year, and video export (WebM/MP4 at 30 fps).

## Features

- **Map bases:** real country borders, OpenStreetMap streets for cities/ZIP codes, free canvas or your own image (calibrated to the map).
- **Flags:** each country shows its official flag; occupied states and provinces show the flag of the controlling force (or of an organization you add).
- **Regions:** states and provinces with control over time (not only whole countries).
- **Units:** palette with NATO (APP-6), Warsaw Pact, historical and block styles; drag to place; echelons from company to corps.
- **ORBAT tree:** drag units to subordinate them to a superior unit (cycles and cross-force parents are rejected).
- **Movement planning:** range by speed and hours, and shortest route on a hex grid, with estimated time.
- **Fog of war:** each force sees only what is near its own units.
- **Presentation mode:** walks through the events with camera and timeline in sync.
- **Grids:** latitude/longitude graticule, an approximate military reference grid (UTM 100 km with 10 km subdivisions), and a custom grid, with optional snapping.
- **Editing:** multi-selection, undo/redo (100 steps), copy/paste/duplicate, align and distribute, keyboard shortcuts (`?` opens the help).
- **Measuring and layers:** geodesic ruler with bearings, area tool, and a layers panel.
- **Historical maps:** choose a year and the matching border snapshot is loaded (nearest earlier snapshot when an exact year is not available).
- **Import/export:** scenes as JSON; "Create with AI" flow (copy instructions, paste the JSON back, validated before import).

## Repository layout

```
packages/shared/   scene contract and pure logic (validation, time, history, grids, movement, fog, ORBAT)
apps/web/          editor (React + Zustand + Vite, MapLibre GL + deck.gl)
apps/server/       Node API (Fastify): geographic data, scenes, export queue, static site
apps/export/       video exporter (Playwright + ffmpeg, 30 fps)
data/              build scripts that prepare country and region boundaries
```

## Requirements

- Node.js 20+ (22 LTS recommended)
- ffmpeg on the PATH (for video export)
- Chromium for Playwright (`npx playwright install chromium`)

## Getting started

```bash
npm install
npm test -w packages/shared          # shared logic tests
npm run build -w apps/web            # build the editor
npm run dev -w apps/web              # editor in development mode
npm start -w apps/server             # API and site (PORT, BASE_PATH, WEB_DIST, GEO_DIR, ... see apps/server/README.md)
npx tsx src/cli.ts scene.json --seconds 30 --format mp4 --out video.mp4 --base http://localhost:8787   # in apps/export
```

To regenerate the boundary files: `npm run build -w data`.

## Status

Working: the editor, grids, unit palette, ORBAT, movement planning, fog of war, presentation mode, flags, region control, undo/redo, JSON import/export, server API, and video export pipeline.

Known limitations:
- Military grid (MGRS-like) is an approximation, not the official standard.
- Some territories crossing the 180° meridian (e.g. Chukotka) do not get a flag.
- Historical maps use the nearest available snapshot, not the exact year.
- Video export depends on the browser and the server having Chromium and ffmpeg.

## Data and third-party credits

See [CREDITS.md](CREDITS.md) for every library, dataset, service and project that inspired this work, with their licenses. Map data: © OpenStreetMap contributors (ODbL). Boundary data: geoBoundaries (CC BY 4.0). Historical borders: aourednik/historical-basemaps (GPL-3.0), loaded at runtime from the original repository.

## License

Released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Contributions are welcome: open an issue or a pull request.

If you run a modified version on a server for others to use, the AGPL requires you to offer them that modified source code. Commercial licenses without these obligations are available on request.

The AGPL covers this project's code only. Third-party data keeps its own licenses (see [CREDITS.md](CREDITS.md)). No third-party code is copied from the inspiration projects; only ideas were taken from them.
