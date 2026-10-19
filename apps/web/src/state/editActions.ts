import {
  ALIGN_LABELS,
  alignUnitsAt,
  copyRefs,
  deleteRefs,
  moveRefs,
  pasteClip,
  posAt,
  type AlignMode,
  type ObjectRef,
  type Scene,
} from '@map-draw/shared';
import type { Selection } from './types.ts';
import type { Api } from './store.ts';
import { withHistoryKey } from './historyActions.ts';

/* Edição em lote: seleção múltipla, copiar/colar/duplicar, mover com o teclado e alinhar.
   Tudo passa pelo store, então entra no desfazer/refazer. */

export interface EditActions {
  /* Ctrl+clique: inclui ou tira o objeto da seleção. */
  toggleSelect(item: Selection): void;
  /* Shift+clique: acrescenta o objeto à seleção e o torna o foco. */
  addToSelection(item: Selection): void;
  selectAll(): void;
  copySelection(): void;
  pasteClipboard(): void;
  duplicateSelection(): void;
  /* Move a seleção (graus) no instante atual. Unidades sem posição neste instante não se movem. */
  nudgeSelection(dLat: number, dLon: number): void;
  alignSelection(mode: AlignMode): void;
}

export const isObjectSel = (s: Selection): s is Selection & { kind: 'unit' | 'arrow' | 'event' } =>
  s.kind === 'unit' || s.kind === 'arrow' || s.kind === 'event';

/* Referências dos objetos selecionados (países e regiões não entram em lote). */
export const objectRefs = (selected: readonly Selection[]): ObjectRef[] =>
  selected.filter(isObjectSel).map((s) => ({ kind: s.kind, id: s.id }));

const same = (a: Selection, b: Selection) => a.kind === b.kind && a.id === b.id;

/* Passo do teclado e da cola: fração do tamanho da área, com piso para áreas muito pequenas. */
export function stepFor(scene: Scene, fraction: number): number {
  const r = scene.region;
  const span = Math.max(r.lon1 - r.lon0, r.lat1 - r.lat0);
  return Math.max(span * fraction, 0.01);
}

export function createEditActions(api: Api): EditActions {
  const { setState: set, getState: get } = api;

  const setSel = (selected: Selection[], sel: Selection | null) => {
    set({ selected, sel, tab: sel ? 'sel' : get().tab });
  };

  return {
    toggleSelect(item) {
      const cur = get().selected;
      if (!isObjectSel(item)) {
        setSel([item], item);
        return;
      }
      if (cur.some((s) => same(s, item))) {
        const rest = cur.filter((s) => !same(s, item));
        setSel(rest, rest.at(-1) ?? null);
      } else {
        setSel([...cur, item], item);
      }
    },

    addToSelection(item) {
      const cur = get().selected;
      if (!isObjectSel(item)) {
        setSel([item], item);
        return;
      }
      const rest = cur.filter((s) => !same(s, item));
      setSel([...rest, item], item);
    },

    selectAll() {
      const s = get().scene;
      const all: Selection[] = [
        ...s.units.map((u) => ({ kind: 'unit' as const, id: u.id })),
        ...s.arrows.map((a) => ({ kind: 'arrow' as const, id: a.id })),
        ...s.events.map((e) => ({ kind: 'event' as const, id: e.id })),
      ];
      setSel(all, all.at(-1) ?? null);
    },

    copySelection() {
      const s = get();
      const refs = objectRefs(s.selected);
      if (refs.length === 0) {
        s.toast('Selecione unidades, setas ou eventos para copiar.', 'warn');
        return;
      }
      const clip = copyRefs(s.scene, refs);
      set({ clip, pasteCount: 0 });
      s.toast(`${refs.length} ${refs.length === 1 ? 'item copiado' : 'itens copiados'}.`, 'ok', 2000);
    },

    pasteClipboard() {
      const s = get();
      if (!s.clip) {
        s.toast('Nada copiado ainda.', 'warn');
        return;
      }
      const n = s.pasteCount + 1;
      const step = stepFor(s.scene, 0.03);
      const { scene, refs } = pasteClip(s.scene, s.clip, -step * n, step * n, newId);
      set({ scene, pasteCount: n });
      setSel(refs.map((r) => ({ kind: r.kind, id: r.id })), refs.at(-1) ?? null);
    },

    duplicateSelection() {
      const s = get();
      const refs = objectRefs(s.selected);
      if (refs.length === 0) {
        s.toast('Selecione unidades, setas ou eventos para duplicar.', 'warn');
        return;
      }
      const step = stepFor(s.scene, 0.03);
      const { scene, refs: copies } = pasteClip(s.scene, copyRefs(s.scene, refs), -step, step, newId);
      set({ scene });
      setSel(copies.map((r) => ({ kind: r.kind, id: r.id })), copies.at(-1) ?? null);
    },

    nudgeSelection(dLat, dLon) {
      const s = get();
      const refs = objectRefs(s.selected);
      if (refs.length === 0) return;
      const movable = refs.some((r) => {
        if (r.kind !== 'unit') return true;
        const u = s.scene.units.find((x) => x.id === r.id);
        return !!u && posAt(u.path, s.t) !== null;
      });
      if (!movable) {
        s.toast('As unidades selecionadas não têm posição neste instante.', 'warn');
        return;
      }
      const key = `nudge:${refs.map((r) => `${r.kind}:${r.id}`).join(',')}`;
      withHistoryKey(key, () => {
        set({ scene: moveRefs(s.scene, refs, s.t, dLat, dLon) });
      });
    },

    alignSelection(mode) {
      const s = get();
      const ids = objectRefs(s.selected).filter((r) => r.kind === 'unit').map((r) => r.id);
      const need = mode === 'dist-h' || mode === 'dist-v' ? 3 : 2;
      if (ids.length < need) {
        s.toast(`${ALIGN_LABELS[mode]}: selecione pelo menos ${need} unidades.`, 'warn');
        return;
      }
      const scene = alignUnitsAt(s.scene, s.t, ids, mode);
      if (scene === s.scene) {
        s.toast('As unidades selecionadas já estão alinhadas neste instante.', 'info');
        return;
      }
      set({ scene });
      s.toast(`${ALIGN_LABELS[mode]} (${ids.length} unidades, neste instante).`, 'ok', 2600);
    },
  };
}

/* Usado também pelo apagar em lote de sceneActions. */
export function deleteSelectionIn(scene: Scene, selected: readonly Selection[]): Scene {
  return deleteRefs(scene, objectRefs(selected));
}

let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;
