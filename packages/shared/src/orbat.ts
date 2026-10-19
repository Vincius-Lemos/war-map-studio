import type { Scene, Unit } from './scene.ts';

/* Organização de comando (ORBAT): árvore de unidades a partir de Unit.parentId.
   Funções puras: nunca alteram a entrada. */

export interface OrbatNode {
  unit: Unit;
  children: OrbatNode[];
}

export type SetParentResult = { ok: true; scene: Scene } | { ok: false; error: string };

const byName = (a: Unit, b: Unit) => a.name.localeCompare(b.name, 'pt-BR');

/* Pai efetivo de cada unidade: o parentId se existir e não fechar ciclo; senão, raiz (null).
   As unidades são decididas na ordem da lista; um vínculo que fecharia ciclo vira raiz. */
function effectiveParents(units: readonly Unit[]): Map<string, string | null> {
  const ids = new Set(units.map((u) => u.id));
  const parents = new Map<string, string | null>();
  for (const u of units) {
    let p: string | null = u.parentId !== undefined && u.parentId !== u.id && ids.has(u.parentId) ? u.parentId : null;
    /* Sobe pelos pais já decididos (formam uma floresta); se chegar em u, haveria ciclo. */
    for (let cur = p; cur !== null; cur = parents.get(cur) ?? null) {
      if (cur === u.id) {
        p = null;
        break;
      }
    }
    parents.set(u.id, p);
  }
  return parents;
}

/* Monta a árvore; irmãos ordenados por nome. Pai inexistente ou ciclo: a unidade vira raiz. */
export function buildOrbatTree(units: readonly Unit[]): OrbatNode[] {
  const parents = effectiveParents(units);
  const nodes = new Map<string, OrbatNode>();
  for (const u of units) nodes.set(u.id, { unit: u, children: [] });

  const roots: OrbatNode[] = [];
  for (const u of units) {
    const node = nodes.get(u.id);
    if (!node) continue;
    const p = parents.get(u.id) ?? null;
    const parent = p === null ? undefined : nodes.get(p);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (list: OrbatNode[]) => {
    list.sort((a, b) => byName(a.unit, b.unit));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/* A unidade e todos os descendentes (subordinados diretos e indiretos). Vazio se a unidade não existe. */
export function subtreeIds(units: readonly Unit[], unitId: string): string[] {
  if (!units.some((u) => u.id === unitId)) return [];
  const out: string[] = [unitId];
  const seen = new Set<string>(out);
  for (const id of out) {
    for (const u of units) {
      if (u.parentId === id && !seen.has(u.id)) {
        seen.add(u.id);
        out.push(u.id);
      }
    }
  }
  return out;
}

/* Quantas unidades cada força tem. */
export function countByFaction(units: readonly Unit[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of units) out[u.faction] = (out[u.faction] ?? 0) + 1;
  return out;
}

/* Define o superior de uma unidade (null = tira da hierarquia, vira raiz).
   Recusa: unidade ou superior inexistente, superior de outra força, ou vínculo que crie ciclo. */
export function setParent(scene: Scene, unitId: string, parentId: string | null): SetParentResult {
  const unit = scene.units.find((u) => u.id === unitId);
  if (!unit) return { ok: false, error: 'Unidade não encontrada.' };

  if (parentId !== null) {
    const parent = scene.units.find((u) => u.id === parentId);
    if (!parent) return { ok: false, error: 'Unidade superior não encontrada.' };
    if (parent.faction !== unit.faction) return { ok: false, error: `${parent.name} é de outra força.` };
    if (subtreeIds(scene.units, unitId).includes(parentId)) {
      return { ok: false, error: 'Isso criaria um ciclo na hierarquia.' };
    }
  }

  const units = scene.units.map((u) => {
    if (u.id !== unitId) return u;
    if (parentId === null) {
      const next: Unit = { ...u };
      delete next.parentId;
      return next;
    }
    return { ...u, parentId };
  });
  return { ok: true, scene: { ...scene, units } };
}
