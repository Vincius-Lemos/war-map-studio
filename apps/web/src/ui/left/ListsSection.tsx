import { clockParts } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { Section } from './Section.tsx';

/* Setas e eventos: listas clicáveis, com o instante de início. */
export function ArrowsSection() {
  const scene = useStore((s) => s.scene);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  return (
    <Section title="Setas" count={scene.arrows.length}>
      {scene.arrows.map((a) => {
        const on = sel?.kind === 'arrow' && sel.id === a.id;
        const fac = scene.factions.find((f) => f.id === a.faction);
        return (
          <div key={a.id} className={`row-item${on ? ' on' : ''}`} onClick={() => select({ kind: 'arrow', id: a.id })}>
            <span className="dot" style={{ background: fac?.color ?? '#888' }} />
            <span className="nm">
              {a.kind === 'withdraw' ? 'Retirada' : 'Avanço'} · {fac?.name ?? '—'}
            </span>
            <span className="meta">{clockParts(scene, a.t0).main}</span>
          </div>
        );
      })}
      {scene.arrows.length === 0 && <div className="empty">Nenhuma seta.</div>}
    </Section>
  );
}

export function EventsSection() {
  const scene = useStore((s) => s.scene);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  return (
    <Section title="Eventos" count={scene.events.length}>
      {scene.events.map((e) => {
        const on = sel?.kind === 'event' && sel.id === e.id;
        return (
          <div key={e.id} className={`row-item${on ? ' on' : ''}`} onClick={() => select({ kind: 'event', id: e.id })}>
            <span>{e.kind === 'note' ? '📌' : '💥'}</span>
            <span className="nm">{e.text || '(sem texto)'}</span>
            <span className="meta">{clockParts(scene, e.t).main}</span>
          </div>
        );
      })}
      {scene.events.length === 0 && <div className="empty">Nenhum evento.</div>}
    </Section>
  );
}

export function TerritorySection() {
  const scene = useStore((s) => s.scene);
  const deleteTerritory = useStore((s) => s.deleteTerritory);
  const clearTerritories = useStore((s) => s.clearTerritories);

  const rows = scene.territories
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.t - a.e.t)
    .slice(0, 40);

  const clear = () => {
    if (window.confirm('Limpar todo o controle territorial?')) clearTerritories();
  };

  return (
    <Section title="Controle territorial" count={scene.territories.length}>
      {rows.map(({ e, i }) => {
        const fac = scene.factions.find((f) => f.id === e.faction);
        return (
          <div key={`${e.iso}-${e.sub ?? ''}-${e.t}-${i}`} className="row-item">
            <span className="dot" style={{ background: fac?.color ?? '#888' }} />
            <span className="nm">
              {e.name} → {fac?.name ?? '—'}
            </span>
            <span className="meta">{clockParts(scene, e.t).main}</span>
            <button className="btn icon sm ghost" onClick={() => deleteTerritory(i)} title="Remover" aria-label="Remover controle">
              ✕
            </button>
          </div>
        );
      })}
      {scene.territories.length === 0 && <div className="empty">Nenhum país pintado. Use a ferramenta “Pintar país”.</div>}
      {scene.territories.length > 0 && (
        <button className="btn sm danger" onClick={clear}>
          Limpar controle
        </button>
      )}
    </Section>
  );
}
