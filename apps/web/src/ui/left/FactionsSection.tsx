import type { DragEvent, MouseEvent } from 'react';
import { AFFIL_OPTIONS, AFFIL_SHORT, type Faction } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { CommitInput } from '../fields/CommitInput.tsx';
import { Section } from './Section.tsx';

/* Forças: cor, nome, afiliação e país da bandeira. A alça colorida é arrastável para o mapa. */
export function FactionsSection() {
  const factions = useStore((s) => s.scene.factions);
  const addFaction = useStore((s) => s.addFaction);
  return (
    <Section title="Forças" count={factions.length} defaultOpen>
      {factions.map((f) => (
        <FactionRow key={f.id} faction={f} />
      ))}
      <button className="btn sm" onClick={addFaction}>
        + Nova força
      </button>
      <p className="muted small">Arraste a alça colorida para um país, uma região ou uma unidade no mapa.</p>
    </Section>
  );
}

function FactionRow({ faction: f }: { faction: Faction }) {
  const selected = useStore((s) => s.selFaction === f.id);
  const setSelFaction = useStore((s) => s.setSelFaction);
  const editField = useStore((s) => s.editField);
  const deleteFaction = useStore((s) => s.deleteFaction);
  const setDragFac = useStore((s) => s.setDragFac);
  const countries = useStore((s) => s.countries);

  const onDragStart = (e: DragEvent<HTMLSpanElement>) => {
    e.dataTransfer.setData('text/plain', f.id);
    e.dataTransfer.effectAllowed = 'copy';
    setDragFac(f.id);
  };
  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input,select,textarea,button')) return;
    setSelFaction(f.id);
  };

  return (
    <div className={`row-item fac${selected ? ' on' : ''}`} onClick={onRowClick}>
      <div className="fac-fields">
        <span
          className="handle"
          draggable
          onDragStart={onDragStart}
          onDragEnd={() => setDragFac(null)}
          style={{ background: f.color }}
          title="Arraste para um país ou unidade no mapa"
          role="img"
          aria-label={`Arrastar a força ${f.name}`}
        >
          ⠿
        </span>
        <input
          type="color"
          value={f.color}
          title="Trocar cor"
          onChange={(e) => editField({ kind: 'fac', id: f.id, field: 'color' }, e.target.value)}
        />
        <CommitInput
          type="text"
          value={f.name}
          aria-label="Nome da força"
          onCommit={(v) => editField({ kind: 'fac', id: f.id, field: 'name' }, v)}
        />
        <select
          value={f.affil}
          title="Afiliação"
          aria-label="Afiliação"
          onChange={(e) => editField({ kind: 'fac', id: f.id, field: 'affil' }, e.target.value)}
        >
          {AFFIL_OPTIONS.map(([k]) => (
            <option key={k} value={k}>
              {AFFIL_SHORT[k]}
            </option>
          ))}
        </select>
        <select
          value={f.flag ?? ''}
          title="Bandeira do país desta força (usada quando ela pinta um estado)"
          aria-label="Bandeira do país da força"
          onChange={(e) => editField({ kind: 'fac', id: f.id, field: 'flag' }, e.target.value)}
        >
          <option value="">sem bandeira</option>
          {countries.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn icon sm ghost" onClick={() => deleteFaction(f.id)} title="Remover força" aria-label="Remover força">
          ✕
        </button>
      </div>
    </div>
  );
}
