import type { FactionDropEvent, Hit, MapClick, UnitDragEvent } from './mapFactory.ts';
import { useStore } from '../state/store.ts';
import type { Selection } from '../state/types.ts';
import { findRegionAt, loadRegions } from './geo.ts';
import { pointerMods } from './keyboard.ts';
import { parseUnitDrag, usePlacement } from './placement.ts';
import { useOverlay } from './overlayState.ts';

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

/* Alvo do clique como item selecionável (null se o clique não pegou nada que se selecione). */
function hitSelection(hit: Hit): Selection | null {
  switch (hit.kind) {
    case 'unit':
    case 'arrow':
    case 'event':
      return hit.id ? { kind: hit.kind, id: hit.id } : null;
    case 'country':
    case 'region':
      return hit.iso ? { kind: 'country', id: hit.iso } : null;
    default:
      return null;
  }
}

/* Clique com a ferramenta Selecionar: simples troca a seleção; Shift acrescenta; Ctrl alterna. */
function selectAtHit(hit: Hit): void {
  const s = st();
  const mods = pointerMods();
  const item = hitSelection(hit);
  if (!item) {
    if (!mods.shift && !mods.ctrl) s.select(null);
    return;
  }
  if (mods.ctrl) s.toggleSelect(item);
  else if (mods.shift) s.addToSelection(item);
  else s.select(item);
}

export function handleMapClick(e: MapClick): void {
  /* Escolha de ponto pedida pelo planejamento de rota: o clique vai para lá, sem editar a cena. */
  const pick = useOverlay.getState().pick;
  if (pick) {
    useOverlay.getState().setPick(null);
    pick({ lat: e.lat, lon: e.lon });
    return;
  }
  const s = st();
  const { lat, lon, hit } = e;
  /* Modo "colocar" (paleta de unidades): o clique põe uma unidade e o modo continua até Esc. */
  const placing = usePlacement.getState();
  if (placing.active) {
    s.addUnit({ type: placing.type, echelon: placing.echelon, lat, lon });
    return;
  }
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
      if (s.sel?.kind === 'unit') {
        s.breakHistory(); // cada clique é um passo do desfazer
        s.moveUnitTo(s.sel.id, lat, lon);
      }
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
  /* Soltar o arrasto encerra o desfazer contínuo: o próximo movimento vira outro passo. */
  if (e.phase === 'end') s.breakHistory();
}

/* Soltar no mapa. Um símbolo arrastado da paleta cria a unidade no ponto do drop (payload com prefixo).
   Uma alça de força: sobre uma unidade, troca a força da unidade; sobre um país ou região, pinta. */
export function handleFactionDrop(e: FactionDropEvent): void {
  const s = st();
  const unit = parseUnitDrag(e.factionId);
  if (unit) {
    s.addUnit({ ...unit, lat: e.lat, lon: e.lon });
    return;
  }
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
