import type { Scene } from '../../../packages/shared/src/scene.js';

export type SceneValidation = { ok: true; scene: Scene } | { ok: false; errors: string[] };

/**
 * Validação da cena.
 *
 * Usa `validateScene` de packages/shared/src/validate.ts (contrato real: recebe o objeto e
 * devolve a lista de erros em português; lista vazia = válida). O import é feito por caminho
 * relativo e carregado sob demanda para o servidor subir mesmo se o arquivo sumir.
 *
 * STUB: se o arquivo não existir, vale `minimalValidate`, que só confere a forma geral.
 */
const SHARED_VALIDATE_URL = new URL('../../../packages/shared/src/validate.ts', import.meta.url).href;

type SharedValidate = (input: unknown) => unknown;
let sharedPromise: Promise<SharedValidate | null> | null = null;

function loadShared(): Promise<SharedValidate | null> {
  sharedPromise ??= import(SHARED_VALIDATE_URL)
    .then((m: { validateScene?: SharedValidate }) => (typeof m.validateScene === 'function' ? m.validateScene : null))
    .catch(() => null); // arquivo ausente: usa o stub
  return sharedPromise;
}

const MAP_TYPES = ['country', 'tiles', 'free'];
const SYMBOL_STYLES = ['nato', 'pact', 'hist', 'block'];
const ARRAY_FIELDS = ['factions', 'units', 'arrows', 'events', 'territories', 'orgFlags'] as const;

/** STUB: confere apenas a forma geral da cena. Não substitui a validação completa do shared. */
export function minimalValidate(input: unknown): SceneValidation {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['a cena deve ser um objeto'] };
  }
  const s = input as Record<string, unknown>;
  if (typeof s.title !== 'string' || s.title.length > 200) errors.push('title deve ser texto de até 200 caracteres');
  if (typeof s.durationH !== 'number' || !(s.durationH >= 0)) errors.push('durationH deve ser número >= 0');
  if (typeof s.mapType !== 'string' || !MAP_TYPES.includes(s.mapType)) errors.push('mapType inválido');
  if (typeof s.symbolStyle !== 'string' || !SYMBOL_STYLES.includes(s.symbolStyle)) errors.push('symbolStyle inválido');
  const r = s.region as Record<string, unknown> | undefined;
  if (!r || ['lon0', 'lat0', 'lon1', 'lat1'].some((k) => typeof r[k] !== 'number')) {
    errors.push('region deve ter lon0, lat0, lon1 e lat1 numéricos');
  }
  for (const f of ARRAY_FIELDS) {
    if (!Array.isArray(s[f])) errors.push(`${f} deve ser uma lista`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, scene: input as Scene };
}

export async function validateScene(input: unknown): Promise<SceneValidation> {
  const shared = await loadShared();
  if (!shared) return minimalValidate(input);
  const result = await shared(input);
  if (!Array.isArray(result)) return minimalValidate(input);
  if (result.length === 0) return { ok: true, scene: input as Scene };
  return { ok: false, errors: result.map(String).slice(0, 20) };
}
