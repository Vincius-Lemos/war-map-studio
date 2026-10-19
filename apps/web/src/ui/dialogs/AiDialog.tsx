import { useState } from 'react';
import { importSceneText } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { AI_PROMPT } from '../../app/prompt.ts';

/* Criar cena com IA: copiar as instruções, colar a resposta e importar (com validação). */
export function AiDialog() {
  const closeDialog = useStore((s) => s.closeDialog);
  const replaceScene = useStore((s) => s.replaceScene);
  const toast = useStore((s) => s.toast);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const copyPrompt = () => {
    navigator.clipboard
      .writeText(AI_PROMPT)
      .then(() => toast('Instruções copiadas. Cole na IA.', 'ok'))
      .catch(() => toast('Não consegui copiar. Selecione e copie.', 'warn'));
  };

  const importText = () => {
    const res = importSceneText(text);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    replaceScene(res.scene);
    closeDialog();
    toast(`Cena criada: ${res.scene.title}`, 'ok');
  };

  return (
    <div className="overlay">
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="aiTitle">
        <h2 id="aiTitle">Criar cena com IA</h2>
        <p className="lead">Três passos. A IA devolve um arquivo JSON, e a ferramenta valida antes de criar o mapa.</p>
        <div className="steps">
          <i className="on" />
          <i />
          <i />
        </div>
        <div className="grid2">
          <div>
            <div className="h">1 · Copie as instruções</div>
            <button className="btn primary" onClick={copyPrompt}>
              Copiar instruções para IA
            </button>
            <p className="muted small">
              Cole no ChatGPT, Claude ou outra IA e escreva embaixo o que aconteceu. Ex.: “Batalha do Avaí, 11/12/1868, o exército
              brasileiro…”.
            </p>
          </div>
          <div>
            <div className="h">2 · Cole a resposta da IA</div>
            <p className="muted small">Pode colar com ou sem texto em volta. A ferramenta acha o JSON sozinha.</p>
          </div>
        </div>
        <div className="h">3 · JSON</div>
        <textarea
          rows={11}
          style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}
          placeholder="{ ... }"
          aria-label="JSON da cena"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {errors.length > 0 && <div className="errs" role="alert">{errors.join('\n')}</div>}
        <div className="foot">
          <button className="btn" onClick={closeDialog}>
            Fechar
          </button>
          <button className="btn primary" onClick={importText}>
            Criar cena
          </button>
        </div>
      </div>
    </div>
  );
}
