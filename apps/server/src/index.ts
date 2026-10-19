import { loadConfig } from './config.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { app } = await buildApp({ config });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'encerrando');
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port, basePath: config.basePath || '/' }, 'servidor no ar');
}

main().catch((err: unknown) => {
  // Sem stack com caminhos no console de produção além do necessário.
  console.error('falha ao iniciar:', err instanceof Error ? err.message : 'erro desconhecido');
  process.exit(1);
});
