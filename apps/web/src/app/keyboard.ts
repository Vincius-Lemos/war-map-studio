import { useStore } from '../state/store.ts';
import { MODES } from './modes.ts';

/* Atalhos de teclado. Ficam desligados enquanto se digita num campo ou com um diálogo aberto (Esc fecha o diálogo). */
export function installKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const s = useStore.getState();
    const target = e.target instanceof HTMLElement ? e.target : null;
    const typing = target !== null && target.matches('input,select,textarea');
    if (typing || s.dialog !== null) {
      if (e.key === 'Escape') s.closeDialog();
      return;
    }
    const step = e.shiftKey ? 0.25 : 1;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') {
      e.preventDefault();
      s.togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      s.setT(s.t + step);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      s.setT(s.t - step);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      s.jumpKey(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      s.jumpKey(1);
    } else if (e.key === 'Home') {
      s.setT(0);
    } else if (e.key === 'End') {
      s.setT(s.scene.durationH);
    } else if (e.key === 'Escape') {
      s.setPending(null);
      s.select(null);
      s.setMode('select');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      s.deleteSelected();
    } else if (k === 'f') {
      s.requestFit();
    } else if (k === 'n') {
      s.openDialog('wiz');
    } else {
      const m = MODES.find((x) => x.key.toLowerCase() === k);
      if (m) s.setMode(m.id);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
