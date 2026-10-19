import { createRoot } from 'react-dom/client';
import { App } from '../ui/App.tsx';
import '../ui/styles.css';
import { useStore } from '../state/store.ts';
import { createSaver } from '../state/persist.ts';
import { startTicker } from '../time/ticker.ts';
import { installKeyboard } from './keyboard.ts';
import { installExportApi } from './exportWindow.ts';
import { loadCountries } from './geo.ts';

/* Inicialização: modo de exportação ou editor, relógio, teclado, persistência e lista de países. */
const exportMode = new URLSearchParams(location.search).has('export');
useStore.setState({ exportMode, dialog: exportMode ? null : 'wiz' });

if (exportMode) {
  /* na exportação só o mapa aparece no quadro: a interface é escondida pelo CSS (.export-mode) */
  document.documentElement.classList.add('export-mode');
  installExportApi();
} else {
  const save = createSaver(() =>
    useStore.getState().toast('Não consegui salvar no navegador (cena grande). Use “Salvar”.', 'warn'),
  );
  useStore.subscribe((s, p) => {
    if (s.scene !== p.scene) save(s.scene);
  });
}

startTicker(useStore);
installKeyboard();

loadCountries()
  .then((list) => useStore.getState().setCountries(list))
  .catch(() => useStore.getState().toast('Não consegui carregar a lista de países (verifique a internet).', 'err', 7000));

const root = document.getElementById('root');
if (!root) throw new Error('elemento #root não encontrado');
createRoot(root).render(<App />);
