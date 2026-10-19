import { useEffect, useRef, type DragEvent } from 'react';
import { startMap } from '../app/mapBridge.ts';
import { useStore } from '../state/store.ts';

/* Área do mapa. O desenho e as interações ficam no módulo do mapa (via mapBridge). */
export function MapView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return startMap(ref.current);
  }, []);

  /* Soltar uma força sobre o mapa: o mapa decide o alvo; aqui só liberamos o evento para ele. */
  const allowDrop = (e: DragEvent) => {
    if (useStore.getState().dragFac) e.preventDefault();
  };

  return <div ref={ref} className="map-host" onDragOver={allowDrop} onDrop={(e) => e.preventDefault()} />;
}
