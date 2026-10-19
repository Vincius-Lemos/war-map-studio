import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import { ExportError, sanitize } from './errors.js';

export type VideoFormat = 'webm' | 'mp4';

/* Argumentos do ffmpeg: entrada = JPEGs concatenados por stdin (image2pipe),
   saída = webm (VP9) ou mp4 (H.264). Sem shell: o binário é chamado diretamente. */
export function ffmpegArgs(format: VideoFormat, fps: number, out: string): string[] {
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0'];
  // JPEG chega em faixa completa (yuvj); convertemos para yuv420p com faixa limitada (tv), como players esperam.
  const convert = ['-vf', 'scale=out_range=tv,format=yuv420p'];
  const output =
    format === 'webm'
      ? ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1']
      : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart'];
  return [...input, ...convert, ...output, '-r', String(fps), '-an', out];
}

function lastLines(text: string, n = 4): string {
  return text.split(/\r?\n/).filter((l) => l.trim()).slice(-n).join(' | ');
}

export class Encoder {
  private readonly proc: ChildProcessByStdio<Writable, null, Readable>;
  private stderr = '';
  private readonly exited: Promise<void>;

  constructor(format: VideoFormat, fps: number, out: string) {
    const bin = process.env.FFMPEG_PATH || 'ffmpeg';
    this.proc = spawn(bin, ffmpegArgs(format, fps, out), { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    this.proc.stderr.on('data', (chunk: Buffer) => {
      if (this.stderr.length < 16_000) this.stderr += chunk.toString('utf8');
    });
    this.proc.stdin.on('error', () => {
      /* erro de escrita (EPIPE) é reportado por `exited` */
    });
    this.exited = new Promise<void>((resolve, reject) => {
      this.proc.on('error', () =>
        reject(new ExportError('ffmpeg não encontrado. Instale-o e deixe no PATH, ou defina FFMPEG_PATH.')),
      );
      this.proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new ExportError(`ffmpeg falhou (código ${code}): ${sanitize(lastLines(this.stderr))}`));
      });
    });
    this.exited.catch(() => undefined); // evita rejeição não tratada enquanto ainda não aguardamos
  }

  /* Envia um quadro. Espera só o buffer de entrada encher (backpressure). */
  async write(frame: Buffer): Promise<void> {
    if (!this.proc.stdin.writable) await this.exited;
    if (!this.proc.stdin.write(frame)) {
      await Promise.race([once(this.proc.stdin, 'drain'), this.exited]);
    }
  }

  /* Fecha a entrada e aguarda o ffmpeg terminar de gravar o arquivo. */
  async finish(): Promise<void> {
    this.proc.stdin.end();
    await this.exited;
  }

  abort(): void {
    if (this.proc.exitCode === null && !this.proc.killed) this.proc.kill();
  }
}
