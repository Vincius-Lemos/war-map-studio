import type { Scene } from './scene.ts';
import { normalizeScene } from './normalize.ts';
import { validateScene } from './validate.ts';

/* Extrai o objeto JSON de um texto qualquer: pega do primeiro "{" ao último "}",
   ignorando texto e tags em volta (ex.: <pasted_content>...</pasted_content>). */
export function extractJSON(text: string): unknown {
  const s = text.trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('não encontrei um objeto { ... } no texto');
  return JSON.parse(s.slice(a, b + 1));
}

export type ImportResult = { ok: true; scene: Scene } | { ok: false; errors: string[] };

/* Lê, valida e normaliza uma cena a partir de texto colado ou de um arquivo. */
export function importSceneText(text: string): ImportResult {
  let obj: unknown;
  try {
    obj = extractJSON(text);
  } catch (ex) {
    const msg = ex instanceof Error ? ex.message : String(ex);
    return {
      ok: false,
      errors: [`Não consegui ler o JSON: ${msg}.`, 'Cole o JSON completo, começando em { e terminando em }.'],
    };
  }
  const errors = validateScene(obj);
  if (errors.length) return { ok: false, errors };
  return { ok: true, scene: normalizeScene(obj as Partial<Scene>) };
}
