import { AFFIL_OPTIONS, ECHELON_LABELS, STYLE_OPTIONS, UNIT_TYPE_KEYS } from './constants.ts';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const label = (v: unknown, fallback: string): string => str(v) || fallback;

/* Valida a cena (já convertida de JSON) e devolve a lista de erros em português. Lista vazia = válida. */
export function validateScene(input: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(input)) return ['O conteúdo precisa ser um objeto { ... }.'];

  const factions = Array.isArray(input.factions) ? input.factions : [];
  if (factions.length === 0) errs.push('Falta a lista "factions" com pelo menos uma força.');
  const ids = new Set<string>();
  factions.forEach((raw, i) => {
    const f = isObj(raw) ? raw : {};
    const name = label(f.name, String(i + 1));
    if (!str(f.id) || !str(f.name)) errs.push(`Força ${i + 1}: precisa de "id" e "name".`);
    if (!/^#[0-9a-fA-F]{6}$/.test(str(f.color))) errs.push(`Força "${name}": "color" deve ser hex, por exemplo "#2e7d32".`);
    if (!AFFIL_OPTIONS.some(([k]) => k === f.affil)) {
      errs.push(`Força "${name}": "affil" deve ser friend, hostile, neutral ou unknown.`);
    }
    if (str(f.id)) ids.add(str(f.id));
  });
  const factionOk = (id: unknown) => typeof id === 'string' && ids.has(id);

  const region = input.region;
  if (!isObj(region) || !['lon0', 'lat0', 'lon1', 'lat1'].every((k) => isNum(region[k]))) {
    errs.push('"region" precisa de lon0, lat0, lon1 e lat1 (números).');
  }
  if (input.durationH !== undefined && !(isNum(input.durationH) && input.durationH > 0)) {
    errs.push('"durationH" deve ser um número maior que zero (horas).');
  }
  if (input.mapType !== undefined && !['country', 'tiles', 'free'].includes(str(input.mapType))) {
    errs.push('"mapType" deve ser country, tiles ou free.');
  }
  if (input.symbolStyle !== undefined && !STYLE_OPTIONS.some(([k]) => k === input.symbolStyle)) {
    errs.push('"symbolStyle" deve ser nato, pact, hist ou block.');
  }

  listOf(input.units).forEach((raw) => {
    const u = isObj(raw) ? raw : {};
    const n = label(u.name, label(u.id, '(sem nome)'));
    if (!str(u.id) || !str(u.name)) errs.push('Unidade sem "id" ou "name".');
    if (!factionOk(u.faction)) errs.push(`Unidade "${n}": a força "${str(u.faction)}" não existe em factions.`);
    if (!UNIT_TYPE_KEYS.includes(str(u.type) as (typeof UNIT_TYPE_KEYS)[number])) {
      errs.push(`Unidade "${n}": tipo "${str(u.type)}" inválido.`);
    }
    if (u.echelon !== undefined && !(str(u.echelon) in ECHELON_LABELS)) {
      errs.push(`Unidade "${n}": escalão "${str(u.echelon)}" inválido.`);
    }
    if (!Array.isArray(u.path) || u.path.length === 0) {
      errs.push(`Unidade "${n}": "path" precisa de pelo menos um ponto.`);
    } else {
      u.path.forEach((p: unknown, i: number) => {
        const pt = isObj(p) ? p : {};
        if (!isNum(pt.t) || !isNum(pt.lat) || !isNum(pt.lon)) {
          errs.push(`Unidade "${n}", ponto ${i + 1}: t, lat e lon devem ser números.`);
        }
      });
    }
  });

  listOf(input.arrows).forEach((raw, i) => {
    const a = isObj(raw) ? raw : {};
    const from = isObj(a.from) ? a.from : {};
    const to = isObj(a.to) ? a.to : {};
    if (!isNum(from.lat) || !isNum(from.lon) || !isNum(to.lat) || !isNum(to.lon)) {
      errs.push(`Seta ${i + 1}: "from" e "to" precisam de lat e lon.`);
    }
    if (!isNum(a.t0) || !isNum(a.t1)) errs.push(`Seta ${i + 1}: t0 e t1 devem ser números (horas).`);
    if (!factionOk(a.faction)) errs.push(`Seta ${i + 1}: a força "${str(a.faction)}" não existe.`);
  });

  listOf(input.events).forEach((raw, i) => {
    const e = isObj(raw) ? raw : {};
    if (!isNum(e.t) || !isNum(e.lat) || !isNum(e.lon)) errs.push(`Evento ${i + 1}: t, lat e lon devem ser números.`);
  });

  listOf(input.territories).forEach((raw, i) => {
    const t = isObj(raw) ? raw : {};
    if (!/^[A-Za-z]{2}$/.test(str(t.iso))) errs.push(`Território ${i + 1}: "iso" deve ter 2 letras, por exemplo "LT".`);
    if (!isNum(t.t)) errs.push(`Território ${i + 1}: t deve ser número.`);
    if (!factionOk(t.faction)) errs.push(`Território ${i + 1}: a força "${str(t.faction)}" não existe.`);
  });

  return errs;
}

function listOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
