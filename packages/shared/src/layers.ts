/* Camadas do mapa que o usuário liga e desliga. Ficam fora da cena (preferência deste navegador),
   por isso não entram no contrato da cena. Rótulos de unidades, rastros e "bandeiras em todas as áreas"
   são campos da cena (showLabels, showTrails, showAllFlags) e não aparecem aqui. */
export const LAYER_IDS = ['countries', 'flags', 'regions', 'countryLabels', 'units', 'arrows', 'events'] as const;
export type LayerId = (typeof LAYER_IDS)[number];
export type LayerVisibility = Record<LayerId, boolean>;

export const ALL_LAYERS_ON: LayerVisibility = {
  countries: true,
  flags: true,
  regions: true,
  countryLabels: true,
  units: true,
  arrows: true,
  events: true,
};

/* Contrato opcional que o motor do mapa pode implementar para aplicar a visibilidade.
   A interface chama `setLayerVisibility` quando a preferência muda. */
export interface LayerApi {
  setLayerVisibility(v: LayerVisibility): void;
}
