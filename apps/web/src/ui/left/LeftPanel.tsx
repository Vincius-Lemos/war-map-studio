import { FactionsSection } from './FactionsSection.tsx';
import { ToolsSection } from './ToolsSection.tsx';
import { UnitsSection } from './UnitsSection.tsx';
import { ArrowsSection, EventsSection, TerritorySection } from './ListsSection.tsx';
import { Section } from './Section.tsx';
import { OrbatTree } from '../orbat/OrbatTree.tsx';
import { RoutePanel, type RoutePlanView } from '../planning/RoutePanel.tsx';
import { useOverlay } from '../../app/overlayState.ts';

/* Funções estáveis: o painel de planejamento só recalcula quando o usuário muda algo. */
const requestMapPoint = (onPick: (p: { lat: number; lon: number }) => void) => useOverlay.getState().setPick(onPick);
const onPlanChange = (view: RoutePlanView) => useOverlay.getState().setPlan(view);

/* Painel esquerdo: ferramentas, forças, unidades, organização, planejamento, setas, eventos e controle territorial. */
export function LeftPanel() {
  return (
    <aside className="side" aria-label="Ferramentas e listas">
      <ToolsSection />
      <FactionsSection />
      <UnitsSection />
      <Section title="Organização (ORBAT)">
        <OrbatTree />
      </Section>
      <Section title="Planejar movimento">
        <RoutePanel requestMapPoint={requestMapPoint} onChange={onPlanChange} />
      </Section>
      <ArrowsSection />
      <EventsSection />
      <TerritorySection />
    </aside>
  );
}
