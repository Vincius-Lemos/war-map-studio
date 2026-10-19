/* Camadas deck.gl do planejamento de movimento: alcance (hexágonos) e rota (linha).
   Recebem os dados já calculados (funções puras em @map-draw/shared/movement). Não ligadas ao MapView:
   a integração na visão do mapa é do líder. */
import { PathLayer, PolygonLayer } from '@deck.gl/layers';
import { hexCorners, type LatLon, type ReachCell } from '@map-draw/shared';
import { hexToRgb } from './motion';

/* Alcance: um hexágono por célula, preenchido com a cor dada (transparente) e contorno mais forte. */
export function rangeLayer(cells: readonly ReachCell[], cellKm: number, color: string) {
  const [r, g, b] = hexToRgb(color);
  return new PolygonLayer<ReachCell>({
    id: 'move-range',
    data: [...cells],
    getPolygon: (c) => hexCorners(c.q, c.r, cellKm).map((p): [number, number] => [p.lon, p.lat]),
    getFillColor: [r, g, b, 60],
    getLineColor: [r, g, b, 200],
    lineWidthUnits: 'pixels',
    getLineWidth: 1,
    stroked: true,
    filled: true,
    pickable: false,
  });
}

/* Rota: uma linha ligando os pontos (origem, intermediários e destino). Pontos em [lon, lat]. */
export function routeLayer(points: readonly LatLon[], color: string) {
  const [r, g, b] = hexToRgb(color);
  const path: [number, number][] = points.map((p): [number, number] => [p.lon, p.lat]);
  return new PathLayer<{ path: [number, number][] }>({
    id: 'move-route',
    data: [{ path }],
    getPath: (d) => d.path,
    getColor: [r, g, b, 255],
    getWidth: 3,
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
    pickable: false,
  });
}
