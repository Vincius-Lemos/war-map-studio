import type { Clip, Scene } from '@map-draw/shared';

export type ModeId = 'select' | 'move' | 'paint' | 'arrow' | 'event' | 'calib';
export type SelKind = 'unit' | 'arrow' | 'event' | 'country';
export interface Selection {
  kind: SelKind;
  id: string;
}
export interface Point {
  lat: number;
  lon: number;
}
export type Dialog = 'wiz' | 'ai' | 'export' | 'help' | null;
export type ToastKind = 'info' | 'ok' | 'warn' | 'err';
export interface Toast {
  id: number;
  msg: string;
  kind: ToastKind;
  out: boolean;
}
export interface CountryInfo {
  iso: string;
  name: string;
  iso3: string;
}
export type PaintLevel = 'country' | 'region';
export type InspectorTab = 'sel' | 'scene';

export interface UiState {
  scene: Scene;
  t: number;
  playing: boolean;
  speed: number;
  mode: ModeId;
  /* Objeto em foco (o último clicado; é ele que o inspetor mostra e que recebe o anel no mapa). */
  sel: Selection | null;
  /* Seleção completa (unidades, setas, eventos e o próprio `sel`). Vazia se nada está selecionado. */
  selected: Selection[];
  /* Conteúdo copiado (Ctrl+C) e quantas vezes já foi colado, para deslocar cada cola. */
  clip: Clip | null;
  pasteCount: number;
  canUndo: boolean;
  canRedo: boolean;
  pending: Point | null;
  tab: InspectorTab;
  filter: string;
  selFaction: string;
  paintLevel: PaintLevel;
  paintFlag: string | null;
  countries: CountryInfo[];
  dialog: Dialog;
  toasts: Toast[];
  dragFac: string | null;
  fitNonce: number;
  exporting: boolean;
  exportStatus: string;
  /* true quando a página foi aberta para exportação (?export): não grava no navegador */
  exportMode: boolean;
  hasSaved: boolean;
}
