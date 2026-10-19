import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ECHELON_LABELS, UNIT_TYPE_LABELS, suggestUnitName, type Echelon, type UnitType } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { encodeUnitDrag, TYPE_KEYS, usePlacement } from '../../app/placement.ts';
import { unitSymbolSvg } from './unitSymbol.ts';
import './UnitPalette.css';

/* Escalões que se escolhem na biblioteca (a opção "—" fica de fora: a unidade sempre tem escalão). */
const ECHELONS: Echelon[] = ['co', 'bn', 'reg', 'bde', 'div', 'corps'];
const ECHELON_SHORT: Record<Echelon, string> = { '': '—', co: 'CIA', bn: 'BN', reg: 'REG', bde: 'BDE', div: 'DIV', corps: 'CORPO' };

/* Categorias da biblioteca, no estilo dos jogos de estratégia. */
type Category = 'all' | 'inf' | 'armor' | 'support' | 'command' | 'civil';
const CATEGORIES: Array<{ id: Category; label: string; types: UnitType[] }> = [
  { id: 'all', label: 'Todas', types: [...TYPE_KEYS] },
  { id: 'inf', label: 'Infantaria', types: ['inf', 'mech', 'motor'] },
  { id: 'armor', label: 'Blindados', types: ['arm', 'cav'] },
  { id: 'support', label: 'Apoio', types: ['art', 'eng', 'fort'] },
  { id: 'command', label: 'Comando', types: ['hq'] },
  { id: 'civil', label: 'Civis', types: ['civ'] },
];

/* Passa o modo principal para Selecionar (a colocação não usa uma ferramenta própria) e liga a colocação. */
function beginPlacing(type: UnitType, echelon: Echelon): void {
  const st = useStore.getState();
  if (st.mode !== 'select') st.setMode('select');
  usePlacement.getState().startPlacing(type, echelon);
}

/* Biblioteca de unidades: abas por categoria, busca, cartões com símbolo, escalão, pré-visualização,
   arrastar-e-soltar, clique-e-clique e atalhos 1-9 / 0. Fica sempre montada (atalhos e fantasma dependem dela),
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
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
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

  /* Tipos visíveis: categoria escolhida e busca pelo nome do tipo. */
  const visible = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0]!;
    const q = query.trim().toLowerCase();
    return TYPE_KEYS.filter(
      (t) => cat.types.includes(t) && (!q || UNIT_TYPE_LABELS[t].toLowerCase().includes(q)),
    );
  }, [category, query]);

  if (!open) return null;

  const pick = (t: UnitType) => {
    if (active && type === t) stopPlacing();
    else beginPlacing(t, echelon);
  };

  return (
    <div className="ulib">
      <div className="ulib-head">
        <span className="ulib-swatch" style={{ background: color }} />
        <span className="ulib-force" title="Força que recebe a unidade (escolha na lista de forças)">
          {faction ? faction.name : 'Sem força'}
        </span>
        <button className="btn icon sm ghost" onClick={closePalette} title="Fechar biblioteca" aria-label="Fechar biblioteca">
          ✕
        </button>
      </div>

      <div className="ulib-preview">
        <span className="ulib-preview-sym" dangerouslySetInnerHTML={{ __html: unitSymbolSvg(type, affil) }} />
        <div className="ulib-preview-txt">
          <b>{UNIT_TYPE_LABELS[type]}</b>
          <span className="muted small">{previewName}</span>
        </div>
      </div>

      <div className="ulib-ech" role="radiogroup" aria-label="Escalão">
        {ECHELONS.map((ech) => (
          <button
            key={ech}
            type="button"
            role="radio"
            aria-checked={echelon === ech}
            className={`ulib-ech-btn${echelon === ech ? ' on' : ''}`}
            onClick={() => setEchelon(ech)}
            title={ECHELON_LABELS[ech]}
          >
            {ECHELON_SHORT[ech]}
          </button>
        ))}
      </div>

      <div className="ulib-tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={`ulib-tab${category === c.id ? ' on' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        className="ulib-search"
        type="search"
        placeholder="Buscar unidade…"
        aria-label="Buscar unidade"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="ulib-grid">
        {visible.map((t) => {
          const on = active && type === t;
          const key = TYPE_KEYS.indexOf(t) === 9 ? 0 : TYPE_KEYS.indexOf(t) + 1;
          return (
            <button
              key={t}
              type="button"
              className={`ulib-card${on ? ' on' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', encodeUnitDrag(t, echelon));
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setDragImage(e.currentTarget, 32, 32);
              }}
              onClick={() => pick(t)}
              title={`${UNIT_TYPE_LABELS[t]}: clique e depois no mapa, ou arraste para o mapa (tecla ${key})`}
              aria-pressed={on}
            >
              <kbd className="ulib-key">{key}</kbd>
              <span className="ulib-card-sym" dangerouslySetInnerHTML={{ __html: unitSymbolSvg(t, affil) }} />
              <span className="ulib-card-lbl">{UNIT_TYPE_LABELS[t]}</span>
            </button>
          );
        })}
        {visible.length === 0 && <p className="muted small">Nenhuma unidade com esse nome.</p>}
      </div>

      {active ? (
        <div className="ulib-status" role="status">
          <span>
            Colocando <b>{previewName}</b>: clique no mapa. <kbd>Esc</kbd> encerra.
          </span>
          <button className="btn sm" onClick={stopPlacing}>
            Parar
          </button>
        </div>
      ) : (
        <p className="muted small ulib-help">
          Arraste um cartão para o mapa, ou clique nele e depois no mapa. Teclas 1–9 e 0 escolhem o tipo.
        </p>
      )}

      {active &&
        createPortal(
          <div ref={ghostRef} className="ulib-ghost" style={{ display: 'none', borderColor: color }}>
            <span dangerouslySetInnerHTML={{ __html: unitSymbolSvg(type, affil) }} />
          </div>,
          document.body,
        )}
    </div>
  );
}
