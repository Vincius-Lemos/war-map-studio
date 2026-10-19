/* milsymbol 2.x não traz tipos: só o necessário para os símbolos OTAN. */
declare module 'milsymbol' {
  interface MilSymbol {
    asSVG(): string;
    getAnchor(): { x: number; y: number };
    getSize(): { width: number; height: number };
  }
  interface MilSymbolModule {
    Symbol: new (sidc: string, options?: { size?: number }) => MilSymbol;
  }
  const ms: MilSymbolModule;
  export default ms;
}
