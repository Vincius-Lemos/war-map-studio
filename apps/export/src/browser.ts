import { chromium, type Browser, type CDPSession, type Page } from 'playwright';
import { ExportError } from './errors.js';

/* Tempo máximo para a página carregar e para window.__mapa.ready() resolver. */
export const PAGE_TIMEOUT_MS = 60_000;
/* Tempo máximo para um quadro ser renderizado após setTime(t). */
export const FRAME_TIMEOUT_MS = 30_000;

/* Desliga animações CSS/transições: o quadro deve depender só de setTime(t). */
const NO_ANIMATION_CSS =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';

/* Expressão avaliada na página: define t, espera o evento 'frame-rendered' com detail.t === t. */
function setTimeAndWaitExpr(t: number): string {
  return `((t) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('frame-rendered', onRendered);
      reject(new Error('o app não sinalizou frame-rendered para o instante pedido'));
    }, ${FRAME_TIMEOUT_MS});
    function onRendered(ev) {
      const d = ev.detail;
      if (d && typeof d.t === 'number' && Math.abs(d.t - t) < 1e-9) {
        clearTimeout(timer);
        window.removeEventListener('frame-rendered', onRendered);
        resolve();
      }
    }
    window.addEventListener('frame-rendered', onRendered);
    window.__mapa.setTime(t);
  }))(${JSON.stringify(t)})`;
}

export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      executablePath: process.env.EXPORT_CHROME_PATH || undefined,
      channel: process.env.EXPORT_BROWSER_CHANNEL || undefined,
      args: [
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        // rAF sem limite de 60 Hz: reduz o tempo de render por quadro (medido: 15 ms -> 2,6 ms)
        '--disable-frame-rate-limit',
        '--disable-gpu-vsync',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });
  } catch {
    throw new ExportError(
      'Não foi possível iniciar o Chromium. Rode `npx playwright install chromium` ou defina EXPORT_CHROME_PATH.',
    );
  }
}

export interface OpenedApp {
  page: Page;
  /* Captura o quadro atual como JPEG (qualidade 95), direto do compositor. */
  captureJpeg(): Promise<Buffer>;
  /* Define o instante e aguarda o app sinalizar 'frame-rendered' para ele. */
  renderAt(t: number): Promise<void>;
  /* Executa uma expressão na página (ex.: loadScene) e aguarda o resultado. */
  run(expr: string): Promise<void>;
  close(): Promise<void>;
}

export async function openApp(
  browser: Browser,
  opts: { baseUrl: string; width: number; height: number },
): Promise<OpenedApp> {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);

  const url = `${opts.baseUrl.replace(/\/+$/, '')}/?export=1`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
  } catch {
    await context.close();
    throw new ExportError(`Não foi possível carregar o app em ${opts.baseUrl} (servidor fora do ar ou sem resposta em 60 s).`);
  }
  await page.addStyleTag({ content: NO_ANIMATION_CSS });

  try {
    await page.waitForFunction("typeof window.__mapa === 'object' && window.__mapa !== null", undefined, {
      timeout: PAGE_TIMEOUT_MS,
    });
  } catch {
    await context.close();
    throw new ExportError('A página não expôs window.__mapa dentro de 60 s. Confira se o app está no ar e em modo de exportação.');
  }

  const ready = page.evaluate('window.__mapa.ready()');
  try {
    await withTimeout(ready, PAGE_TIMEOUT_MS, 'window.__mapa.ready() não resolveu dentro de 60 s.');
  } catch (err) {
    await context.close();
    throw err;
  }

  const cdp: CDPSession = await context.newCDPSession(page);
  return {
    page,
    async captureJpeg() {
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 95,
        fromSurface: true,
        captureBeyondViewport: false,
      });
      return Buffer.from(data, 'base64');
    },
    async renderAt(t: number) {
      await page.evaluate(setTimeAndWaitExpr(t));
    },
    async run(expr: string) {
      await page.evaluate(expr);
    },
    async close() {
      await context.close().catch(() => undefined);
    },
  };
}

export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExportError(message)), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}
