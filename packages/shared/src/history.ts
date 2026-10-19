/* Instantâneos históricos disponíveis (aourednik/historical-basemaps).
   Um ano pedido usa o instantâneo mais próximo anterior. */
export const HIST_YEARS: readonly number[] = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492,
  1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920,
  1930, 1938, 1945, 1960, 1994, 2000, 2010,
];

export function histYearFor(year: number): number {
  let best = HIST_YEARS[0] ?? year;
  for (const h of HIST_YEARS) if (h <= year) best = h;
  return best;
}

/* ---------- histórico de desfazer / refazer ----------
   Pilhas de estados imutáveis. Cada entrada de `past` guarda o estado ANTERIOR a uma alteração;
   `future` guarda os estados desfeitos (o mais recente primeiro). Alterações contínuas com a mesma
   chave (ex.: arrastar uma unidade) dentro de COALESCE_MS viram uma única entrada. */

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export interface HistoryEntry<T> {
  readonly value: T;
  readonly key?: string;
  readonly at: number;
}

export interface History<T> {
  readonly past: readonly HistoryEntry<T>[];
  readonly future: readonly T[];
}

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

export interface RecordOptions {
  key?: string;
  now: number;
  limit?: number;
  /* true: esta alteração abre uma entrada nova mesmo que a anterior tenha a mesma chave
     (início de um novo arrasto, por exemplo). As seguintes podem agrupar-se a ela. */
  noMerge?: boolean;
}

/* Registra uma alteração. `before` é o estado antes dela. Qualquer alteração nova apaga o refazer. */
export function recordChange<T>(h: History<T>, before: T, opts: RecordOptions): History<T> {
  const limit = opts.limit ?? HISTORY_LIMIT;
  const top = h.past[h.past.length - 1];
  const mergeable = !opts.noMerge && opts.key !== undefined && top !== undefined && top.key === opts.key;
  if (mergeable && opts.now - top.at <= COALESCE_MS) {
    return { past: [...h.past.slice(0, -1), { value: top.value, key: top.key, at: opts.now }], future: [] };
  }
  const past = [...h.past, { value: before, key: opts.key, at: opts.now }].slice(-limit);
  return { past, future: [] };
}

/* Desfaz um passo. `current` é o estado atual (vai para o refazer). Devolve null se não há o que desfazer. */
export function undoStep<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  const top = h.past[h.past.length - 1];
  if (!top) return null;
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future] }, value: top.value };
}

/* Refaz um passo. `current` é o estado atual (volta para o desfazer). */
export function redoStep<T>(h: History<T>, current: T, now: number, limit = HISTORY_LIMIT): { history: History<T>; value: T } | null {
  if (h.future.length === 0) return null;
  const [next, ...rest] = h.future as [T, ...T[]];
  const past = [...h.past, { value: current, at: now }].slice(-limit);
  return { history: { past, future: rest }, value: next as T };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;
