import { useEffect, useRef, type RefObject } from 'react';
import { LAYER_IDS } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { LAYER_LABELS, applyLayerPrefs, useLayerPrefs } from './layerPrefs.ts';
import './layers.css';

/* Painel de camadas sobre o mapa (atalho L abre e fecha; Esc fecha).
   Duas partes: campos da cena (gravados no arquivo, com desfazer) e preferências deste navegador. */
export function LayersPanel() {
  const open = useLayerPrefs((s) => s.open);
  const setOpen = useLayerPrefs((s) => s.setOpen);
  const visible = useLayerPrefs((s) => s.visible);
  const panelRef = useRef<HTMLDivElement>(null);

  /* aplica as preferências ao mapa ao montar e a cada mudança */
  useEffect(() => {
    applyLayerPrefs(visible);
  }, [visible]);

  /* L abre/fecha; Esc fecha. Ignorados enquanto se digita ou com diálogo aberto */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target !== null && target.matches('input,select,textarea')) return;
      if (useStore.getState().dialog !== null) return;
      const p = useLayerPrefs.getState();
      if (e.key === 'Escape') {
        if (p.open) p.setOpen(false);
        return;
      }
      if (e.key.toLowerCase() === 'l') p.setOpen(!p.open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ao abrir, o foco vai para o painel (leitor de tela e teclado) */
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`mt-btn layers-btn${open ? ' on' : ''}`}
        aria-expanded={open}
        aria-controls="layers-panel"
        aria-label="Camadas (L)"
        title="Camadas do mapa (L)"
        onClick={() => setOpen(!open)}
      >
        <LayersIcon />
      </button>
      {open && <Panel panelRef={panelRef} />}
    </>
  );
}

function Panel({ panelRef }: { panelRef: RefObject<HTMLDivElement | null> }) {
  const showLabels = useStore((s) => s.scene.showLabels);
  const showTrails = useStore((s) => s.scene.showTrails);
  const showAllFlags = useStore((s) => s.scene.showAllFlags);
  const editField = useStore((s) => s.editField);
  const visible = useLayerPrefs((s) => s.visible);
  const setLayer = useLayerPrefs((s) => s.setLayer);
  const showAll = useLayerPrefs((s) => s.showAll);
  const setOpen = useLayerPrefs((s) => s.setOpen);

  return (
    <div className="ly-panel" id="layers-panel" role="dialog" aria-label="Camadas do mapa" tabIndex={-1} ref={panelRef}>
      <div className="ly-head">
        <b>Camadas</b>
        <button type="button" className="btn icon ghost sm" aria-label="Fechar camadas" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      <fieldset className="ly-group">
        <legend>Na cena (gravado no arquivo)</legend>
        <Check
          label="Rótulos de unidades"
          checked={showLabels}
          onChange={(v) => editField({ kind: 'scene', field: 'showLabels' }, v)}
        />
        <Check label="Rastros das unidades" checked={showTrails} onChange={(v) => editField({ kind: 'scene', field: 'showTrails' }, v)} />
        <Check
          label="Bandeiras em todas as áreas"
          checked={showAllFlags}
          onChange={(v) => editField({ kind: 'scene', field: 'showAllFlags' }, v)}
        />
      </fieldset>

      <fieldset className="ly-group">
        <legend>Neste navegador (não altera a cena)</legend>
        {LAYER_IDS.map((id) => (
          <Check key={id} label={LAYER_LABELS[id]} checked={visible[id]} onChange={(v) => setLayer(id, v)} />
        ))}
      </fieldset>

      <div className="ly-foot">
        <button type="button" className="btn sm" onClick={showAll}>
          Mostrar tudo
        </button>
        <span className="muted small">L ou Esc fecha</span>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ly-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 2 8l10 5 10-5-10-5z" />
      <path d="m2 13 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  );
}
