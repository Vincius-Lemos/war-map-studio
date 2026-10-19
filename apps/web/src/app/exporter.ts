import { clockParts } from '@map-draw/shared';
import { useStore } from '../state/store.ts';
import { getMapHandle } from './mapRegistry.ts';
import { download, slugify } from './io.ts';

/* Track de vídeo com requestFrame (Chrome/Edge); o tipo padrão não o declara. */
type FrameTrack = MediaStreamTrack & { requestFrame?: () => void };

/* Exportação: PNG da tela atual e vídeo WebM (quadro a quadro, 1920x1080, 30 fps). */

const W = 1920;
const H = 1080;
const FPS = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function exportPngFile(): Promise<void> {
  const st = useStore.getState();
  const h = getMapHandle();
  if (!h) return st.toast('O mapa ainda não está pronto.', 'warn');
  st.toast('Gerando imagem…');
  h.renderNow();
  const blob = await h.api.exportPng();
  const s = useStore.getState();
  download(blob, `${slugify(s.scene.title)}-${clockParts(s.scene, s.t).main.replace(/\W+/g, '-')}.png`);
  st.toast('Imagem pronta.', 'ok');
}

export async function exportVideoFile(seconds: number): Promise<void> {
  const st = useStore.getState();
  const h = getMapHandle();
  if (!h) return st.toast('O mapa ainda não está pronto.', 'warn');
  if (typeof MediaRecorder === 'undefined') return st.toast('Este navegador não grava vídeo.', 'err');

  const sec = Math.min(180, Math.max(3, seconds));
  const frames = Math.round(sec * FPS);
  const saved = st.t;
  const duration = st.scene.durationH;
  st.pause();
  st.setExporting(true, 'Preparando…');

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const stream = cv.captureStream(0);
  const track = stream.getVideoTracks()[0] as FrameTrack | undefined;
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((r) => {
    rec.onstop = () => r();
  });

  let failed: unknown = null;
  try {
    rec.start();
    for (let f = 0; f <= frames; f++) {
      useStore.getState().setT((duration * f) / frames);
      h.renderNow();
      await nextFrame();
      const bmp = await createImageBitmap(await h.api.exportPng());
      ctx?.drawImage(bmp, 0, 0, W, H);
      track?.requestFrame?.();
      useStore.getState().setExporting(true, `Gravando: quadro ${f + 1} de ${frames + 1}`);
      await sleep(1000 / FPS);
    }
  } catch (err) {
    failed = err;
  } finally {
    if (rec.state !== 'inactive') rec.stop();
  }
  await done;
  useStore.getState().setT(saved);
  h.renderNow();
  if (failed) {
    useStore.getState().setExporting(false, 'Falhou a gravação.');
    useStore.getState().toast('Não consegui gravar o vídeo. Tente de novo com menos duração.', 'err', 6000);
    return;
  }
  download(new Blob(chunks, { type: 'video/webm' }), `${slugify(useStore.getState().scene.title)}.webm`);
  useStore.getState().setExporting(false, 'Pronto. O arquivo WebM foi baixado.');
  useStore.getState().toast('Vídeo pronto (WebM).', 'ok', 5000);
}
