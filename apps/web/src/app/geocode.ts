import type { Region } from '@map-draw/shared';

export type PlaceResult = { ok: true; region: Region; title: string } | { ok: false; error: string };

interface ViaCep {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade: string;
  uf: string;
}

/* CEP (ViaCEP) ou cidade/endereço (Nominatim) -> área do mapa. Com CEP, o mapa mostra um quarteirão. */
export async function lookupPlace(raw: string): Promise<PlaceResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Digite um CEP ou um endereço.' };
  const digits = text.replace(/\D/g, '');
  let query = text;
  let title = text;
  let isCep = false;
  if (/^\d{5}-?\d{3}$/.test(text)) {
    const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const j = (await r.json()) as ViaCep;
    if (j.erro) return { ok: false, error: 'CEP não encontrado.' };
    query = `${j.logradouro ?? ''} ${j.bairro ?? ''}, ${j.localidade}, ${j.uf}, Brasil`;
    title = `${j.logradouro || j.localidade} · ${j.localidade}/${j.uf}`;
    isCep = true;
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { 'Accept-Language': 'pt-BR' } },
  );
  const res = (await r.json()) as Array<{ lat: string; lon: string; boundingbox: string[] }>;
  const hit = res[0];
  if (!hit) return { ok: false, error: 'Não encontrei esse lugar. Tente uma cidade ou endereço mais simples.' };
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (isCep) return { ok: true, title, region: { lon0: lon - 0.008, lat0: lat - 0.008, lon1: lon + 0.008, lat1: lat + 0.008 } };
  const [s, n, w, e] = hit.boundingbox.map(Number) as [number, number, number, number];
  return { ok: true, title, region: { lon0: w, lat0: s, lon1: e, lat1: n } };
}

/* Área de um país a partir do seu contorno (com margem e limites de latitude). */
export function regionForCountryBounds(w: number, s: number, e: number, n: number): Region {
  const s2 = Math.max(-85, s);
  const n2 = Math.min(85, n);
  const padX = (e - w) * 0.03;
  const padY = (n2 - s2) * 0.03;
  return { lon0: w - padX, lat0: s2 - padY, lon1: e + padX, lat1: n2 + padY };
}
