import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  ECHELON_MARK,
  UNIT_TYPE_LABELS,
  buildOrbatTree,
  countByFaction,
  setParent,
  type OrbatNode,
} from '@map-draw/shared';
import { useStore } from '../../state/store.ts';

/* Tipo MIME próprio: evita que o arrastar da árvore caia no mapa como arrastar de força ou de unidade. */
const DRAG_MIME = 'application/x-map-draw-orbat';
const ROOT_DROP = '__root__';

/* Árvore de comando (ORBAT): arraste uma unidade sobre outra para subordiná-la; solte na faixa de raiz para tirá-la. */
export function OrbatTree() {
  const units = useStore((s) => s.scene.units);
  const factions = useStore((s) => s.scene.factions);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  const toast = useStore((s) => s.toast);

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const tree = useMemo(() => buildOrbatTree(units), [units]);
  const counts = useMemo(() => countByFaction(units), [units]);

  const colorOf = (factionId: string) => factions.find((f) => f.id === factionId)?.color ?? '#888';

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* Define o superior pela store; a alteração de scene entra no histórico automaticamente. */
  const drop = (targetId: string | null) => {
    const id = dragId;
    setDragId(null);
    setOverId(null);
    if (!id || id === targetId) return;
    const res = setParent(useStore.getState().scene, id, targetId);
    if (!res.ok) {
      toast(res.error, 'warn');
      return;
    }
    useStore.setState({ scene: res.scene });
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData(DRAG_MIME, id);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  };

  const onDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  const allowDrop = (e: DragEvent<HTMLElement>, targetKey: string) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== targetKey) setOverId(targetKey);
  };

  const renderNodes = (nodes: OrbatNode[], depth: number): ReactNode[] =>
    nodes.flatMap((node) => {
      const u = node.unit;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(u.id);
      const on = sel?.kind === 'unit' && sel.id === u.id;
      const over = overId === u.id && dragId !== null && dragId !== u.id;
      const row = (
        <div
          key={u.id}
          className={`row-item${on ? ' on' : ''}`}
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={on}
          aria-expanded={hasChildren ? !isCollapsed : undefined}
          draggable
          onDragStart={(e) => onDragStart(e, u.id)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => allowDrop(e, u.id)}
          onDragLeave={() => {
            if (overId === u.id) setOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(u.id);
          }}
          onClick={() => select({ kind: 'unit', id: u.id })}
          style={{
            paddingLeft: 8 + depth * 16,
            opacity: dragId === u.id ? 0.4 : 1,
            outline: over ? '1px dashed var(--accent, #3b82f6)' : undefined,
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="orbat-toggle"
              aria-label={isCollapsed ? `Expandir ${u.name}` : `Recolher ${u.name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(u.id);
              }}
              style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', width: 14, padding: 0 }}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: 14 }} />
          )}
          <span className="dot" style={{ background: colorOf(u.faction) }} />
          <span className="nm">{u.name}</span>
          <span className="meta">
            {ECHELON_MARK[u.echelon]} {UNIT_TYPE_LABELS[u.type]}
          </span>
        </div>
      );
      if (hasChildren && !isCollapsed) return [row, ...renderNodes(node.children, depth + 1)];
      return [row];
    });

  const rootDrop = dragId !== null;

  return (
    <div className="orbat" role="tree" aria-label="Organização de comando">
      <div className="orbat-counts" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {factions.map((f) => (
          <span key={f.id} className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="dot" style={{ background: f.color }} />
            {f.name}: {counts[f.id] ?? 0}
          </span>
        ))}
      </div>
      {rootDrop && (
        <div
          className="empty"
          onDragOver={(e) => allowDrop(e, ROOT_DROP)}
          onDragLeave={() => {
            if (overId === ROOT_DROP) setOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(null);
          }}
          style={{
            outline: overId === ROOT_DROP ? '1px dashed var(--accent, #3b82f6)' : undefined,
          }}
        >
          Solte aqui para tirar da hierarquia (raiz).
        </div>
      )}
      {tree.length === 0 ? (
        <div className="empty">Nenhuma unidade.</div>
      ) : (
        renderNodes(tree, 0)
      )}
    </div>
  );
}
