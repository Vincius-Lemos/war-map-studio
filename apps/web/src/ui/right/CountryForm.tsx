import { clockParts, controlAt } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';

/* País selecionado: quem controla agora e a pintura a partir do instante atual. */
export function CountryForm({ iso }: { iso: string }) {
  const country = useStore((s) => s.countries.find((c) => c.iso === iso));
  const scene = useStore((s) => s.scene);
  const t = useStore((s) => s.t);
  const selFaction = useStore((s) => s.selFaction);
  const paintCountry = useStore((s) => s.paintCountry);

  const name = country?.name ?? iso;
  const cur = controlAt(scene.territories, t).get(iso);
  const curFac = cur ? scene.factions.find((f) => f.id === cur.faction) : undefined;

  return (
    <>
      <div className="card-info">
        <h4>{name}</h4>
        <div className="muted small">Código {iso}</div>
        <div style={{ marginTop: 8 }}>
          Controle agora:{' '}
          {curFac ? (
            <span className="chip" style={{ color: '#fff', background: curFac.color }}>
              {curFac.name}
            </span>
          ) : (
            <span className="chip">ninguém</span>
          )}
        </div>
      </div>
      <div className="h">Pintar com</div>
      {scene.factions.map((f) => (
        <button
          key={f.id}
          className={`btn${selFaction === f.id ? ' primary' : ''}`}
          style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }}
          onClick={() => paintCountry(iso, name, f.id)}
        >
          <span className="dot" style={{ background: f.color }} />
          {f.name}
        </button>
      ))}
      <p className="muted small">Vale a partir do instante atual ({clockParts(scene, t).main}).</p>
    </>
  );
}
