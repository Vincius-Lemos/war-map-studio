import { create, type StoreApi } from 'zustand';
import { normalizeScene, type Scene } from '@map-draw/shared';
import type { UiState } from './types.ts';
import { createUiActions, type UiActions } from './uiActions.ts';
import { createSceneActions, type SceneActions } from './sceneActions.ts';
import { hasSavedScene, readSavedScene } from './persist.ts';
import { DEMO_SCENE } from '../app/demo.ts';

export type Store = UiState & UiActions & SceneActions;
export type Api = StoreApi<Store>;

/* Cena inicial: a última salva no navegador, ou o exemplo. */
export function initialScene(): Scene {
  return readSavedScene() ?? normalizeScene(structuredClone(DEMO_SCENE));
}

/* Força padrão da pintura: a "f2" se existir (convenção da referência), senão a primeira. */
export function defaultFactionId(scene: Scene): string {
  return scene.factions.find((f) => f.id === 'f2')?.id ?? scene.factions[0]?.id ?? 'f2';
}

export const useStore = create<Store>()((_set, _get, api) => {
  const scene = initialScene();
  const initial: UiState = {
    scene,
    t: 0,
    playing: false,
    speed: 2,
    mode: 'select',
    sel: null,
    pending: null,
    tab: 'sel',
    filter: '',
    selFaction: defaultFactionId(scene),
    paintLevel: 'country',
    paintFlag: null,
    countries: [],
    dialog: null,
    toasts: [],
    dragFac: null,
    fitNonce: 0,
    exporting: false,
    exportStatus: '',
    exportMode: false,
    hasSaved: hasSavedScene(),
  };
  return {
    ...initial,
    ...createUiActions(api),
    ...createSceneActions(api),
  };
});
