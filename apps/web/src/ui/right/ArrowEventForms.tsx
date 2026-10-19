import type { ChangeEvent } from 'react';
import { useStore } from '../../state/store.ts';
import { CommitInput } from '../fields/CommitInput.tsx';

/* Formulário de uma seta. Campos numéricos gravam ao sair; listas gravam na hora. */
export function ArrowForm({ id }: { id: string }) {
  const arrow = useStore((s) => s.scene.arrows.find((a) => a.id === id));
  const factions = useStore((s) => s.scene.factions);
  const editField = useStore((s) => s.editField);
  const deleteArrow = useStore((s) => s.deleteArrow);

  if (!arrow) return <div className="empty">Seta não encontrada.</div>;
  const f = (field: 't0' | 't1' | 'from.lat' | 'from.lon' | 'to.lat' | 'to.lon' | 'kind' | 'faction') => ({
    kind: 'arrow' as const,
    id: arrow.id,
    field,
  });
  const num = (label: string, field: 't0' | 't1' | 'from.lat' | 'from.lon' | 'to.lat' | 'to.lon', value: number, step: number) => (
    <label className="field">
      <span>{label}</span>
      <CommitInput type="number" step={step} value={value} onCommit={(v) => editField(f(field), v)} />
    </label>
  );
  const change = (field: 'kind' | 'faction') => (e: ChangeEvent<HTMLSelectElement>) => editField(f(field), e.target.value);

  return (
    <>
      <div className="card-info">
        <h4>{arrow.kind === 'withdraw' ? 'Retirada' : 'Avanço'}</h4>
        <span className="chip">{factions.find((x) => x.id === arrow.faction)?.name ?? '—'}</span>
      </div>
      <div className="grid2">
        {num('Início (h)', 't0', arrow.t0, 0.25)}
        {num('Fim (h)', 't1', arrow.t1, 0.25)}
        {num('Origem lat', 'from.lat', arrow.from.lat, 0.0001)}
        {num('Origem lon', 'from.lon', arrow.from.lon, 0.0001)}
        {num('Destino lat', 'to.lat', arrow.to.lat, 0.0001)}
        {num('Destino lon', 'to.lon', arrow.to.lon, 0.0001)}
      </div>
      <label className="field">
        <span>Tipo</span>
        <select value={arrow.kind} onChange={change('kind')}>
          <option value="attack">Avanço (sólida)</option>
          <option value="withdraw">Retirada (tracejada)</option>
        </select>
      </label>
      <label className="field">
        <span>Força</span>
        <select value={arrow.faction} onChange={change('faction')}>
          {factions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <button className="btn sm danger" onClick={() => deleteArrow(arrow.id)}>
        Excluir seta
      </button>
    </>
  );
}

/* Formulário de um evento (explosão/combate ou nota). */
export function EventForm({ id }: { id: string }) {
  const ev = useStore((s) => s.scene.events.find((e) => e.id === id));
  const editField = useStore((s) => s.editField);
  const deleteEvent = useStore((s) => s.deleteEvent);

  if (!ev) return <div className="empty">Evento não encontrado.</div>;
  const f = (field: 'text' | 't' | 'dur' | 'lat' | 'lon' | 'kind') => ({ kind: 'event' as const, id: ev.id, field });

  return (
    <>
      <div className="card-info">
        <h4>{ev.kind === 'note' ? 'Nota' : 'Evento'}</h4>
      </div>
      <label className="field">
        <span>Texto</span>
        <CommitInput type="text" value={ev.text} onCommit={(v) => editField(f('text'), v)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Instante (h)</span>
          <CommitInput type="number" step={0.25} value={ev.t} onCommit={(v) => editField(f('t'), v)} />
        </label>
        <label className="field">
          <span>Duração (h)</span>
          <CommitInput type="number" step={0.25} value={ev.dur} onCommit={(v) => editField(f('dur'), v)} />
        </label>
        <label className="field">
          <span>Lat</span>
          <CommitInput type="number" step={0.0001} value={ev.lat} onCommit={(v) => editField(f('lat'), v)} />
        </label>
        <label className="field">
          <span>Lon</span>
          <CommitInput type="number" step={0.0001} value={ev.lon} onCommit={(v) => editField(f('lon'), v)} />
        </label>
      </div>
      <label className="field">
        <span>Tipo</span>
        <select value={ev.kind} onChange={(e) => editField(f('kind'), e.target.value)}>
          <option value="attack">Explosão / combate</option>
          <option value="note">Nota (pino)</option>
        </select>
      </label>
      <button className="btn sm danger" onClick={() => deleteEvent(ev.id)}>
        Excluir evento
      </button>
    </>
  );
}
