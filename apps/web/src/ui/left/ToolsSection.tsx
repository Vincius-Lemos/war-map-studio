import { useStore } from '../../state/store.ts';
import { MODES } from '../../app/modes.ts';
import { pickFile, readFileDataURL } from '../../app/io.ts';
import { Section } from './Section.tsx';

/* Ferramentas (com atalhos V M P A E C) e as opções do modo Pintar. */
export function ToolsSection() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <Section title="Ferramentas" defaultOpen>
      <div className="tools">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`tool${mode === m.id ? ' on' : ''}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
            aria-pressed={mode === m.id}
          >
            <b>{m.label}</b>
            <kbd>{m.key}</kbd>
            <small>{m.id === 'select' ? 'Padrão' : ''}</small>
          </button>
        ))}
      </div>
      {mode === 'paint' && <PaintOptions />}
      <div className="small muted" style={{ marginTop: 8 }}>
        Atalhos: <b>V M P A E C</b> trocam a ferramenta · <b>1–9 0</b> colocam unidades · <b>Esc</b> cancela · <b>Espaço</b> play · <b>←/→</b> ±1 h · <b>Del</b> apaga o selecionado
      </div>
    </Section>
  );
}

function PaintOptions() {
  const level = useStore((s) => s.paintLevel);
  const setLevel = useStore((s) => s.setPaintLevel);
  const paintFlag = useStore((s) => s.paintFlag);
  const setPaintFlag = useStore((s) => s.setPaintFlag);
  const orgFlags = useStore((s) => s.scene.orgFlags);
  const addOrgFlag = useStore((s) => s.addOrgFlag);

  const uploadOrgFlag = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    const name = window.prompt('Nome da organização (ex.: nome do grupo):', 'Organização');
    if (!name?.trim()) return;
    addOrgFlag(name, await readFileDataURL(file));
  };

  return (
    <>
      <div className="h" style={{ marginTop: 12 }}>
        Pintar
      </div>
      <div className="grid2">
        <button className={`btn sm${level === 'country' ? ' primary' : ''}`} onClick={() => setLevel('country')}>
          País inteiro
        </button>
        <button className={`btn sm${level === 'region' ? ' primary' : ''}`} onClick={() => setLevel('region')}>
          Estado / região
        </button>
      </div>
      <label className="field">
        <span>Bandeira ao pintar</span>
        <select value={paintFlag ?? ''} onChange={(e) => setPaintFlag(e.target.value || null)}>
          <option value="">Bandeira oficial do país</option>
          {orgFlags.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <button className="btn sm" onClick={() => void uploadOrgFlag()}>
        + Bandeira de organização
      </button>
      <p className="muted small">
        Regiões usam a bandeira do país, a menos que você escolha uma bandeira de organização (por exemplo, a de um grupo que
        controla aquela área).
      </p>
    </>
  );
}
