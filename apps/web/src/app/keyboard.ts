import { useStore, type Store } from '../state/store.ts';
import { stepFor } from '../state/editActions.ts';
import { MODES } from './modes.ts';

/* Registro único dos atalhos de teclado. A barra de ações, as dicas (tooltips) e o painel de ajuda (?)
   leem daqui, então um atalho muda em um só lugar.

   Regras:
   - Com um campo de texto em foco, ou um diálogo aberto, os atalhos ficam desligados (Esc fecha o diálogo).
   - Setas sem modificador controlam o tempo. Com Alt, movem a seleção no mapa (Alt+Shift: passo maior).
   - Letras de ferramenta só valem sem Ctrl, Alt ou Meta, para não disputar com Ctrl+C, Ctrl+V etc. */

export type ShortcutGroup = 'Geral' | 'Tempo' | 'Ferramentas' | 'Seleção' | 'Edição';

export interface Shortcut {
  id: string;
  keys: string;
  group: ShortcutGroup;
  label: string;
  match(e: KeyboardEvent): boolean;
  run(s: Store, e: KeyboardEvent): void;
}

const mod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;
const bare = (e: KeyboardEvent) => !mod(e) && !e.altKey;
const keyIs = (e: KeyboardEvent, k: string) => e.key.toLowerCase() === k;
const NUDGE_FRACTION = 0.004;
const NUDGE_FRACTION_BIG = 0.02;

const modeShortcuts: Shortcut[] = MODES.map((m) => ({
  id: `mode:${m.id}`,
  keys: m.key,
  group: 'Ferramentas' as const,
  label: m.label,
  match: (e) => bare(e) && !e.shiftKey && keyIs(e, m.key.toLowerCase()),
  run: (s) => s.setMode(m.id),
}));

