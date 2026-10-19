import { canRedo, canUndo, emptyHistory, recordChange, redoStep, undoStep, type History, type Scene } from '@map-draw/shared';
import type { Api } from './store.ts';
import type { Selection } from './types.ts';

/* Desfazer e refazer da cena. Toda troca de `scene` no store é registrada automaticamente
   (pelo assinante abaixo), inclusive as que vêm de formulários e do mapa. As ações contínuas
   (arrastar, digitar, setas) passam uma chave com withHistoryKey: alterações com a mesma chave
   seguidas dentro da janela de agrupamento viram uma só entrada. */

export interface HistoryActions {
  undo(): void;
  redo(): void;
  /* Encerra a sequência contínua atual (ex.: soltar o arrastar): a próxima alteração vira entrada nova. */
  breakHistory(): void;
}

let pendingKey: string | undefined;
let breakNext = false;

/* Executa fn marcando as alterações de scene feitas dentro dela com a chave de agrupamento. */
export function withHistoryKey(key: string | undefined, fn: () => void): void {
  const prev = pendingKey;
  pendingKey = key;
  try {
    fn();
  } finally {
    pendingKey = prev;
  }
}

const isObject = (s: Selection) => s.kind === 'unit' || s.kind === 'arrow' || s.kind === 'event';

/* Mantém a seleção coerente com a cena: ao desfazer um "colar", por exemplo, o objeto colado some. */
function selectionFor(scene: Scene, selected: readonly Selection[], sel: Selection | null): { selected: Selection[]; sel: Selection | null } {
  const present = new Set<string>([
    ...scene.units.map((u) => `unit:${u.id}`),
    ...scene.arrows.map((a) => `arrow:${a.id}`),
    ...scene.events.map((e) => `event:${e.id}`),
  ]);
  const alive = (s: Selection) => !isObject(s) || present.has(`${s.kind}:${s.id}`);
  const nextSelected = selected.filter(alive);
  const nextSel = sel && alive(sel) ? sel : (nextSelected.at(-1) ?? null);
  return { selected: nextSelected, sel: nextSel };
}

export function createHistoryActions(api: Api): HistoryActions {
  const { setState: set, getState: get } = api;
  let hist: History<Scene> = emptyHistory<Scene>();
  let applying = false;

  const syncFlags = () => {
    const canU = canUndo(hist);
    const canR = canRedo(hist);
    if (get().canUndo !== canU || get().canRedo !== canR) set({ canUndo: canU, canRedo: canR });
  };

  /* Cada troca de cena (que não seja desfazer/refazer) vira um passo do histórico. */
  api.subscribe((s, p) => {
    if (applying || s.scene === p.scene) return;
    const noMerge = breakNext;
    breakNext = false;
    hist = recordChange(hist, p.scene, { key: pendingKey, now: Date.now(), noMerge });
    syncFlags();
  });

  const restore = (value: Scene, next: History<Scene>) => {
    hist = next;
    applying = true;
    try {
      const cur = get();
      set({ scene: value, ...selectionFor(value, cur.selected, cur.sel) });
    } finally {
      applying = false;
    }
    syncFlags();
  };

  return {
    undo() {
      const r = undoStep(hist, get().scene);
      if (r) restore(r.value, r.history);
    },
    redo() {
      const r = redoStep(hist, get().scene, Date.now());
      if (r) restore(r.value, r.history);
    },
    breakHistory() {
      breakNext = true;
    },
  };
}
