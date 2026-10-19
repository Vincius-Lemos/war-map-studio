import { SHORTCUTS, MOUSE_HINTS, type ShortcutGroup } from '../../app/keyboard.ts';
import { useStore } from '../../state/store.ts';

/* Painel de ajuda (tecla ?): lista os atalhos a partir do registro em app/keyboard.ts. */

const GROUPS: ShortcutGroup[] = ['Geral', 'Tempo', 'Ferramentas', 'Seleção', 'Edição'];

export function HelpDialog() {
  const closeDialog = useStore((s) => s.closeDialog);

  return (
    <div className="overlay">
      <div className="dlg help" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
        <h2 id="helpTitle">Atalhos de teclado</h2>
        <p className="lead">Pressione ? para abrir ou fechar esta lista. Com um campo de texto em foco, as teclas digitam normalmente.</p>
        {GROUPS.map((g) => {
          const rows = [
            ...SHORTCUTS.filter((x) => x.group === g).map((x) => ({ keys: x.keys, label: x.label })),
            ...MOUSE_HINTS.filter((x) => x.group === g).map((x) => ({ keys: x.keys, label: x.label })),
          ];
          if (rows.length === 0) return null;
          return (
            <section key={g}>
              <h3>{g}</h3>
              <dl className="kbd-list">
                {rows.map((r) => (
                  <div className="kbd-row" key={r.keys + r.label}>
                    <dt>
                      <kbd>{r.keys}</kbd>
                    </dt>
                    <dd>{r.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
        <p className="muted small">
          Setas sem modificador controlam o tempo; por isso a seleção se move com Alt+setas. O histórico guarda até 100 passos.
        </p>
        <div className="foot">
          <button className="btn primary" onClick={closeDialog}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
