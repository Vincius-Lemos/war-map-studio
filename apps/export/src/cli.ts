#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import type { Scene } from '../../../packages/shared/src/scene.js';
import { exportScene, ExportError, type VideoFormat } from './index.js';
import { errorMessage } from './errors.js';

/* Uso: npx tsx src/cli.ts <cena.json> [--seconds 30] [--format mp4|webm] [--out saida.mp4]
                              [--base http://localhost:8787] [--fps 30] [--width 1920] [--height 1080] */

function parseArgs(argv: string[]): { file?: string; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  let file: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new ExportError(`A opção --${key} precisa de um valor.`);
      flags[key] = value;
      i++;
    } else if (!file) {
      file = a;
    } else {
      throw new ExportError(`Argumento inesperado: ${a}`);
    }
  }
  return { file, flags };
}

function num(flags: Record<string, string>, key: string, fallback: number): number {
  if (flags[key] === undefined) return fallback;
  const n = Number(flags[key]);
  if (!Number.isFinite(n)) throw new ExportError(`--${key} precisa ser um número.`);
  return n;
}

async function main(): Promise<void> {
  const { file, flags } = parseArgs(process.argv.slice(2));
  if (!file) throw new ExportError('Uso: npx tsx src/cli.ts <cena.json> [--seconds 30] [--format mp4|webm] [--out saida] [--base URL]');

  const format = (flags.format ?? 'mp4') as VideoFormat;
  if (format !== 'mp4' && format !== 'webm') throw new ExportError("--format deve ser 'mp4' ou 'webm'.");
  const out = flags.out ?? join(process.cwd(), `${basename(file, extname(file))}.${format}`);

  let scene: Scene;
  try {
    // remove BOM (arquivos gravados pelo PowerShell 5.1 vêm com ele)
    const text = (await readFile(resolve(file), 'utf8')).replace(/^﻿/, '');
    scene = JSON.parse(text) as Scene;
  } catch {
    throw new ExportError('Não foi possível ler a cena (arquivo inexistente ou JSON inválido).');
  }

  const total = Math.round(num(flags, 'seconds', 30) * num(flags, 'fps', 30));
  let last = -1;
  const started = Date.now();
  await exportScene(scene, {
    seconds: num(flags, 'seconds', 30),
    fps: num(flags, 'fps', 30),
    width: num(flags, 'width', 1920),
    height: num(flags, 'height', 1080),
    format,
    out,
    baseUrl: flags.base ?? 'http://localhost:8787',
    onProgress: (done, t) => {
      const pct = Math.floor((done / t) * 100);
      if (pct !== last && pct % 5 === 0) {
        last = pct;
        process.stderr.write(`\r${done}/${t} quadros (${pct}%)`);
      }
    },
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  process.stderr.write(`\nPronto: ${out} (${total} quadros, ${secs} s)\n`);
}

main().catch((err) => {
  process.stderr.write(`\nErro: ${errorMessage(err)}\n`);
  process.exitCode = 1;
});
