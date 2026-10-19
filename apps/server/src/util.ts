import { timingSafeEqual } from 'node:crypto';

/** Slug ASCII para nomes de arquivo e ids: "Invasão 2022!" -> "invasao-2022". */
export function slugify(text: string, max = 40): string {
  const s = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return s || 'cena';
}

/** Comparação de segredo em tempo constante. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
