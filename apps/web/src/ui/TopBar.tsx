import { useStore } from '../state/store.ts';
import { CommitInput } from './fields/CommitInput.tsx';
import { openSceneFile, sceneToJSON } from '../app/io.ts';
import { exportPngFile } from '../app/exporter.ts';

export function TopBar() {
  const title = useStore((s) => s.scene.title);
  const setTitle = useStore((s) => s.setTitle);
  const openDialog = useStore((s) => s.openDialog);
  const scene = useStore((s) => s.scene);

  return (
    <header className="top">
      <div className="brand">
        <span className="logo">▲</span>Mapa Tático
      </div>
      <CommitInput
        className="title-input"
        aria-label="Nome da cena"
        title="Nome da cena"
        value={title}
        onCommit={setTitle}
      />
      <div className="spacer" />
      <button className="btn ghost" onClick={() => openDialog('wiz')} title="Escolher um novo ponto de partida (N)">
        ＋ Novo mapa
      </button>
      <button className="btn ghost" onClick={() => openDialog('ai')} title="Criar a cena descrevendo com IA">
        ✦ Criar com IA
      </button>
      <button className="btn ghost" onClick={() => void openSceneFile()} title="Abrir um arquivo JSON">
        Abrir
      </button>
      <button className="btn ghost" onClick={() => sceneToJSON(scene)} title="Salvar a cena em JSON">
        Salvar
      </button>
      <button className="btn ghost" onClick={() => void exportPngFile()} title="Exportar a tela atual como imagem">
        PNG
      </button>
      <button className="btn primary" onClick={() => openDialog('export')} title="Gravar a animação em vídeo">
        Exportar vídeo
      </button>
    </header>
  );
}
