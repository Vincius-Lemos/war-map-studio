import type { OrgFlag, Territory } from '@map-draw/shared';
import type { Bounds, GeoFeature } from './geo';
import { wx, wy } from './motion';

/* Lado maior da textura de uma bandeira, em pixels. */
const TEX_MAX = 256;

const images = new Map<string, Promise<HTMLImageElement | null>>();

export function flagUrl(code: string | undefined): string {
  return code ? `https://flagcdn.com/${code.toLowerCase()}.svg` : '';
}

/* Bandeira de um território: a da organização escolhida; senão a do país da força que o controla;
   senão a do próprio país. */
export function flagSrcFor(entry: Territory | undefined, iso: string, orgFlags: readonly OrgFlag[]): string {
  if (entry?.flag) {
    const o = orgFlags.find(x => x.id === entry.flag);
    if (o) return o.src;
  }
  if (entry?.fcode) return flagUrl(entry.fcode);
  return flagUrl(iso);
}

/* Carrega a imagem. URLs remotas passam por fetch + blob: assim o canvas não fica "tainted"
   e pode ser enviado ao WebGL. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = images.get(src);
  if (!p) {
    p = (async () => {
      try {
        let url = src;
        if (!src.startsWith('data:')) {
          const r = await fetch(src);
          if (!r.ok) return null;
          url = URL.createObjectURL(await r.blob());
        }
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      } catch {
        return null;
      }
    })();
    images.set(src, p);
  }
  return p;
}

/* Textura da bandeira esticada sobre o bbox da parte principal e recortada pelo contorno
   (todas as partes do território). Fora do bbox não há bandeira: fica a cor de base. */
export function buildFlagCanvas(img: HTMLImageElement, feat: GeoFeature<object>, bounds: Bounds): HTMLCanvasElement {
  const [[lon0, lat0], [lon1, lat1]] = bounds;
  const x0 = wx(lon0), x1 = wx(lon1);
  const y0 = wy(lat1), y1 = wy(lat0);   // y0 é o norte
  const sx = Math.max(1e-9, x1 - x0), sy = Math.max(1e-9, y1 - y0);
  const k = TEX_MAX / Math.max(sx, sy);
  const W = Math.max(2, Math.round(sx * k)), H = Math.max(2, Math.round(sy * k));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.drawImage(img, 0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  const g = feat.geometry;
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  for (const poly of polys) {
    for (const ring of poly) {
      let minL = Infinity, maxL = -Infinity;
      for (const p of ring) { if (p[0]! < minL) minL = p[0]!; if (p[0]! > maxL) maxL = p[0]!; }
      if (maxL - minL > 180) continue; // anel que cruza o antimeridiano: fica sem bandeira
      ring.forEach((p, i) => {
        const px = (wx(p[0]!) - x0) / sx * W;
        const py = (wy(p[1]!) - y0) / sy * H;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
  }
  ctx.fill('evenodd');
  return c;
}

/* Cache de texturas. `get` devolve o canvas pronto, ou null enquanto carrega (e dispara o
   carregamento). Ao terminar, chama onReady para que a cena seja redesenhada. */
export class FlagTextures {
  private canvases = new Map<string, HTMLCanvasElement>();
  private promises = new Map<string, Promise<void>>();
  private failed = new Set<string>();
  private srcIds = new Map<string, number>();

  constructor(private onReady: () => void) {}

  key(kind: string, id: string, src: string): string {
    let n = this.srcIds.get(src);
    if (n === undefined) { n = this.srcIds.size + 1; this.srcIds.set(src, n); }
    return `${kind}|${id}|${n}`;
  }

  get(kind: string, id: string, src: string, feat: GeoFeature<object>, bounds: Bounds): HTMLCanvasElement | null {
    if (!src) return null;
    const k = this.key(kind, id, src);
    const c = this.canvases.get(k);
    if (c) return c;
    if (this.failed.has(k) || this.promises.has(k)) return null;
    const p = loadImage(src)
      .then(img => {
        if (img) this.canvases.set(k, buildFlagCanvas(img, feat, bounds));
        else this.failed.add(k);
      })
      .catch(() => { this.failed.add(k); })
      .then(() => {
        this.promises.delete(k);
        this.onReady();
      });
    this.promises.set(k, p);
    return null;
  }

  /* Promessa que resolve quando a textura terminar (com sucesso ou não). */
  wait(kind: string, id: string, src: string, feat: GeoFeature<object>, bounds: Bounds): Promise<void> {
    this.get(kind, id, src, feat, bounds);
    return this.promises.get(this.key(kind, id, src)) ?? Promise.resolve();
  }
}
