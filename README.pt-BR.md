# MAP-DRAW — Mapa Tático

[Read in English](README.md) · [Créditos e licenças](CREDITS.md)

Ferramenta no navegador para desenhar movimentos militares, avanços, controle territorial e animações de batalhas em mapas reais, com linha do tempo, bandeiras, mapas históricos por ano e exportação de vídeo (WebM/MP4 a 30 quadros por segundo).

## Recursos

- **Bases de mapa:** fronteiras reais dos países, ruas do OpenStreetMap para cidades e CEPs, tela livre ou sua própria imagem (calibrada no mapa).
- **Bandeiras:** cada país mostra a bandeira oficial; estados e províncias ocupados mostram a bandeira da força que os controla (ou de uma organização que você cadastrar).
- **Regiões:** estados e províncias com controle ao longo do tempo (não só países inteiros).
- **Unidades:** paleta com símbolos OTAN (APP-6), Pacto de Varsóvia, histórico e blocos; arraste para colocar; escalões de companhia a corpo.
- **Árvore ORBAT:** arraste uma unidade para subordiná-la a outra (ciclos e pais de outra força são recusados).
- **Planejamento de movimento:** alcance pela velocidade e pelas horas, e rota mínima numa malha hexagonal, com tempo estimado.
- **Névoa de guerra:** cada força vê apenas o que está perto das suas próprias unidades.
- **Modo apresentação:** percorre os eventos com a câmera e a linha do tempo sincronizadas.
- **Grades:** graticule de latitude e longitude, grade militar de referência aproximada (UTM de 100 km com subdivisão de 10 km) e grade personalizada, com encaixe opcional.
- **Edição:** seleção múltipla, desfazer e refazer (100 passos), copiar, colar e duplicar, alinhar e distribuir, atalhos de teclado (`?` abre a ajuda).
- **Medição e camadas:** régua geodésica com azimutes, medição de área e painel de camadas.
- **Mapas históricos:** escolha um ano e o contorno correspondente é carregado (o instantâneo anterior mais próximo quando não existe o ano exato).
- **Importação e exportação:** cenas em JSON; fluxo "Criar com IA" (copie as instruções, cole o JSON de volta, validado antes de importar).

## Estrutura do repositório

```
packages/shared/   contrato da cena e lógica pura (validação, tempo, histórico, grades, movimento, névoa, ORBAT)
apps/web/          editor (React + Zustand + Vite, MapLibre GL + deck.gl)
apps/server/       API em Node (Fastify): dados geográficos, cenas, fila de exportação, site estático
apps/export/       exportador de vídeo (Playwright + ffmpeg, 30 fps)
data/              scripts que preparam os contornos de países e regiões
```

## Requisitos

- Node.js 20+ (recomendado 22 LTS)
- ffmpeg no PATH (para exportar vídeo)
- Chromium para o Playwright (`npx playwright install chromium`)

## Como começar

```bash
npm install
npm test -w packages/shared          # testes da lógica compartilhada
npm run build -w apps/web            # compila o editor
npm run dev -w apps/web              # editor em modo de desenvolvimento
npm start -w apps/server             # API e site (PORT, BASE_PATH, WEB_DIST, GEO_DIR, ... veja apps/server/README.md)
npx tsx src/cli.ts cena.json --seconds 30 --format mp4 --out video.mp4 --base http://localhost:8787   # em apps/export
```

Para regenerar os contornos: `npm run build -w data`.

## Situação

Funcionando: o editor, as grades, a paleta de unidades, a ORBAT, o planejamento de movimento, a névoa de guerra, o modo apresentação, as bandeiras, o controle de regiões, desfazer e refazer, importação e exportação em JSON, a API do servidor e o pipeline de exportação de vídeo.

Limitações conhecidas:
- A grade militar (tipo MGRS) é uma aproximação, não o padrão oficial.
- Territórios que cruzam o meridiano 180° (ex.: Chukotka) não recebem bandeira.
- Os mapas históricos usam o instantâneo disponível mais próximo, não o ano exato.
- A exportação de vídeo depende de o navegador e o servidor terem Chromium e ffmpeg.

## Dados e créditos de terceiros

Veja [CREDITS.md](CREDITS.md) para todas as bibliotecas, bases de dados, serviços e projetos que inspiraram este trabalho, com as licenças. Dados de mapa: © colaboradores do OpenStreetMap (ODbL). Contornos: geoBoundaries (CC BY 4.0). Fronteiras históricas: aourednik/historical-basemaps (GPL-3.0), carregadas em tempo de execução do repositório original.

## Licença

Distribuído sob a [licença GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Contribuições são bem-vindas: abra uma issue ou um pull request.

Se você rodar uma versão modificada num servidor para outras pessoas usarem, a AGPL exige que você ofereça a elas o código-fonte modificado. Licenças comerciais, sem essas obrigações, estão disponíveis sob consulta.

A AGPL cobre só o código deste projeto. Dados de terceiros mantêm as próprias licenças (veja [CREDITS.md](CREDITS.md)). Nenhum código de terceiro foi copiado dos projetos de inspiração; apenas ideias foram aproveitadas.
