import { pickFile, readFileDataURL } from '../../app/io.ts';
import { useStore } from '../../state/store.ts';

/* Passo "Modo livre": tela em branco, ou começar com a sua própria imagem (calibrada depois nos cantos). */
export function FreeStep({ onBack }: { onBack: () => void }) {
  const newScene = useStore((s) => s.newScene);
  const setOverlay = useStore((s) => s.setOverlay);
  const toast = useStore((s) => s.toast);

  const withImage = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      const src = await readFileDataURL(file);
      newScene('free');
      setOverlay(src);
    } catch {
      toast('Não consegui ler esta imagem.', 'warn');
    }
  };

  return (
    <>
      <div className="h">Modo livre</div>
      <p className="muted small">Sem localização real. Use para mapas inventados ou sobre uma imagem sua.</p>
      <div className="foot">
        <button className="btn" onClick={onBack}>
          Voltar
        </button>
        <button className="btn" onClick={() => void withImage()}>
          Usar minha imagem
        </button>
        <button className="btn primary" onClick={() => newScene('free')}>
          Começar em branco
        </button>
      </div>
    </>
  );
}
