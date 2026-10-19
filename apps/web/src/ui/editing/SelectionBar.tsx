import { Fragment, useState } from 'react';
import { ALIGN_LABELS, type AlignMode } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { keyLabel } from '../../app/keyboard.ts';
import './editing.css';

/* Barra flutuante de edição, sobre o mapa: desfazer, refazer, copiar, colar, duplicar, alinhar, apagar. */

const ALIGN_ORDER: AlignMode[] = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom', 'dist-h', 'dist-v'];

/* Traços dos ícones (estilo de linha, 24x24). */
const ICON = {
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  copy: ['M9 9h11v11H9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  paste: ['M8 2h8v4H8z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'],
  duplicate: ['M12 5v14', 'M5 12h14'],
  align: ['M3 2v20', 'M8 6h13', 'M8 12h9', 'M8 18h11'],
  trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'],
} as const;

function Icon({ d }: { d: readonly string[] }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

interface ToolProps {
  label: string;
  shortcut?: string;
  icon: readonly string[];
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  expanded?: boolean;
}

function Tool({ label, shortcut, icon, onClick, disabled, danger, expanded }: ToolProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className={`btn ed-btn${danger ? ' danger' : ''}`}
      title={title}
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon d={icon} />
    </button>
  );
}

export function SelectionBar() {
  const count = useStore((s) => s.selected.filter((x) => x.kind === 'unit' || x.kind === 'arrow' || x.kind === 'event').length);
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const hasClip = useStore((s) => s.clip !== null);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const copySelection = useStore((s) => s.copySelection);
  const pasteClipboard = useStore((s) => s.pasteClipboard);
  const duplicateSelection = useStore((s) => s.duplicateSelection);
  const alignSelection = useStore((s) => s.alignSelection);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const openDialog = useStore((s) => s.openDialog);
  const [alignOpen, setAlignOpen] = useState(false);

  const hasSel = count > 0;
  const unitCount = useStore((s) => s.selected.filter((x) => x.kind === 'unit').length);

  return (
    <div className="selbar" role="toolbar" aria-label="Edição">
      <Tool label="Desfazer" shortcut={keyLabel('undo')} icon={ICON.undo} onClick={undo} disabled={!canUndo} />
      <Tool label="Refazer" shortcut={keyLabel('redo')} icon={ICON.redo} onClick={redo} disabled={!canRedo} />
      <span className="selbar-sep" />
      <span className="selbar-count" aria-live="polite">
        {hasSel ? `${count} ${count === 1 ? 'selecionado' : 'selecionados'}` : 'Nada selecionado'}
      </span>
      <Tool label="Copiar" shortcut={keyLabel('copy')} icon={ICON.copy} onClick={copySelection} disabled={!hasSel} />
      <Tool label="Colar" shortcut={keyLabel('paste')} icon={ICON.paste} onClick={pasteClipboard} disabled={!hasClip} />
      <Tool label="Duplicar" shortcut={keyLabel('duplicate')} icon={ICON.duplicate} onClick={duplicateSelection} disabled={!hasSel} />
      <div className="selbar-align">
        <Tool
          label="Alinhar e distribuir (unidades, neste instante)"
          icon={ICON.align}
          onClick={() => setAlignOpen((o) => !o)}
          disabled={unitCount < 2}
          expanded={alignOpen}
        />
        {alignOpen && (
          <div className="selbar-menu" role="menu" aria-label="Alinhar e distribuir">
            {ALIGN_ORDER.map((m) => (
              <Fragment key={m}>
                {m === 'dist-h' && <div className="menu-sep" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={m === 'dist-h' || m === 'dist-v' ? unitCount < 3 : unitCount < 2}
                  onClick={() => {
                    setAlignOpen(false);
                    alignSelection(m);
                  }}
                >
                  {ALIGN_LABELS[m]}
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </div>
      <Tool label="Apagar" shortcut={keyLabel('delete')} icon={ICON.trash} onClick={deleteSelected} disabled={!hasSel} danger />
      <span className="selbar-sep" />
      <Tool label="Atalhos de teclado" shortcut="?" icon={['M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7', 'M12 17h.01']} onClick={() => openDialog('help')} />
    </div>
  );
}