export const SHORTCUTS: Shortcut[] = [
  /* Geral */
  {
    id: 'help', keys: '?', group: 'Geral', label: 'Mostrar esta lista de atalhos',
    match: (e) => e.key === '?' && bare(e),
    run: (s) => s.openDialog('help'),
  },
  {
    id: 'escape', keys: 'Esc', group: 'Geral', label: 'Cancelar a ação em andamento e limpar a seleção',
    match: (e) => e.key === 'Escape',
    run: (s) => {
      s.setPending(null);
      s.select(null);
      s.setMode('select');
    },
  },
  {
    id: 'fit', keys: 'F', group: 'Geral', label: 'Ajustar o mapa à área',
    match: (e) => bare(e) && !e.shiftKey && keyIs(e, 'f'),
    run: (s) => s.requestFit(),
  },
  {
    id: 'new', keys: 'N', group: 'Geral', label: 'Novo mapa',
    match: (e) => bare(e) && !e.shiftKey && keyIs(e, 'n'),
    run: (s) => s.openDialog('wiz'),
  },
  {
    id: 'undo', keys: 'Ctrl+Z', group: 'Geral', label: 'Desfazer (até 100 passos)',
    match: (e) => mod(e) && !e.shiftKey && keyIs(e, 'z'),
    run: (s) => s.undo(),
  },
  {
    id: 'redo', keys: 'Ctrl+Y ou Ctrl+Shift+Z', group: 'Geral', label: 'Refazer',
    match: (e) => mod(e) && ((keyIs(e, 'y') && !e.shiftKey) || (keyIs(e, 'z') && e.shiftKey)),
    run: (s) => s.redo(),
  },

  /* Tempo (setas sem Alt) */
  {
    id: 'play', keys: 'Espaço', group: 'Tempo', label: 'Tocar / pausar a linha do tempo',
    match: (e) => e.code === 'Space' && bare(e),
    run: (s) => s.togglePlay(),
  },
  {
    id: 'time-step', keys: '← →', group: 'Tempo', label: 'Avançar / voltar 1 hora (Shift: 15 minutos)',
    match: (e) => (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && bare(e),
    run: (s, e) => {
      const step = e.shiftKey ? 0.25 : 1;
      s.setT(s.t + (e.key === 'ArrowRight' ? step : -step));
    },
  },
  {
    id: 'key-step', keys: '↑ ↓', group: 'Tempo', label: 'Ir ao instante-chave anterior / seguinte',
    match: (e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && bare(e),
    run: (s, e) => s.jumpKey(e.key === 'ArrowDown' ? 1 : -1),
  },
  {
    id: 'home-end', keys: 'Home / End', group: 'Tempo', label: 'Início / fim da cena',
    match: (e) => (e.key === 'Home' || e.key === 'End') && bare(e),
    run: (s, e) => s.setT(e.key === 'Home' ? 0 : s.scene.durationH),
  },

  /* Seleção e movimento */
  {
    id: 'nudge', keys: 'Alt + setas', group: 'Seleção', label: 'Mover a seleção no mapa (Alt+Shift: passo maior)',
    match: (e) => e.altKey && !mod(e) && (e.key.startsWith('Arrow')),
    run: (s, e) => {
      const f = e.shiftKey ? NUDGE_FRACTION_BIG : NUDGE_FRACTION;
      const d = stepFor(s.scene, f);
      const dLat = e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0;
      const dLon = e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0;
      s.nudgeSelection(dLat, dLon);
    },
  },
  {
    id: 'delete', keys: 'Del', group: 'Seleção', label: 'Apagar a seleção',
    match: (e) => (e.key === 'Delete' || e.key === 'Backspace') && bare(e),
    run: (s) => s.deleteSelected(),
  },
  {
    id: 'select-all', keys: 'Ctrl+A', group: 'Seleção', label: 'Selecionar todas as unidades, setas e eventos',
    match: (e) => mod(e) && keyIs(e, 'a'),
    run: (s) => s.selectAll(),
  },

  /* Edição */
  {
    id: 'copy', keys: 'Ctrl+C', group: 'Edição', label: 'Copiar a seleção',
    match: (e) => mod(e) && !e.shiftKey && keyIs(e, 'c') && !hasTextSelection(),
    run: (s) => s.copySelection(),
  },
  {
    id: 'paste', keys: 'Ctrl+V', group: 'Edição', label: 'Colar (deslocado a cada cola)',
    match: (e) => mod(e) && !e.shiftKey && keyIs(e, 'v') && !hasTextSelection(),
    run: (s) => s.pasteClipboard(),
  },
  {
    id: 'duplicate', keys: 'Ctrl+D', group: 'Edição', label: 'Duplicar a seleção',
    match: (e) => mod(e) && !e.shiftKey && keyIs(e, 'd'),
    run: (s) => s.duplicateSelection(),
  },

  ...modeShortcuts,
];

/* Gestos do mouse, para o painel de ajuda (não são teclas, então não entram no despacho). */
export const MOUSE_HINTS: { keys: string; group: ShortcutGroup; label: string }[] = [
  { keys: 'Shift + clique', group: 'Seleção', label: 'Adicionar unidade, seta ou evento à seleção (no mapa e na lista)' },
  { keys: 'Ctrl + clique', group: 'Seleção', label: 'Incluir ou tirar da seleção (no mapa e na lista)' },
  { keys: 'Arrastar no fundo (Selecionar)', group: 'Seleção', label: 'Caixa de seleção: pendente, depende do mapa' },
];

/* Texto do atalho para tooltips, ex.: keyLabel('undo') -> 'Ctrl+Z'. */
export function keyLabel(id: string): string {
  return SHORTCUTS.find((s) => s.id === id)?.keys ?? '';
}

/* Último estado de Shift/Ctrl no pressionamento do mouse: o clique no mapa não traz os modificadores. */
const pointer = { shift: false, ctrl: false };
export function pointerMods(): { shift: boolean; ctrl: boolean } {
  return { ...pointer };
}

/* Com texto selecionado na página, Ctrl+C/V/D seguem o padrão do navegador. */
function hasTextSelection(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.getSelection()?.toString() ?? '') !== '';
}

/* Instala os atalhos e o rastreio de modificadores do mouse. Devolve a função de desligamento. */
export function installKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const s = useStore.getState();
    const target = e.target instanceof HTMLElement ? e.target : null;
    const typing = target !== null && target.matches('input,select,textarea');
    if (typing) return;
    if (s.dialog !== null) {
      if (e.key === 'Escape' || (e.key === '?' && s.dialog === 'help')) s.closeDialog();
      return;
    }
    const hit = SHORTCUTS.find((x) => x.match(e));
    if (!hit) return;
    e.preventDefault();
    hit.run(s, e);
  };
  const onPointer = (e: PointerEvent) => {
    pointer.shift = e.shiftKey;
    pointer.ctrl = e.ctrlKey || e.metaKey;
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer, true);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onPointer, true);
  };
}
