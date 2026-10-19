/* Instantâneos históricos disponíveis (aourednik/historical-basemaps).
   Um ano pedido usa o instantâneo mais próximo anterior. */
export const HIST_YEARS: readonly number[] = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492,
  1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920,
  1930, 1938, 1945, 1960, 1994, 2000, 2010,
];

export function histYearFor(year: number): number {
  let best = HIST_YEARS[0] ?? year;
  for (const h of HIST_YEARS) if (h <= year) best = h;
  return best;
}
