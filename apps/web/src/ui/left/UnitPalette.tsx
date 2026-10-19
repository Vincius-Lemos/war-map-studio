import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ECHELON_LABELS, UNIT_TYPE_LABELS, suggestUnitName, type Echelon, type UnitType } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { encodeUnitDrag, TYPE_KEYS, usePlacement } from '../../app/placement.ts';
import { unitSymbolSvg } from './unitSymbol.ts';
import './UnitPalette.css';

/* Escalões que se escolhem na paleta (a opção "—" fica de fora: a unidade sempre tem escalão). */
const ECHELONS: Echelon[] = ['co', 'bn', 'reg', 'bde', 'div', 'corps'];

/* Passa o modo principal para Selecionar (a colocação não usa uma ferramenta própria) e liga a colocação. */
function beginPlacing(type: UnitType, echelon: Echelon): void {
  const st = useStore.getState();
  if (st.mode !== 'select') st.setMode('select');
  usePlacement.getState().startPlacing(type, echelon);
}

/* Paleta de unidades: tipos com símbolo, escalão, força selecionada, arrastar-e-soltar,
   clique-e-clique e atalhos 1-9 / 0. Fica sempre montada (atalhos e fantasma dependem dela),
   mas só aparece quando aberta. */
export function UnitPalette() {
  const open = usePlacement((s) => s.paletteOpen);
  const active = usePlacement((s) => s.active);
  const type = usePlacement((s) => s.type);
  const echelon = usePlacement((s) => s.echelon);
  const setEchelon = usePlacement((s) => s.setEchelon);
  const stopPlacing = usePlacement((s) => s.stopPlacing);
  const closePalette = usePlacement((s) => s.closePalette);
  const faction = useStore((s) => s.scene.factions.find((f) => f.id === s.selFaction));
  const previewName = useStore((s) => suggestUnitName(s.scene, { type, echelon, factionId: s.selFaction }));
  const ghostRef = useRef<HTMLDivElement>(null);
  const affil = faction?.affil ?? 'unknown';
  const color = faction?.color ?? '#888888';

  /* Trocar de ferramenta encerra a colocação; Esc encerra; 1-9 e 0 escolhem o tipo. */
  useEffect(() => {
    const unsubMode = useStore.subscribe((s, p) => {
      if (s.mode !== p.mode) usePlacement.getState().stopPlacing();
    });
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.matches('input,select,textarea') || st.dialog !== null) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        usePlacement.getState().stopPlacing();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        const t = TYPE_KEYS[e.key === '0' ? 9 : Number(e.key) - 1];
        if (!t) return;
        e.preventDefault();
        beginPlacing(t, usePlacement.getState().echelon);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unsubMode();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /* Fantasma: símbolo da força seguindo o cursor, enquanto ele estiver sobre o mapa. */
  useEffect(() => {
    if (!active) return;
    const host = document.querySelector<HTMLElement>('.map-host');
    host?.classList.add('placing');
    const onMove = (e: MouseEvent) => {
      const g = ghostRef.current;
      if (!g) return;
      const over = host !== null && e.target instanceof Node && host.contains(e.target);
      g.style.display = over ? 'block' : 'none';
      g.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 10}px)`;
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      host?.classList.remove('placing');
    };
  }, [active]);

  if (!open) return null;

  const pick = (t: UnitType) => {
    if (active && type === t) stopPlacing();
    else beginPlacing(t, echelon);
  };

  return (
    <div className="uplace">
      <div className="uplace-head">
        <span className="uplace-swatch" style={{ background: color }} />
        <span className="uplace-force" title="Força que recebe a unidade (escolha na lista de forças)">
          {faction ? faction.name : 'Sem força'}
        </span>
        <select
          className="uplace-ech"
          aria-label="Escalão da unidade"
          value={echelon}
          onChange={(e) => setEchelon(e.target.value as Echelon)}
        >
          {ECHELONS.map((ech) => (
            <option key={ech} value={ech}>
              {ECHELON_LABELS[ech]}
            </option>
          ))}
        </select>
        <button className="btn icon sm ghost" onClick={closePalette} title="Fechar paleta" aria-label="Fechar paleta">
          ✕
        </button>
      </div>

      <div className="uplace-grid">
        {TYPE_KEYS.map((t, i) => {
          const on = active && type === t;
          const key = i === 9 ? 0 : i + 1;
          return (
            <button
              key={t}
              type="button"
              className={`uplace-item${on ? ' on' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', encodeUnitDrag(t, echelon));
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setDragImage(e.currentTarget, 18, 18);
              }}
              onClick={() => pick(t)}
              title={`${UNIT_TYPE_LABELS[t]}: clique e depois no mapa, ou arraste para o mapa (tecla ${key})`}
              aria-pressed={on}
            >
              <span
                className="uplace-sym"
                dangerouslySetInnerHTML={{ __html: unitSymbolSvg(t, affil) }}
              />
              <span className="uplace-lbl">{UNIT_TYPE_LABELS[t]}</span>
              <kbd>{key}</kbd>
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="uplace-status" role="status">
          <span>
            Colocando <b>{previewName}</b>: clique no mapa. <kbd>Esc</kbd> encerra.
          </span>
          <button className="btn sm" onClick={stopPlacing}>
            Parar
          </button>
        </div>
      ) : (
        <p className="muted small uplace-help">
          Arraste um símbolo para o mapa, ou clique nele e depois no mapa. Teclas 1–9 e 0 escolhem o tipo.
        </p>
      )}

      {active &&
        createPortal(
          <div ref={ghostRef} className="uplace-ghost" style={{ display: 'none', borderColor: color }}>
            <span dangerouslySetInnerHTML={{ __html: unitSymbolSvg(type, affil) }} />
          </div>,
          document.body,
        )}
    </div>
  );
}
