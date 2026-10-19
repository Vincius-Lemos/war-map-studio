import { PolygonLayer } from '@deck.gl/layers';
import type { Region, VisionCircle } from '@map-draw/shared';

/* Névoa de guerra: um retângulo escuro cobrindo a área da cena, com um buraco para cada círculo
   de visão. Os círculos vêm de visibleTo(...) em packages/shared/src/fog.ts. */

const SEGMENTS = 48;

/* Círculo geográfico aproximado (anel de lon/lat) em torno de um ponto, com correção de longitude pela latitude. */
function circleRing(c: VisionCircle): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = c.radiusKm / 110.57;
  const dLon = c.radiusKm / (111.32 * Math.max(0.2, Math.cos((c.lat * Math.PI) / 180)));
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (2 * Math.PI * i) / SEGMENTS;
    ring.push([c.lon + dLon * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return ring;
}

/* A névoa cobre o mundo inteiro (não só a área da cena): assim a tela toda fica escura fora da visão. */
export function fogLayer(circles: readonly VisionCircle[], _region: Region, opacity = 0.62) {
  /* bordas um pouco dentro de ±180/±85: anel exatamente no antimeridiano some na triangulação do deck.gl */
  const outer: [number, number][] = [
    [-179.99, -84],
    [179.99, -84],
    [179.99, 84],
    [-179.99, 84],
  ];
  const polygon = [outer, ...circles.map(circleRing)];
  return new PolygonLayer<{ polygon: [number, number][][] }>({
    id: 'fog-of-war',
    data: [{ polygon }],
    getPolygon: (d) => d.polygon,
    getFillColor: [8, 12, 18, Math.round(opacity * 255)],
    pickable: false,
    stroked: false,
  });
}
