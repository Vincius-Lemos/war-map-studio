import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const ISO3 = /^[A-Z]{3}$/;

/** Cache longo para dados geográficos (mudam raramente; o ETag valida após expirar). */
const GEO_CACHE = 'public, max-age=604800, stale-while-revalidate=86400';

async function sendJsonFile(
  req: FastifyRequest,
  reply: FastifyReply,
  file: string,
  notFound: string,
): Promise<FastifyReply> {
  let st: fs.Stats;
  try {
    st = await fs.promises.stat(file);
  } catch {
    return reply.code(404).send({ error: notFound });
  }
  if (!st.isFile()) return reply.code(404).send({ error: notFound });

  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  reply.header('Cache-Control', GEO_CACHE);
  reply.header('ETag', etag);
  reply.type('application/json; charset=utf-8');
  if (req.headers['if-none-match'] === etag) return reply.code(304).send();
  // O plugin @fastify/compress faz o gzip quando o cliente aceita.
  return reply.send(fs.createReadStream(file));
}

export interface GeoOptions {
  geoDir: string;
}

export async function geoRoutes(app: FastifyInstance, opts: GeoOptions): Promise<void> {
  const root = path.resolve(opts.geoDir);

  app.get('/api/geo/countries.json', (req, reply) =>
    sendJsonFile(req, reply, path.join(root, 'countries.json'), 'Dados de países indisponíveis'),
  );

  app.get<{ Params: { iso3: string } }>('/api/geo/admin1/:iso3.json', (req, reply) => {
    const iso3 = req.params.iso3;
    if (!ISO3.test(iso3)) return reply.code(404).send({ error: 'País inválido' });
    return sendJsonFile(req, reply, path.join(root, 'admin1', `${iso3}.json`), 'Dados regionais não encontrados');
  });
}
