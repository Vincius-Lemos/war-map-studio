import { normalizeScene, type Scene } from '@map-draw/shared';

/* Persistência no navegador (localStorage). Toda leitura e escrita é protegida: o navegador pode
   bloquear o armazenamento, e a cena também pode estourar a cota. */
const KEY = 'mapa-tatico-v2';
const LEGACY_KEY = 'mapa-tatico-v1';

export function hasSavedScene(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function readSavedScene(): Scene | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return normalizeScene(JSON.parse(raw) as Partial<Scene>);
  } catch {
    return null;
  }
}

/* Devolve false se o navegador recusou a gravação (cota cheia, modo privado etc.). */
export function writeSavedScene(scene: Scene): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(scene));
    return true;
  } catch {
    return false;
  }
}

/* Grava com atraso, para não serializar a cena a cada movimento do mouse. */
export function createSaver(onFail: () => void, delayMs = 300): (scene: Scene) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (scene) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!writeSavedScene(scene)) onFail();
    }, delayMs);
  };
}
