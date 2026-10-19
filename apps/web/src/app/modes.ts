import type { ModeId } from '../state/types.ts';

export interface ModeInfo {
  id: ModeId;
  label: string;
  key: string;
  hint: string;
}

/* Ferramentas do painel esquerdo. A tecla é o atalho (V M P A E C). */
export const MODES: readonly ModeInfo[] = [
  { id: 'select', label: 'Selecionar', key: 'V', hint: 'Clique numa unidade, seta, evento ou país. Arraste uma unidade para movê-la neste instante.' },
  { id: 'move', label: 'Mover unidade', key: 'M', hint: 'Clique no mapa para mover a unidade selecionada neste instante.' },
  { id: 'paint', label: 'Pintar país', key: 'P', hint: 'Clique num país para pintá-lo com a força selecionada, a partir deste instante.' },
  { id: 'arrow', label: 'Seta', key: 'A', hint: 'Clique na origem e depois no destino. A seta anima a partir deste instante.' },
  { id: 'event', label: 'Evento', key: 'E', hint: 'Clique no mapa para criar um evento (explosão ou nota) neste instante.' },
  { id: 'calib', label: 'Calibrar imagem', key: 'C', hint: 'Clique em dois cantos opostos da sua imagem para posicioná-la no mapa.' },
];

export const modeInfo = (id: ModeId): ModeInfo | undefined => MODES.find((m) => m.id === id);
