import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Scene } from '../../../packages/shared/src/scene.js';
import { launchBrowser, openApp } from './browser.js';
import { Encoder, type VideoFormat } from './encoder.js';
import { ExportError, errorMessage } from './errors.js';

export { ExportError } from './errors.js';
export type { VideoFormat } from './encoder.js';

export interface ExportOptions {
  /* Duração do vídeo em segundos. Quadros = seconds * fps. */
  seconds: number;
  fps?: number;
  width?: number;
  height?: number;
  format: VideoFormat;
  out: string;
  /* Origem do app web, ex.: http://localhost:8787 (a página abre em <baseUrl>/?export=1). */
  baseUrl: string;
  onProgress?: (done: number, total: number) => void;
}

/*
 * Exporta a cena como vídeo. A cena é mostrada do instante 0 ao durationH:
 * quadro f corresponde a t = durationH * f / total.
 *
 * Contrato exigido da página (ver README):
 *  - window.__mapa.ready(): Promise que resolve quando o app pode receber cenas.
 *  - window.__mapa.loadScene(scene): carrega a cena (pode devolver Promise).
 *  - window.__mapa.setTime(t): muda o instante. Depois que o quadro estiver pronto,
 *    o app deve disparar window.dispatchEvent(new CustomEvent('frame-rendered', { detail: { t } }))
 *    com o mesmo t passado a setTime. O exportador só captura após esse evento.
 *  - window.__mapa.getScene(): devolve a cena atual (uso opcional).
 */
export async function exportScene(scene: Scene, opts: ExportOptions): Promise<void> {
  const fps = opts.fps ?? 30;
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  validate(scene, opts, fps, width, height);

  const total = Math.round(opts.seconds * fps);
  const out = resolve(opts.out);
  await mkdir(dirname(out), { recursive: true });

  const browser = await launchBrowser();
  let encoder: Encoder | undefined;
  let app: Awaited<ReturnType<typeof openApp>> | undefined;
  try {
    app = await openApp(browser, { baseUrl: opts.baseUrl, width, height });
    await app.run(`window.__mapa.loadScene(${JSON.stringify(scene)})`);

    encoder = new Encoder(opts.format, fps, out);
    const timeAt = (f: number) => (scene.durationH * f) / total;

    await app.renderAt(timeAt(0));
    let pendingWrite: Promise<void> = Promise.resolve();
    for (let f = 0; f < total; f++) {
      const jpeg = await app.captureJpeg();
      // Garante a ordem dos quadros e no máximo um envio pendente ao ffmpeg.
      await pendingWrite;
      pendingWrite = encoder.write(jpeg);
      pendingWrite.catch(() => undefined);
      // O próximo quadro é renderizado enquanto o ffmpeg codifica o atual.
      if (f + 1 < total) await app.renderAt(timeAt(f + 1));
      opts.onProgress?.(f + 1, total);
    }
    await pendingWrite;
    await encoder.finish();
  } catch (err) {
    encoder?.abort();
    await rm(out, { force: true }).catch(() => undefined);
    if (err instanceof ExportError) throw err;
    throw new ExportError(`Falha durante a exportação: ${errorMessage(err)}`);
  } finally {
    await app?.close();
    await browser.close().catch(() => undefined);
  }
}

function validate(scene: Scene, opts: ExportOptions, fps: number, width: number, height: number): void {
  if (!scene || typeof scene !== 'object') throw new ExportError('Cena inválida.');
  if (!(typeof scene.durationH === 'number' && scene.durationH > 0)) throw new ExportError('A cena precisa de durationH > 0.');
  if (!(typeof opts.seconds === 'number' && opts.seconds > 0)) throw new ExportError('seconds deve ser maior que zero.');
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new ExportError('fps deve ser um inteiro entre 1 e 120.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16) {
    throw new ExportError('width e height devem ser inteiros maiores que 15.');
  }
  if (opts.format !== 'webm' && opts.format !== 'mp4') throw new ExportError("format deve ser 'webm' ou 'mp4'.");
  if (!opts.out) throw new ExportError('Informe o arquivo de saída (out).');
  if (!/^https?:\/\//i.test(opts.baseUrl ?? '')) throw new ExportError('baseUrl deve começar com http:// ou https://.');
}
