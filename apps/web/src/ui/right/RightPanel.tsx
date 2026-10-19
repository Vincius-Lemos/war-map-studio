import { useStore } from '../../state/store.ts';
import { CountryForm } from './CountryForm.tsx';
import { ArrowForm, EventForm } from './ArrowEventForms.tsx';
import { SceneForm } from './SceneForm.tsx';
import { UnitForm } from './UnitForm.tsx';

/* Painel direito: aba Selecionado (unidade, seta, evento ou país) e aba Cena. */
export function RightPanel() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <aside className="side right" aria-label="Propriedades">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'sel'} className={tab === 'sel' ? 'on' : ''} onClick={() => setTab('sel')}>
          Selecionado
        </button>
        <button role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? 'on' : ''} onClick={() => setTab('scene')}>
          Cena
        </button>
      </div>
      <div className="pane">{tab === 'scene' ? <SceneForm /> : <Selection />}</div>
    </aside>
  );
}

function Selection() {
  const sel = useStore((s) => s.sel);
  if (!sel) {
    return (
      <div className="empty" style={{ padding: '18px 4px' }}>
        <p>
          <b>Nada selecionado.</b>
        </p>
        <p>Clique numa unidade, seta, evento ou país no mapa, ou escolha uma unidade na lista à esquerda.</p>
        <p className="muted small">
          Dica: troque para a aba <b>Cena</b> para ajustar data, duração, estilo dos símbolos e área do mapa.
        </p>
      </div>
    );
  }
  switch (sel.kind) {
    case 'unit':
      return <UnitForm id={sel.id} />;
    case 'arrow':
      return <ArrowForm id={sel.id} />;
    case 'event':
      return <EventForm id={sel.id} />;
    case 'country':
      return <CountryForm iso={sel.id} />;
  }
}
