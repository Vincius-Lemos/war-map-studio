# @map-draw/server

API Node (TypeScript, ESM, Fastify 5) do Mapa Tático. Faz quatro coisas:

1. Serve o site estático (`apps/web/dist`, build do Vite).
2. Serve os dados geográficos gerados em `data/out`.
3. Guarda as cenas em arquivos JSON (`storage/scenes/<id>.json`).
4. Exporta cenas para vídeo (`webm` ou `mp4`) usando `@map-draw/export`, em fila.

## Comandos

```
npm run dev     -w apps/server   # tsx watch
npm start       -w apps/server   # tsx src/index.ts (produção, Node 22+)
npm test        -w apps/server   # node:test + Fastify inject
npm run typecheck -w apps/server
```

Requisitos: Node 22+ e ffmpeg no PATH (para a exportação).

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8787` | Porta HTTP. |
| `HOST` | `0.0.0.0` | Interface de escuta. |
| `BASE_PATH` | (vazio) | Prefixo público, ex.: `/mapas`. Todas as rotas ficam sob ele. |
| `WEB_DIST` | `../web/dist` | Pasta do build do site (relativa a `apps/server`). |
| `GEO_DIR` | `../../data/out` | Pasta com `countries.json` e `admin1/<ISO3>.json`. |
| `SCENES_DIR` | `storage/scenes` | Onde ficam as cenas. |
| `EXPORTS_DIR` | `storage/exports` | Arquivos temporários das exportações (apagados após 1 hora). |
| `ADMIN_TOKEN` | (vazio) | Se definido, POST/PUT/DELETE de cenas exigem o header `X-Token` igual a ele. Vazio = escrita aberta. |
| `CORS_ORIGIN` | (vazio) | Origens extras permitidas, separadas por vírgula. O próprio host é sempre aceito. |
| `TRUST_PROXY` | `loopback` | Confia em `X-Forwarded-For` vindo do Caddy (loopback) para o rate limit. |
| `EXPORT_MAX_PENDING` | `4` | Tamanho máximo da fila de exportação; acima disso responde 429. |
| `EXPORT_TIMEOUT_MS` | `1800000` | Tempo máximo por exportação. |
| `EXPORT_RATE_LIMIT` | `6` | Requisições por minuto, por IP, em `POST /api/export`. |
| `LOG_LEVEL` | `info` | Nível do pino. Cabeçalhos `x-token`, `authorization` e `cookie` são censurados nos logs. |

## Rotas

Todas as rotas estão sob `BASE_PATH` (ex.: com `BASE_PATH=/mapas`, `GET /mapas/api/health`).

**Site**
- `GET /` e páginas do app: `index.html` com `Cache-Control: no-cache`; cai no index para rotas do cliente.
- `GET /assets/*` (nomes com hash): `Cache-Control: public, max-age=31536000, immutable`.
- Asset inexistente: 404 JSON (nunca o index).

**Geo**
- `GET /api/geo/countries.json`: gzip (quando aceito), `Cache-Control: public, max-age=604800`, ETag e 304.
- `GET /api/geo/admin1/:iso3.json`: `:iso3` precisa casar com `^[A-Z]{3}$`, senão 404. Arquivo ausente: 404 JSON.

**Cenas**
- `GET /api/scenes`: lista `[{ id, title, updatedAt }]`, mais recente primeiro.
- `GET /api/scenes/:id`: `{ id, title, updatedAt, scene }`.
- `POST /api/scenes`: cria com id gerado (slug do título + timestamp). Corpo = cena. Responde 201 com o registro.
- `PUT /api/scenes/:id`: cria ou atualiza com o id dado. Corpo = cena. 201 se criou, 200 se atualizou.
- `DELETE /api/scenes/:id`: 204, ou 404 se não existir.
- Escritas exigem `X-Token` quando `ADMIN_TOKEN` está definido (401 caso contrário).
- Corpo máximo: 20 MB (413 acima disso).
- A validação usa `validateScene` de `packages/shared/src/validate.ts`. Erros voltam em `details` (400).

**Exportação**
- `POST /api/export` com `{ "sceneId": "...", "seconds": 12, "format": "webm" }` ou `{ "scene": {...}, ... }`.
  - 202 com `{ jobId, status, statusUrl, fileUrl }` e header `Location`.
  - 501 enquanto `@map-draw/export` não exportar `exportScene`.
  - 429 se a fila estiver cheia ou se o IP passou do limite.
  - `seconds` vai de 0 até 3600.
- `GET /api/export/:jobId`: `status` é `queued`, `running`, `done` ou `error`. Erros aparecem como "Falha na exportação", sem detalhes internos.
- `GET /api/export/:jobId/file`: o vídeo, com `Content-Disposition: attachment`. 409 se ainda não estiver pronto.

Contrato com o exportador (`apps/export`): `export async function exportScene({ scene, seconds, format, outputPath }): Promise<void>`. Ele grava o vídeo em `outputPath`.

**Saúde**
- `GET /api/health`: `{ "ok": true }`.

## Segurança

- Cabeçalhos: `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`. Sem CSP, para não quebrar o mapa; se quiser, adicione no Caddy.
- CORS: sem `Origin` não há cabeçalhos CORS. Com `Origin`, só são aceitos o host da requisição e a lista `CORS_ORIGIN`.
- Erros 5xx voltam como `{"error":"Erro interno"}`; o detalhe fica só no log.
- Ids de cena e de job são validados por regex, sem traversal de caminho.

## Configuração do Caddy

O Caddy repassa `/mapas/*` sem remover o prefixo (por isso `handle`, e não `handle_path`):

```caddy
motorimoderni.duckdns.org {
    # ... demais rotas do site ...

    handle /mapas/* {
        reverse_proxy 127.0.0.1:8787
    }
}
```

No servidor, rode com `BASE_PATH=/mapas`.

O build do site precisa usar o mesmo prefixo: `base: '/mapas/'` na configuração do Vite. O cliente deve chamar a API como `/mapas/api/...`. Com isso, `index.html` e os assets já apontam para o caminho certo.

## Limitações conhecidas

- A fila de exportação roda na memória: um reinício perde os jobs pendentes (os arquivos prontos ficam em `EXPORTS_DIR`).
- Se uma exportação estourar `EXPORT_TIMEOUT_MS`, o job vira erro e a fila segue, mas o processo do exportador pode continuar rodando em segundo plano.
- A listagem de cenas lê todos os arquivos. Para muitas cenas grandes, vale um índice.
