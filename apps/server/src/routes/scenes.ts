import type { FastifyInstance } from 'fastify';
import { SCENE_ID, SceneStore } from '../storage/scenes.js';
import { validateScene } from '../scene-validation.js';
import { requireWriteToken } from '../security.js';

export interface SceneRoutesOptions {
  store: SceneStore;
  adminToken: string | null;
}

export async function sceneRoutes(app: FastifyInstance, opts: SceneRoutesOptions): Promise<void> {
  const { store } = opts;
  const writeAuth = requireWriteToken(opts.adminToken);
  const badId = { error: 'Id de cena inválido' };

  app.get('/api/scenes', async () => store.list());

  app.get<{ Params: { id: string } }>('/api/scenes/:id', async (req, reply) => {
    if (!SCENE_ID.test(req.params.id)) return reply.code(400).send(badId);
    const rec = await store.get(req.params.id);
    if (!rec) return reply.code(404).send({ error: 'Cena não encontrada' });
    return rec;
  });

  // Criação com id gerado (o editor pode também usar PUT com um id próprio).
  app.post('/api/scenes', { preHandler: writeAuth }, async (req, reply) => {
    const v = await validateScene(req.body);
    if (!v.ok) return reply.code(400).send({ error: 'Cena inválida', details: v.errors });
    const id = await store.newId(v.scene.title ?? '');
    const rec = await store.save(id, v.scene);
    return reply.code(201).send(rec);
  });

  app.put<{ Params: { id: string } }>('/api/scenes/:id', { preHandler: writeAuth }, async (req, reply) => {
    const id = req.params.id;
    if (!SCENE_ID.test(id)) return reply.code(400).send(badId);
    const v = await validateScene(req.body);
    if (!v.ok) return reply.code(400).send({ error: 'Cena inválida', details: v.errors });
    const created = !(await store.exists(id));
    const rec = await store.save(id, v.scene);
    return reply.code(created ? 201 : 200).send(rec);
  });

  app.delete<{ Params: { id: string } }>('/api/scenes/:id', { preHandler: writeAuth }, async (req, reply) => {
    if (!SCENE_ID.test(req.params.id)) return reply.code(400).send(badId);
    const ok = await store.remove(req.params.id);
    if (!ok) return reply.code(404).send({ error: 'Cena não encontrada' });
    return reply.code(204).send();
  });
}
