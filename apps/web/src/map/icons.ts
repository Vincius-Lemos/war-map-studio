import ms from 'milsymbol';
import { ECHELON_MARK } from '@map-draw/shared';
import type { Affiliation, SymbolStyle, UnitType } from '@map-draw/shared';

/* Ícone pronto para o IconLayer do deck.gl (textura PNG com âncora). */
export interface IconDef {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  mask: boolean;
}

/* Resolução de rasterização: 2 px por px de CSS, para ficar nítido em telas de alta densidade. */
const RASTER = 2;

const UNIT_SIDC: Record<UnitType, string> = {
  inf: 'SFGPUCI---', mech: 'SFGPUCIM--', motor: 'SFGPUCIW--', arm: 'SFGPUCA---', cav: 'SFGPUCR---',
  art: 'SFGPUCFA--', eng: 'SFGPUCE---', fort: 'SFGPUCF---', hq: 'SFGPUH----', civ: 'SFGPUCI---',
};
const AFFIL_CODE: Record<Affiliation, string> = { friend: 'F', hostile: 'H', neutral: 'N', unknown: 'U' };

interface Markup { markup: string; w: number; h: number }

/* Símbolo OTAN (APP-6) pelo milsymbol, com escala para 36 px de largura (igual à referência). */
function natoMarkup(type: UnitType, affil: Affiliation): Markup {
  const base = UNIT_SIDC[type] ?? UNIT_SIDC.inf;
  const sidc = ('S' + (AFFIL_CODE[affil] ?? 'U') + base.slice(2)).padEnd(15, '-');
  const sym = new ms.Symbol(sidc, { size: 100 });
  const raw: string = sym.asSVG();
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const an = sym.getAnchor();
  const sz = sym.getSize();
  const k = 36 / sz.width;
  return { markup: `<g transform="scale(${k}) translate(${-an.x},${-an.y})">${inner}</g>`, w: 36, h: sz.height * k };
}

function glyphMarkup(type: UnitType, color: string, style: 'pact' | 'hist'): Markup {
  const w = 40, h = 28, hw = w / 2, hh = h / 2;
  const pact = style === 'pact';
  const fill = pact ? color : '#f3ead2';
  const stroke = pact ? '#111111' : color;
  const ink = pact ? '#ffffff' : '#1a1a1a';
  const sw = pact ? 1.2 : 3;
  const dash = type === 'civ' ? ' stroke-dasharray="4 3"' : '';
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="1.8"/>`;
  const txt = (s: string, y = 4) =>
    `<text x="0" y="${y}" text-anchor="middle" font-size="11" font-weight="700" fill="${ink}">${s}</text>`;
  let g = `<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
  const X = line(-hw, -hh, hw, hh) + line(hw, -hh, -hw, hh);
  switch (type) {
    case 'inf': g += X; break;
    case 'mech': g += X + `<ellipse rx="7" ry="5" fill="none" stroke="${ink}" stroke-width="1.5"/>`; break;
    case 'motor': g += X + txt('M'); break;
    case 'arm': g += `<ellipse rx="14" ry="8" fill="none" stroke="${ink}" stroke-width="2"/>`; break;
    case 'cav': g += line(-hw, hh, hw, -hh) + `<circle r="2.5" fill="${ink}"/>`; break;
    case 'art': g += `<circle r="5" fill="${ink}"/>`; break;
    case 'fort': g += `<rect x="-12" y="-8" width="24" height="16" fill="none" stroke="${ink}" stroke-width="1.5" stroke-dasharray="3 2"/>`; break;
    case 'eng': g += txt('E'); break;
    case 'hq': g += txt('HQ'); break;
    case 'civ': g += `<circle r="9" fill="none" stroke="${ink}" stroke-width="1.5" stroke-dasharray="3 2"/>`; break;
    default: g += X;
  }
  return { markup: g, w, h };
}

