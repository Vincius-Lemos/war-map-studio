import { create } from 'zustand';
import { ALL_LAYERS_ON, LAYER_IDS, type LayerApi, type LayerId, type LayerVisibility } from '@map-draw/shared';
import { getMapHandle } from '../../app/mapRegistry.ts';

/* Preferências de camadas deste navegador (chave `map-draw:layers` no localStorage). Não alteram a cena.
   Falhas de armazenamento (modo privado, bloqueado) caem no padrão: tudo ligado. */
const KEY = 'map-draw:layers';

export const LAYER_LABELS: Record<LayerId, string> = {
  countries: 'Países',
  flags: 'Bandeiras de países e regiões',
  regions: 'Regiões (estados)',
  countryLabels: 'Rótulos de países',
  units: 'Unidades',
  arrows: 'Setas',
  events: 'Eventos',
};

function load(): LayerVisibility {
  const v: LayerVisibility = { ...ALL_LAYERS_ON };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o: unknown = JSON.parse(raw);
      if (o && typeof o === 'object') {
        for (const id of LAYER_IDS) {
          const b = (o as Record<string, unknown>)[id];
          if (typeof b === 'boolean') v[id] = b;
        }
      }
    }
  } catch {
    /* sem armazenamento ou JSON inválido: vale o padrão */
  }
  return v;
}

function save(v: LayerVisibility): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* sem armazenamento: a preferência vale só nesta sessão */
  }
}

interface LayerPrefsState {
  visible: LayerVisibility;
  /* painel de camadas aberto (não persiste) */
  open: boolean;
  setLayer(id: LayerId, on: boolean): void;
  showAll(): void;
  setOpen(open: boolean): void;
}

export const useLayerPrefs = create<LayerPrefsState>()((set, get) => ({
  visible: load(),
  open: false,
  setLayer(id, on) {
    const next = { ...get().visible, [id]: on };
    save(next);
    set({ visible: next });
  },
  showAll() {
    save({ ...ALL_LAYERS_ON });
    set({ visible: { ...ALL_LAYERS_ON } });
  },
  setOpen(open) {
    set({ open });
  },
}));

/* Envia a visibilidade ao motor do mapa, se ele expuser `setLayerVisibility` (contrato LayerApi).
   Se o mapa ainda não foi criado, tenta de novo por alguns segundos (o mapa sobe depois da interface). */
export function applyLayerPrefs(v: LayerVisibility, tries = 50): void {
  const api: unknown = getMapHandle()?.api;
  if (!api) {
    if (tries > 0) window.setTimeout(() => applyLayerPrefs(v, tries - 1), 100);
    return;
  }
  const m = api as Partial<LayerApi>;
  if (typeof m.setLayerVisibility === 'function') m.setLayerVisibility(v);
}
