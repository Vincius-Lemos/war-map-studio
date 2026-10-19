# Credits and licenses

This file lists everything MAP-DRAW uses (libraries, data, services) and the projects whose **ideas** inspired parts of it. Unless stated otherwise, no code from the inspiration projects was copied.

## Libraries used

| Library | Used for | License |
|---|---|---|
| [milsymbol](https://github.com/spatialillusions/milsymbol) | NATO/APP-6 military unit symbols | MIT |
| [MapLibre GL JS](https://maplibre.org) | base map rendering | BSD-3-Clause |
| [deck.gl](https://deck.gl) (`@deck.gl/core`, `layers`, `mapbox`, `extensions`) | WebGL layers (countries, flags, regions, units, arrows, grids, fog) | MIT |
| [React](https://react.dev) | editor interface | MIT |
| [Zustand](https://github.com/pmndrs/zustand) | state management | MIT |
| [Vite](https://vitejs.dev) | build tool | MIT |
| [Fastify](https://fastify.dev) and plugins | API server | MIT |
| [Playwright](https://playwright.dev) | headless browser for video export | Apache-2.0 |
| [ffmpeg](https://ffmpeg.org) | video encoding (WebM/MP4) | LGPL/GPL (depends on build) |
| [d3-geo](https://github.com/d3/d3-geo), [topojson-client](https://github.com/topojson/topojson-client), [topojson-simplify](https://github.com/topojson/topojson-simplify) | geometry, projections, simplification | ISC |
| [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) | ISO 3166 country codes | MIT |
| [world-atlas](https://github.com/topojson/world-atlas) | world country geometry (Natural Earth) | ISC (Natural Earth data: public domain) |
| [tsx](https://github.com/privatenumber/tsx), [TypeScript](https://www.typescriptlang.org) | running and typing TypeScript | MIT / Apache-2.0 |

## Data and services

| Source | Used for | License / terms |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | street tiles in city mode | © OpenStreetMap contributors, ODbL. Attribution is shown on the map. |
| [Nominatim](https://nominatim.org) | address and city search | OSMF usage policy; OSM data, ODbL |
| [ViaCEP](https://viacep.com.br) | Brazilian ZIP code (CEP) lookup | free public service; terms of use apply |
| [flagcdn.com](https://flagcdn.com) | country flag images (SVG) | flags are public-domain state symbols; service terms apply |
| [geoBoundaries](https://www.geoboundaries.org) (gbOpen, release 9469f09) | first-level regions (states, provinces) | CC BY 4.0. Attribution required: "geoBoundaries (wmgeolab), CC BY 4.0". |
| [datasets/geo-countries](https://github.com/datasets/geo-countries) | country boundaries (prepared in `data/`) | MIT |
| [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) | historical border snapshots (loaded at runtime) | GPL-3.0 (data repository). Not copied into this project. |

## Projects that inspired ideas

Only the **ideas** were studied. Code was written from scratch. Licenses are listed so the origin is clear.

| Project | Idea taken | License |
|---|---|---|
| [orbat-mapper](https://github.com/orbat-mapper/orbat-mapper) | units arranged as an order-of-battle tree with drag and drop (ORBAT) | MIT |
| [pistell/MGRS-Mapper](https://github.com/pistell/MGRS-Mapper) | dragging NATO symbols onto a map; MGRS overlay | MIT |
| [GirkovArpa/google-maps-military-mission-editor](https://github.com/GirkovArpa/google-maps-military-mission-editor) | mission planning on a map, inspired by map.army | MIT |
| [cayk-cyber/WargameMapTool](https://github.com/cayk-cyber/WargameMapTool) | layer-based map editor with hex grids and asset library | GPL-3.0 (ideas only) |
| [jeremyz/godot-hexgrid](https://github.com/jeremyz/godot-hexgrid) | distance, adjacency, reachable area and shortest path on hexes | Copyright 2020 (see repo) |
| [yiyuezhuo/Hex-Wargame-JavaScript](https://github.com/yiyuezhuo/Hex-Wargame-JavaScript) | scenarios stored as files for a hex wargame | MIT |
| [yiyuezhuo/MapEditorTool](https://github.com/yiyuezhuo/MapEditorTool) | editing area membership from a colour-coded province map | MIT |
| [zachlevy/history-mapped](https://github.com/zachlevy/history-mapped) | battles on a timeline together with a map | no license file |
| [hreikin/interactive-campaign-map](https://github.com/hreikin/interactive-campaign-map) | layer filter and popups on a campaign map | MIT |
| [jetelain/Arma3TacMap](https://github.com/jetelain/Arma3TacMap) | planning tools for missions in the browser | MIT |
| [NoblerWorks-HQ/WarGames](https://github.com/NoblerWorks-HQ/WarGames) | geopolitical simulation dashboard ideas | MIT |
| [wgnet/globalmap](https://github.com/wgnet/globalmap) | pipeline that turns OpenStreetMap data into game maps | no license file |
| [StackFrame/Ortelium](https://github.com/StackFrame/Ortelium) | generating military map symbols | no license file |
| [huayuxingtguiyujing/WarGameMap](https://github.com/huayuxingtguiyujing/WarGameMap) | fog of war and territory control ideas (Unity package) | no license file |
| [Pr1nted/Open-Doctrines](https://github.com/Pr1nted/Open-Doctrines) | province and control ideas for grand strategy | OpenDoctrines Non-Commercial License (ideas only) |
| [jamalrfordii-arch/Vanguard-Map](https://github.com/jamalrfordii-arch/Vanguard-Map) | cinematic camera on a tactical map | all rights reserved (ideas only) |
| [mrlancelot/MapYoutubeVideos](https://github.com/mrlancelot/MapYoutubeVideos) | historical map animations for video | no license file |

## Thanks

To the authors and maintainers of every project above, and to the OpenStreetMap, Natural Earth, geoBoundaries and Wikimedia communities that keep open geographic data available.
