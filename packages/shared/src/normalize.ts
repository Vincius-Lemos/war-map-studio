import type { Faction, Scene, Territory, Unit } from './scene.ts';

export function defaultFactions(): Faction[] {
  return [
    { id: 'f1', name: 'Força 1', color: '#2e7d32', affil: 'hostile' },
    { id: 'f2', name: 'Força 2', color: '#1565c0', affil: 'friend' },
  ];
}

/* Códigos antigos (numéricos) gravados por versões anteriores -> ISO alfa-2. */
const LEGACY_ISO: Record<string, string> = {
  '440': 'LT', '428': 'LV', '616': 'PL', '112': 'BY', '233': 'EE', '643': 'RU',
  '804': 'UA', '276': 'DE', '250': 'FR', '076': 'BR', '032': 'AR', '858': 'UY',
};

export function sortPath<T extends { t: number }>(path: readonly T[]): T[] {
  return [...path].sort((a, b) => a.t - b.t);
}

/* Completa uma cena vinda de JSON (já validada) com os valores padrão. Não altera o objeto de entrada. */
export function normalizeScene(input: Partial<Scene>): Scene {
  const region = input.region ?? { lon0: -5, lat0: -5, lon1: 5, lat1: 5 };
  const factions = Array.isArray(input.factions) && input.factions.length ? input.factions : defaultFactions();
  const units: Unit[] = (input.units ?? []).map((u) => ({
    ...u,
    note: u.note ?? '',
    echelon: u.echelon ?? '',
    path: sortPath(u.path ?? []),
  }));
  const territories: Territory[] = (input.territories ?? []).map((t) => {
    const legacy = LEGACY_ISO[t.iso];
    return legacy ? { ...t, iso: legacy } : { ...t };
  });
  const durationH = typeof input.durationH === 'number' && input.durationH > 0 ? input.durationH : 72;
  return {
    title: input.title ?? 'Nova cena',
    startDate: input.startDate ?? '',
    durationH,
    year: typeof input.year === 'number' ? input.year : null,
    mapType: input.mapType ?? (region.lon1 - region.lon0 < 2.5 ? 'tiles' : 'country'),
    region: { ...region },
    symbolStyle: input.symbolStyle ?? 'nato',
    unitSize: input.unitSize ?? 1,
    showLabels: input.showLabels ?? true,
    showTrails: input.showTrails ?? true,
    showAllFlags: input.showAllFlags !== false,
    factions: factions.map((f) => ({ ...f })),
    units,
    arrows: (input.arrows ?? []).map((a) => ({ ...a })),
    events: (input.events ?? []).map((e) => ({ ...e })),
    territories,
    orgFlags: input.orgFlags ?? [],
    overlay: input.overlay ?? null,
  };
}
