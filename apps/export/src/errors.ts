/* Erro de exportação com mensagem segura para exibir ao usuário (sem caminhos do sistema). */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

/* Remove caminhos absolutos (Windows e POSIX) de um texto antes de mostrá-lo. */
export function sanitize(text: string): string {
  return text
    .replace(/[A-Za-z]:\\[^\s'"`]*/g, '<caminho>')
    .replace(/(^|[\s'"`(])\/[^\s'"`)]+/g, '$1<caminho>')
    .trim();
}

export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return sanitize(raw);
}
