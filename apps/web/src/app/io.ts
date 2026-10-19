import { importSceneText, type Scene } from '@map-draw/shared';
import { useStore } from '../state/store.ts';

/* Arquivos: download, escolha de arquivo e leitura. */

export function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'cena'
  );
}

/* Abre o seletor de arquivo do sistema e devolve o arquivo escolhido (ou null). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}

export function readFileDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export function sceneToJSON(scene: Scene): void {
  download(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }), `${slugify(scene.title)}.json`);
  useStore.getState().toast('Cena salva em JSON.', 'ok');
}

/* Abrir um arquivo JSON: aceita o texto com ou sem lixo em volta. */
export async function openSceneFile(): Promise<void> {
  const file = await pickFile('application/json');
  if (!file) return;
  const res = importSceneText(await readFileText(file));
  const st = useStore.getState();
  if (res.ok) {
    st.replaceScene(res.scene);
    st.toast(`Cena aberta: ${res.scene.title}`, 'ok');
  } else {
    st.toast(`Arquivo inválido: ${res.errors.join(' ')}`, 'err', 6000);
  }
}
