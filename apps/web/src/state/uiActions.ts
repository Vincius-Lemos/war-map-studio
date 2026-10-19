import { nextKeyframe, prevKeyframe } from '@map-draw/shared';
import type { CountryInfo, Dialog, InspectorTab, ModeId, Point, Selection, ToastKind, UiState } from './types.ts';
import type { Api } from './store.ts';

export interface UiActions {
  setMode(mode: ModeId): void;
  select(sel: Selection | null): void;
  setTab(tab: InspectorTab): void;
  setFilter(text: string): void;
  setSelFaction(id: string): void;
  setPaintLevel(level: UiState['paintLevel']): void;
  setPaintFlag(id: string | null): void;
  setPending(p: Point | null): void;
  setCountries(list: CountryInfo[]): void;
  setDragFac(id: string | null): void;
  toast(msg: string, kind?: ToastKind, ms?: number): void;
  openDialog(d: Exclude<Dialog, null>): void;
  closeDialog(): void;
  setT(t: number): void;
  togglePlay(): void;
  setSpeed(v: number): void;
  jumpKey(dir: 1 | -1): void;
  requestFit(): void;
  pause(): void;
  setExporting(on: boolean, status: string): void;
}

let toastSeq = 0;

export function createUiActions(api: Api): UiActions {
  const { setState: set, getState: get } = api;
  const clampT = (v: number) => Math.min(Math.max(v, 0), get().scene.durationH);

  return {
    setMode: (mode) => set({ mode, pending: null }),
    select: (sel) => set({ sel, selected: sel ? [sel] : [], tab: sel ? 'sel' : get().tab }),
    setTab: (tab) => set({ tab }),
    setFilter: (filter) => set({ filter }),
    setSelFaction: (selFaction) => set({ selFaction }),
    setPaintLevel: (paintLevel) => set({ paintLevel }),
    setPaintFlag: (paintFlag) => set({ paintFlag }),
    setPending: (pending) => set({ pending }),
    setCountries: (countries) => set({ countries }),
    setDragFac: (dragFac) => set({ dragFac }),

    toast(msg, kind = 'info', ms = 3400) {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts, { id, msg, kind, out: false }] });
      setTimeout(() => set({ toasts: get().toasts.map((x) => (x.id === id ? { ...x, out: true } : x)) }), ms);
      setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), ms + 400);
    },

    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null }),

    setT: (t) => set({ t: clampT(t) }),
    togglePlay() {
      const s = get();
      if (!s.playing && s.t >= s.scene.durationH) set({ t: 0, playing: true });
      else set({ playing: !s.playing });
    },
    setSpeed: (speed) => set({ speed }),
    jumpKey(dir) {
      const s = get();
      const target = dir > 0 ? nextKeyframe(s.scene, s.t) : prevKeyframe(s.scene, s.t);
      if (target !== undefined) set({ t: target });
    },
    requestFit: () => set({ fitNonce: get().fitNonce + 1 }),
    pause: () => set({ playing: false }),
    setExporting: (exporting, exportStatus) => set({ exporting, exportStatus }),
  };
}
