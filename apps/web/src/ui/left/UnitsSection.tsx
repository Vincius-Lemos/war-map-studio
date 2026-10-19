import { ECHELON_MARK, UNIT_TYPE_LABELS } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { usePlacement } from '../../app/placement.ts';
import { Section } from './Section.tsx';
import { UnitPalette } from './UnitPalette.tsx';

/* Unidades: busca, lista e criação. */
export function UnitsSection() {
  const units = useStore((s) => s.scene.units);
  const factions = useStore((s) => s.scene.factions);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  const paletteOpen = usePlacement((s) => s.paletteOpen);
  const togglePalette = usePlacement((s) => s.togglePalette);

  const q = filter.trim().toLowerCase();
  const shown = units.filter((u) => !q || u.name.toLowerCase().includes(q));

  return (
    <Section title="Unidades" count={units.length} defaultOpen>
      <UnitPalette />
      <input
        className="search"
        type="text"
        placeholder="Buscar unidade…"
        aria-label="Buscar unidade"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {shown.map((u) => {
        const color = factions.find((f) => f.id === u.faction)?.color ?? '#888';
        const on = sel?.kind === 'unit' && sel.id === u.id;
        return (
          <div
            key={u.id}
            className={`row-item${on ? ' on' : ''}`}
            onClick={() => select({ kind: 'unit', id: u.id })}
          >
            <span className="dot" style={{ background: color }} />
            <span className="nm">{u.name}</span>
            <span className="meta">
              {ECHELON_MARK[u.echelon]} {UNIT_TYPE_LABELS[u.type].split(' ')[0]}
            </span>
          </div>
        );
      })}
      {shown.length === 0 && (
        <div className="empty">{units.length ? 'Nenhuma unidade com esse nome.' : 'Nenhuma unidade. Use “+ Unidade”.'}</div>
      )}
      <button className="btn sm primary" onClick={togglePalette} aria-expanded={paletteOpen}>
        {paletteOpen ? 'Fechar paleta' : '+ Unidade'}
      </button>
    </Section>
  );
}
