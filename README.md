# MAP-DRAW (Mapa Tático)

Ferramenta para desenhar movimentos militares, avanços e controle de territórios em mapas, com linha do tempo, bandeiras e exportação de vídeo.

## Estrutura

```
packages/shared/   contrato da cena (tipos) — usado por todos
apps/web/          editor no navegador (TypeScript + Vite + MapLibre + deck.gl)
apps/server/       API Node (Fastify): dados, cenas e servir o site
apps/export/       exportador de vídeo (Playwright + ffmpeg, 30 fps)
data/              scripts Node que preparam os contornos (países, regiões, bandeiras)
```

## Requisitos

- Node.js 20+ (LTS)
- ffmpeg no PATH (para exportar vídeo)

## Comandos (a definir conforme os apps forem criados)

```
npm install
npm run dev -w apps/web
npm run dev -w apps/server
npm run export -w apps/export -- <arquivo-da-cena.json>
```

## Formato da cena

Veja `packages/shared/src/scene.ts`. A cena é um JSON com o título, a data de início, a duração em horas, as forças, as unidades (com trajeto por instante), as setas, os eventos e o controle territorial.
