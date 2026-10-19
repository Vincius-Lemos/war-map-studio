import type { Scene } from '../../../../packages/shared/src/scene.js';

export type ExportFormat = 'webm' | 'mp4';

/**
 * Contrato com o pacote @map-draw/export (apps/export):
 *   export async function exportScene(req: ExportRequest): Promise<void>
 * O exportador deve gravar o vídeo em `outputPath` (já com a extensão do formato).
 */
export interface ExportRequest {
  scene: Scene;
  seconds: number;
  format: ExportFormat;
  outputPath: string;
}

export type ExportFn = (req: ExportRequest) => Promise<unknown>;

const EXPORT_PACKAGE = '@map-draw/export';

/**
 * Carrega exportScene do pacote de exportação. Retorna null enquanto o pacote não existir
 * (a rota /api/export responde 501 nesse caso).
 */
export async function loadExporter(onWarn: (msg: string) => void = () => {}): Promise<ExportFn | null> {
  try {
    const mod = (await import(EXPORT_PACKAGE)) as { exportScene?: unknown };
    return typeof mod.exportScene === 'function' ? (mod.exportScene as ExportFn) : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') {
      onWarn('falha ao carregar o pacote de exportação');
    }
    return null;
  }
}
