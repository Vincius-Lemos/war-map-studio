import { FactionsSection } from './FactionsSection.tsx';
import { ToolsSection } from './ToolsSection.tsx';
import { UnitsSection } from './UnitsSection.tsx';
import { ArrowsSection, EventsSection, TerritorySection } from './ListsSection.tsx';

/* Painel esquerdo: ferramentas, forças, unidades, setas, eventos e controle territorial. */
export function LeftPanel() {
  return (
    <aside className="side" aria-label="Ferramentas e listas">
      <ToolsSection />
      <FactionsSection />
      <UnitsSection />
      <ArrowsSection />
      <EventsSection />
      <TerritorySection />
    </aside>
  );
}
