import type { Scene } from '@map-draw/shared';

/* Cena de exemplo, mostrada quando não há cena salva. */
export const DEMO_SCENE: Scene = {
  title: 'Exemplo: avanço sobre a Lituânia',
  startDate: '2026-03-01T06:00',
  durationH: 72,
  year: null,
  mapType: 'country',
  region: { lon0: 19, lat0: 53.4, lon1: 28.2, lat1: 57.6 },
  symbolStyle: 'nato',
  unitSize: 1,
  showLabels: true,
  showTrails: true,
  showAllFlags: true,
  factions: [
    { id: 'f1', name: 'Exército Verde', color: '#2e7d32', affil: 'hostile' },
    { id: 'f2', name: 'Exército Azul', color: '#1565c0', affil: 'friend' },
  ],
  territories: [
    { iso: 'LT', name: 'Lituânia', t: 0, faction: 'f2' },
    { iso: 'LV', name: 'Letônia', t: 0, faction: 'f2' },
    { iso: 'PL', name: 'Polônia', t: 0, faction: 'f2' },
    { iso: 'LT', name: 'Lituânia', t: 30, faction: 'f1' },
  ],
  units: [
    { id: 'u1', name: '1ª Div. Blindada', faction: 'f1', type: 'arm', echelon: 'div', note: '', path: [
      { t: 0, lat: 53.9, lon: 27.0 }, { t: 18, lat: 55.2, lon: 25.5 }, { t: 30, lat: 55.7, lon: 24.3 },
    ] },
    { id: 'u2', name: 'Div. Motorizada', faction: 'f1', type: 'motor', echelon: 'div', note: '', path: [
      { t: 6, lat: 52.9, lon: 24.0 }, { t: 28, lat: 54.7, lon: 23.9 },
    ] },
    { id: 'u3', name: '3º Reg. Cavalaria', faction: 'f1', type: 'cav', echelon: 'reg', note: '', path: [
      { t: 10, lat: 54.1, lon: 27.5 }, { t: 34, lat: 55.9, lon: 23.5 },
    ] },
    { id: 'u4', name: 'Fortificações Kaunas', faction: 'f2', type: 'fort', echelon: 'bde', note: '', path: [
      { t: 0, lat: 54.9, lon: 23.9 },
    ] },
    { id: 'u5', name: '2º Gr. Artilharia', faction: 'f2', type: 'art', echelon: 'bn', note: '', path: [
      { t: 0, lat: 55.2, lon: 24.6 },
    ] },
  ],
  arrows: [{ id: 'a1', from: { lat: 54.0, lon: 27.3 }, to: { lat: 55.4, lon: 24.6 }, t0: 18, t1: 30, kind: 'attack', faction: 'f1' }],
  events: [{ id: 'e1', t: 30, lat: 55.7, lon: 24.3, kind: 'attack', text: 'Travessia da ponte', dur: 3 }],
  orgFlags: [],
  overlay: null,
};
