import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  emptyHistory,
  recordChange,
  redoStep,
  undoStep,
  type History,
} from './history.ts';

type S = { n: number; items: string[] };

/* Aplica uma alteração e registra o estado anterior. Devolve o novo estado e o histórico. */
function apply(h: History<S>, cur: S, next: S, opts: { key?: string; now: number }): { h: History<S>; cur: S } {
  return { h: recordChange(h, cur, { key: opts.key, now: opts.now }), cur: next };
}

test('desfazer e refazer restauram exatamente cada estado anterior', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  const seen: S[] = [cur];
  for (let i = 1; i <= 5; i++) {
    const next: S = { n: i, items: [...cur.items, `item${i}`] };
    ({ h, cur } = apply(h, cur, next, { now: i * 10_000 }));
    seen.push(cur);
  }
  // desfaz tudo
  for (let i = 4; i >= 0; i--) {
    const r = undoStep(h, cur);
    assert.ok(r);
    h = r.history;
    cur = r.value;
    assert.deepEqual(cur, seen[i]);
  }
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), true);
  // refaz tudo
  for (let i = 1; i <= 5; i++) {
    const r = redoStep(h, cur, 0);
    assert.ok(r);
    h = r.history;
    cur = r.value;
    assert.deepEqual(cur, seen[i]);
  }
  assert.equal(canRedo(h), false);
});

test('nova alteração depois de desfazer apaga o refazer', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  ({ h, cur } = apply(h, cur, { n: 1, items: [] }, { now: 0 }));
  ({ h, cur } = apply(h, cur, { n: 2, items: [] }, { now: 20_000 }));
  const u = undoStep(h, cur);
  assert.ok(u);
  h = recordChange(u.history, u.value, { now: 30_000 });
  assert.equal(canRedo(h), false);
  assert.equal(redoStep(h, u.value, 0), null);
});

test('alterações contínuas com a mesma chave viram uma única entrada', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  // arrastar: 30 movimentos, a cada 16 ms
  for (let i = 1; i <= 30; i++) {
    ({ h, cur } = apply(h, cur, { n: i, items: [] }, { key: 'move:u1', now: i * 16 }));
  }
  assert.equal(h.past.length, 1);
  const r = undoStep(h, cur);
  assert.ok(r);
  assert.deepEqual(r.value, { n: 0, items: [] });
});

test('noMerge abre entrada nova e as alterações seguintes voltam a agrupar nela', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  ({ h, cur } = apply(h, cur, { n: 1, items: [] }, { key: 'move:u1', now: 0 }));
  ({ h, cur } = apply(h, cur, { n: 2, items: [] }, { key: 'move:u1', now: 16 }));
  // novo arrasto do mesmo objeto logo em seguida: entrada própria
  h = recordChange(h, cur, { key: 'move:u1', now: 2000, noMerge: true });
  cur = { n: 3, items: [] };
  ({ h, cur } = apply(h, cur, { n: 4, items: [] }, { key: 'move:u1', now: 2016 }));
  assert.equal(h.past.length, 2);
  const r = undoStep(h, cur);
  assert.deepEqual(r?.value, { n: 2, items: [] });
});

test('chaves diferentes ou pausa maior que COALESCE_MS criam entradas separadas', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  ({ h, cur } = apply(h, cur, { n: 1, items: [] }, { key: 'move:u1', now: 0 }));
  ({ h, cur } = apply(h, cur, { n: 2, items: [] }, { key: 'move:u2', now: 10 }));
  assert.equal(h.past.length, 2);
  ({ h, cur } = apply(h, cur, { n: 3, items: [] }, { key: 'move:u2', now: 10 + COALESCE_MS + 1 }));
  assert.equal(h.past.length, 3);
});

test('a janela de agrupamento desliza: pequenas pausas seguidas continuam na mesma entrada', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  for (let i = 1; i <= 10; i++) {
    ({ h, cur } = apply(h, cur, { n: i, items: [] }, { key: 'nudge', now: i * (COALESCE_MS - 100) }));
  }
  assert.equal(h.past.length, 1);
});

test('sem chave, cada alteração é uma entrada', () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  for (let i = 1; i <= 3; i++) ({ h, cur } = apply(h, cur, { n: i, items: [] }, { now: 0 }));
  assert.equal(h.past.length, 3);
});

test(`o histórico guarda no máximo ${HISTORY_LIMIT} passos e desfaz até o limite`, () => {
  let h = emptyHistory<S>();
  let cur: S = { n: 0, items: [] };
  const total = HISTORY_LIMIT + 50;
  for (let i = 1; i <= total; i++) ({ h, cur } = apply(h, cur, { n: i, items: [] }, { now: i }));
  assert.equal(h.past.length, HISTORY_LIMIT);
  let undone = 0;
  for (;;) {
    const r = undoStep(h, cur);
    if (!r) break;
    h = r.history;
    cur = r.value;
    undone++;
  }
  assert.equal(undone, HISTORY_LIMIT);
  // o passo mais antigo que restou é o estado depois da alteração 50
  assert.equal(cur.n, total - HISTORY_LIMIT);
});

test('o estado é imutável: os snapshots guardados não mudam com as alterações seguintes', () => {
  let h = emptyHistory<S>();
  const a: S = { n: 1, items: ['x'] };
  let cur: S = a;
  ({ h, cur } = apply(h, cur, { n: 2, items: ['x', 'y'] }, { now: 0 }));
  assert.deepEqual(h.past[0]?.value, { n: 1, items: ['x'] });
  assert.equal(cur.items.length, 2);
  const r = undoStep(h, cur);
  assert.equal(r?.value, a);
});
