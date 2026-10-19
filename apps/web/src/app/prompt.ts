/* Instruções copiadas para a IA externa ("Criar com IA"). A resposta é um JSON que a ferramenta valida. */
export const AI_PROMPT = `Você vai montar uma cena para o "Mapa Tático". Responda SOMENTE com um JSON válido, sem texto antes ou depois, seguindo este formato:

{
  "title": "Nome da cena",
  "startDate": "2026-03-01T06:00",
  "durationH": 72,
  "mapType": "country",
  "region": {"lon0": 19, "lat0": 53.4, "lon1": 28.2, "lat1": 57.6},
  "symbolStyle": "nato",
  "unitSize": 1,
  "factions": [
    {"id": "f1", "name": "Exército Verde", "color": "#2e7d32", "affil": "hostile"},
    {"id": "f2", "name": "Exército Azul", "color": "#1565c0", "affil": "friend"}
  ],
  "territories": [
    {"iso": "LT", "name": "Lituânia", "t": 30, "faction": "f1"}
  ],
  "units": [
    {"id": "u1", "name": "1ª Divisão Blindada", "faction": "f1", "type": "arm", "echelon": "div", "note": "", "path": [{"t": 0, "lat": 53.9, "lon": 27.0}, {"t": 18, "lat": 55.2, "lon": 25.5}]}
  ],
  "arrows": [
    {"id": "a1", "from": {"lat": 54.0, "lon": 27.3}, "to": {"lat": 55.4, "lon": 24.6}, "t0": 18, "t1": 30, "kind": "attack", "faction": "f1"}
  ],
  "events": [
    {"id": "e1", "t": 30, "lat": 55.7, "lon": 24.3, "kind": "attack", "text": "Travessia da ponte", "dur": 3}
  ]
}

Regras:
- "t" e "durationH" são horas desde o início da cena (números). Use horas, não dias, para batalhas e operações de poucas horas.
- "mapType": "country" para avanços entre países; "tiles" para ruas de uma cidade ou batalha local (use "region" bem apertada, com a área do lugar).
- "affil": friend (amigo), hostile (inimigo), neutral ou unknown.
- "symbolStyle": nato (OTAN), pact (Pacto de Varsóvia), hist (histórico) ou block (blocos de wargame).
- "type": inf (infantaria), mech (mecanizada), motor (motorizada), arm (blindados), cav (cavalaria), art (artilharia), eng (engenharia), fort (fortificação), hq (comando), civ (milícia/civis).
- "echelon": co, bn, reg, bde, div, corps ou "" (nenhum).
- "kind" das setas: attack (avanço) ou withdraw (retirada). Eventos: attack (explosão) ou note (nota).
- "iso" é o código de 2 letras do país: LT Lituânia, LV Letônia, PL Polônia, BY Bielorrússia, RU Rússia, UA Ucrânia, DE Alemanha, FR França, BR Brasil, AR Argentina, PY Paraguai, UY Uruguai, ZW Zimbábue, MN Mongólia.
- Use coordenadas decimais reais e aproximadas. Dê um id único a cada força, unidade, seta e evento.
- Um país muda de controle com uma nova entrada em "territories", com o "t" da mudança.
- Cada unidade precisa de pelo menos um ponto em "path". Se ela se move, use vários pontos em ordem de tempo.
- Não invente tropas além do que foi descrito. Se faltar informação, escolha o mais simples e explique em "note".

Descrição do que aconteceu:
`;