function blockMarkup(type: UnitType, color: string): Markup {
  const w = 44, h = 30, hw = w / 2, hh = h / 2;
  const ink = '#0d0d1c';
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  let g = `<rect x="${-hw + 3}" y="${-hh + 3}" width="${w}" height="${h}" fill="#000" opacity="0.55"/>`;
  g += `<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" rx="3" fill="${color}" stroke="#0a0a1a" stroke-width="1.6"/>`;
  g += `<rect x="${-hw + 2}" y="${-hh + 2}" width="${w - 4}" height="${h / 2 - 3}" rx="2" fill="#ffffff" opacity="0.18"/>`;
  g += `<rect x="${-hw + 3}" y="${-hh + 3}" width="${w - 6}" height="${h - 6}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>`;
  const X = line(-hw + 5, -hh + 5, hw - 5, hh - 5) + line(hw - 5, -hh + 5, -hw + 5, hh - 5);
  switch (type) {
    case 'art':
      g += `<circle cx="-7" cy="4" r="5" fill="none" stroke="${ink}" stroke-width="2.2"/><circle cx="-7" cy="4" r="1.6" fill="${ink}"/>`;
      g += `<path d="M-3,0 L13,-7 L14,-4 L-2,4 Z" fill="${ink}"/>`; break;
    case 'cav': g += line(-hw + 5, hh - 5, hw - 5, -hh + 5); break;
    case 'arm': g += X + `<rect x="-8" y="-6" width="16" height="12" fill="none" stroke="${ink}" stroke-width="1.6"/>`; break;
    case 'fort': g += `<rect x="-11" y="-7" width="22" height="14" fill="none" stroke="${ink}" stroke-width="2"/>`; break;
    case 'hq': g += `<text x="0" y="5" text-anchor="middle" font-size="13" font-weight="800" fill="${ink}">HQ</text>`; break;
    case 'eng': g += `<text x="0" y="5" text-anchor="middle" font-size="13" font-weight="800" fill="${ink}">E</text>`; break;
    case 'civ': g += `<circle r="8" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="3 2"/>`; break;
    default: g += X;
  }
  return { markup: g, w, h };
}

/* Rasteriza um markup SVG (centrado em 0,0) em PNG. A âncora fica em (ax, ay) no sistema do markup. */
function rasterize(m: Markup, vx: number, vy: number, w: number, h: number, ax: number, ay: number): Promise<IconDef> {
  const W = Math.ceil(w * RASTER), H = Math.ceil(h * RASTER);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vx} ${vy} ${w} ${h}">${m.markup}</svg>`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      c.getContext('2d')?.drawImage(img, 0, 0, W, H);
      resolve({
        url: c.toDataURL('image/png'), width: W, height: H,
        anchorX: (ax - vx) * RASTER, anchorY: (ay - vy) * RASTER, mask: false,
      });
    };
    img.onerror = () => reject(new Error('falha ao rasterizar símbolo'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/* Cache dos símbolos de unidade. Gerados sob demanda: enquanto um símbolo não existe,
   `unitIcon` devolve null e chama onReady quando ele ficar pronto. */
export class IconCache {
  private done = new Map<string, { def: IconDef; h: number }>();
  private pending = new Set<string>();
  private failed = new Set<string>();

  constructor(private onReady: () => void) {}

  unitIcon(style: SymbolStyle, type: UnitType, color: string, affil: Affiliation): { def: IconDef; h: number } | null {
    const key = [style, type, color, affil].join('|');
    const hit = this.done.get(key);
    if (hit) return hit;
    if (this.pending.has(key) || this.failed.has(key)) return null;
    this.pending.add(key);
    let m: Markup;
    try {
      m = style === 'nato' ? natoMarkup(type, affil)
        : style === 'block' ? blockMarkup(type, color)
          : glyphMarkup(type, color, style);
    } catch {
      this.pending.delete(key);
      this.failed.add(key);
      return null;
    }
    rasterize(m, -m.w / 2, -m.h / 2, m.w, m.h, 0, 0)
      .then(def => { this.done.set(key, { def, h: m.h }); })
      .catch(() => { this.failed.add(key); })
      .then(() => { this.pending.delete(key); this.onReady(); });
    return null;
  }

  /* Ponta de seta na cor da força. Âncora na ponta, para girar em torno dela. */
  arrowHead(color: string): IconDef | null {
    const key = 'head|' + color;
    const hit = this.done.get(key);
    if (hit) return hit.def;
    if (this.pending.has(key) || this.failed.has(key)) return null;
    this.pending.add(key);
    const m: Markup = {
      markup: `<polygon points="30,18 6,6 6,30" fill="${color}" stroke="#000" stroke-width="2" stroke-linejoin="round"/>`,
      w: 36, h: 36,
    };
    rasterize(m, 0, 0, 36, 36, 30, 18)
      .then(def => { this.done.set(key, { def, h: 36 }); })
      .catch(() => { this.failed.add(key); })
      .then(() => { this.pending.delete(key); this.onReady(); });
    return null;
  }
}

/* Legenda do echelon (I, II, X ...) já vinda do contrato compartilhado. */
export function echelonMark(e: string): string {
  return (ECHELON_MARK as Record<string, string>)[e] ?? '';
}
