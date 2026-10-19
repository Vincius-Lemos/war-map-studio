import type { FactionDropEvent, Hit, MapClick, UnitDragEvent } from './mapFactory.ts';
import { useStore } from '../state/store.ts';
import { findRegionAt, loadRegions } from './geo.ts';

/* Regras de clique, arrastar e soltar no mapa, de acordo com a ferramenta ativa. */

const st = () => useStore.getState();

const countryOf = (iso: string) => st().countries.find((c) => c.iso === iso);

/* Pinta um país inteiro, ou uma região dele, conforme o nível escolhido na ferramenta. */
async function paintCountryHit(iso: string, lon: number, lat: number, faction: string): Promise<void> {
  const s = st();
  const info = countryOf(iso);
  const name = info?.name ?? iso;
  if (s.paintLevel !== 'region') {
    s.paintCountry(iso, name, faction);
    return;
  }
  if (!info?.iso3) {
    s.toast('Não encontrei as regiões deste país.', 'warn');
    return;
  }
  s.toast('Carregando regiões…');
  let features;
  try {
    features = await loadRegions(info.iso3);
  } catch {
    s.toast('Não encontrei as regiões deste país.', 'warn');
    return;
  }
  const region = findRegionAt(features, lon, lat);
  if (!region) {
    s.toast(`Clique dentro de uma região de ${name}.`, 'warn');
    return;
  }
  st().paintRegion({
    iso,
    sub: region.properties.shapeID,
    countryName: name,
    regionName: region.properties.shapeName ?? region.properties.shapeID,
    faction,
  });
}

/* Região clicada pelo mapa: o nome vem do arquivo de regiões, se já carregado. */
async function paintRegionHit(iso: string, sub: string, faction: string): Promise<void> {
  const s = st();
  const info = countryOf(iso);
  const name = info?.name ?? iso;
  let regionName = sub;
  if (info?.iso3) {
    try {
      const f = (await loadRegions(info.iso3)).find((x) => x.properties.shapeID === sub);
      regionName = f?.properties.shapeName ?? sub;
    } catch {
      /* sem nome: usa o identificador */
    }
  }
  s.paintRegion({ iso, sub, countryName: name, regionName, faction });
}

/* Pintura a partir de um alvo do mapa (clique com a ferramenta Pintar ou soltar uma força). */
async function paintAtHit(hit: Hit, lon: number, lat: number, faction: string): Promise<boolean> {
  if (hit.kind === 'region' && hit.iso && hit.sub) {
    await paintRegionHit(hit.iso, hit.sub, faction);
    return true;
  }
  if ((hit.kind === 'country' || hit.kind === 'region') && hit.iso) {
    await paintCountryHit(hit.iso, lon, lat, faction);
    return true;
  }
  return false;
}

function selectAtHit(hit: Hit): void {
  const s = st();
  switch (hit.kind) {
    case 'unit':
      if (hit.id) s.select({ kind: 'unit', id: hit.id });
      return;
    case 'arrow':
      if (hit.id) s.select({ kind: 'arrow', id: hit.id });
      return;
    case 'event':
      if (hit.id) s.select({ kind: 'event', id: hit.id });
      return;
    case 'country':
    case 'region':
      if (hit.iso) s.select({ kind: 'country', id: hit.iso });
      else s.select(null);
      return;
    default:
      s.select(null);
  }
}

export function handleMapClick(e: MapClick): void {
  const s = st();
  const { lat, lon, hit } = e;
  switch (s.mode) {
    case 'paint':
      void paintAtHit(hit, lon, lat, s.selFaction);
      return;
    case 'arrow':
      if (!s.pending) {
        s.setPending({ lat, lon });
        s.toast('Agora clique no destino da seta.');
        return;
      }
      s.addArrow(s.pending, { lat, lon });
      return;
    case 'event':
      s.addEvent({ lat, lon });
      return;
    case 'move':
      if (s.sel?.kind === 'unit') s.moveUnitTo(s.sel.id, lat, lon);
      else s.toast('Selecione uma unidade primeiro.', 'warn');
      return;
    case 'calib':
      if (!s.scene.overlay) {
        s.toast('Carregue uma imagem primeiro.', 'warn');
        return;
      }
      if (!s.pending) {
        s.setPending({ lat, lon });
        s.toast('Agora clique no canto oposto da imagem.');
        return;
      }
      s.calibrate(s.pending, { lat, lon });
      return;
    default:
      selectAtHit(hit);
  }
}

/* Arrastar uma unidade no mapa: cada movimento grava um ponto do trajeto neste instante. */
export function handleUnitDrag(e: UnitDragEvent): void {
  const s = st();
  if (e.phase === 'start') {
    s.select({ kind: 'unit', id: e.unitId });
    if (s.playing) s.togglePlay();
    return;
  }
  if (e.phase === 'move') s.moveUnitTo(e.unitId, e.lat, e.lon);
}

/* Soltar a alça de uma força: sobre uma unidade, troca a força da unidade; sobre um país ou região, pinta. */
export function handleFactionDrop(e: FactionDropEvent): void {
  const s = st();
  const fid = e.factionId;
  s.setSelFaction(fid);
  if (e.hit.kind === 'unit' && e.hit.id) {
    s.unitToFaction(e.hit.id, fid);
    return;
  }
  void paintAtHit(e.hit, e.lon, e.lat, fid).then((painted) => {
    if (!painted) st().toast('Solte sobre um país, uma região ou uma unidade.', 'warn');
  });
}
