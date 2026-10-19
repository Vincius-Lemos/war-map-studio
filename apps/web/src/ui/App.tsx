import { useStore } from '../state/store.ts';
import { TopBar } from './TopBar.tsx';
import { LeftPanel } from './left/LeftPanel.tsx';
import { RightPanel } from './right/RightPanel.tsx';
import { MapView } from './MapView.tsx';
import { MapOverlay } from './MapOverlay.tsx';
import { MeasureTool } from './measure/MeasureTool.tsx';
import { LayersPanel } from './layers/LayersPanel.tsx';
import { Timeline } from './timeline/Timeline.tsx';
import { Toasts } from './Toasts.tsx';
import { StartWizard } from './dialogs/StartWizard.tsx';
import { AiDialog } from './dialogs/AiDialog.tsx';
import { ExportDialog } from './dialogs/ExportDialog.tsx';
import { SelectionBar } from './editing/SelectionBar.tsx';
import { HelpDialog } from './editing/HelpDialog.tsx';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <LeftPanel />
      <main className="stage">
        <MapView />
        <MapOverlay />
        <MeasureTool />
        <LayersPanel />
        <SelectionBar />
      </main>
      <RightPanel />
      <Timeline />
      <Dialogs />
      <Toasts />
    </div>
  );
}

function Dialogs() {
  const dialog = useStore((s) => s.dialog);
  if (dialog === 'wiz') return <StartWizard />;
  if (dialog === 'ai') return <AiDialog />;
  if (dialog === 'export') return <ExportDialog />;
  if (dialog === 'help') return <HelpDialog />;
  return null;
}
