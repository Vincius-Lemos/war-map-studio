import { ECHELON_LABELS, UNIT_TYPE_LABELS, UNIT_TYPE_KEYS, type Echelon, type UnitType } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { CommitInput } from '../fields/CommitInput.tsx';

export function UnitForm({ id }: { id: string }) {
  const unit = useStore((s) => s.scene.units.find((u) => u.id === id));
  const factions = useStore((s) => s.scene.factions);
  const editField = useStore((s) => s.editField);
  const deleteUnit = useStore((s) => s.deleteUnit);
  const addWaypointNow = useStore((s) => s.addWaypointNow);
  const deleteWaypoint = useStore((s) => s.deleteWaypoint);

  if (!unit) return <div className="empty">Esta unidade não existe mais.</div>;
  const field = (f: 'name' | 'faction' | 'type' | 'echelon' | 'note') => ({ kind: 'unit' as const, id: unit.id, field: f });

  return (
    <>
      <div className="card-info">
        <h4>{unit.name}</h4>
        <span className="chip">{UNIT_TYPE_LABELS[unit.type]}</span> <span className="chip">{ECHELON_LABELS[unit.echelon]}</span>
      </div>
      <label className="field">
        <span>Nome</span>
        <CommitInput type="text" value={unit.name} onCommit={(v) => editField(field('name'), v)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Força</span>
          <select value={unit.faction} onChange={(e) => editField(field('faction'), e.target.value)}>
            {factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={unit.type} onChange={(e) => editField(field('type'), e.target.value as UnitType)}>
            {UNIT_TYPE_KEYS.map((k) => (
              <option key={k} value={k}>
                {UNIT_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Escalão</span>
        <select value={unit.echelon} onChange={(e) => editField(field('echelon'), e.target.value as Echelon)}>
          {(Object.keys(ECHELON_LABELS) as Echelon[]).map((k) => (
            <option key={k} value={k}>
              {ECHELON_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Observação</span>
        <textarea rows={3} value={unit.note} onChange={(e) => editField(field('note'), e.target.value)} />
      </label>

      <div className="h">Trajeto (horas · latitude · longitude)</div>
      <table className="wp">
        <tbody>
          {unit.path.map((p, i) => (
            <tr key={`${i}-${p.t}`}>
              <td style={{ width: '30%' }}>
                <CommitInput
                  type="number"
                  step={0.25}
                  value={p.t}
                  aria-label="Hora do ponto"
                  onCommit={(v) => editField({ kind: 'wp', id: unit.id, index: i, field: 't' }, v)}
                />
              </td>
              <td>
                <CommitInput
                  type="number"
                  step={0.0001}
                  value={p.lat}
                  aria-label="Latitude do ponto"
                  onCommit={(v) => editField({ kind: 'wp', id: unit.id, index: i, field: 'lat' }, v)}
                />
              </td>
              <td>
                <CommitInput
                  type="number"
                  step={0.0001}
                  value={p.lon}
                  aria-label="Longitude do ponto"
                  onCommit={(v) => editField({ kind: 'wp', id: unit.id, index: i, field: 'lon' }, v)}
                />
              </td>
              <td style={{ width: 30 }}>
                <button className="btn icon sm ghost" onClick={() => deleteWaypoint(unit.id, i)} title="Remover ponto" aria-label="Remover ponto">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button className="btn sm primary" onClick={() => addWaypointNow(unit.id)}>
          + Ponto neste instante
        </button>
        <button className="btn sm danger" onClick={() => deleteUnit(unit.id)}>
          Excluir unidade
        </button>
      </div>
      <p className="muted small">
        Arraste a unidade no mapa para criar um ponto neste instante. Sem pontos antes do primeiro horário, a unidade fica oculta.
      </p>
    </>
  );
}
