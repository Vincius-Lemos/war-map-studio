import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildSlides, slideAt, type Slide } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';

/* Barra de apresentação no rodapé: anterior, próximo, reproduzir; título e texto do slide atual.
   Só lê a store (cena e instante). Ao trocar de slide chama onSlide; quem liga ao mapa é o líder. */

interface PresentationPlayerProps {
  onSlide: (slide: Slide) => void;
  /* apenas ver: oculta o contador de slides (o painel de edição é desmontado pelo líder com a mesma flag) */
  viewOnly?: boolean;
}

const bar: CSSProperties = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  padding: '10px 16px', background: 'var(--panel)', color: 'var(--txt)',
  borderTop: '1px solid var(--line)',
};

const btn: CSSProperties = {
  background: 'var(--panel3)', color: 'var(--txt)', border: '1px solid var(--line)',
  borderRadius: 8, padding: '6px 12px', cursor: 'pointer', font: 'inherit',
};

const btnOff: CSSProperties = { ...btn, opacity: 0.4, cursor: 'default' };

export function PresentationPlayer({ onSlide, viewOnly = false }: PresentationPlayerProps) {
  const scene = useStore((s) => s.scene);
  const t = useStore((s) => s.t);
  const slides = useMemo(() => buildSlides(scene), [scene]);
  const index = slideAt(slides, t);
  const current = index >= 0 ? slides[index] : undefined;
  const last = slides.length - 1;
  const [playing, setPlaying] = useState(false);

  // guarda o callback mais recente sem reiniciar o temporizador
  const onSlideRef = useRef(onSlide);
  useEffect(() => {
    onSlideRef.current = onSlide;
  });

  const goTo = (i: number) => {
    const s = slides[i];
    if (s) onSlideRef.current(s);
  };

  // reprodução automática: espera o holdSec do slide atual e avança
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const wait = index < 0 ? 0 : (slides[index]?.holdSec ?? 6) * 1000;
    const id = window.setTimeout(() => {
      const s = slides[index + 1];
      if (s) onSlideRef.current(s);
    }, wait);
    return () => window.clearTimeout(id);
  }, [playing, index, last, slides]);

  const canPrev = index > 0;
  const canNext = index < last;

  return (
    <div style={bar} role="region" aria-label="Apresentação">
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          style={canPrev ? btn : btnOff}
          disabled={!canPrev}
          onClick={() => goTo(index - 1)}
          aria-label="Slide anterior"
        >
          ◀
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          style={canNext ? btn : btnOff}
          disabled={!canNext}
          onClick={() => goTo(index < 0 ? 0 : index + 1)}
          aria-label="Próximo slide"
        >
          ▶▶
        </button>
      </div>

      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.title || 'Sem título'}
        </div>
        {current?.body ? (
          <div style={{ color: 'var(--mut)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {current.body}
          </div>
        ) : null}
      </div>

      {viewOnly ? null : (
        <div style={{ color: 'var(--mut)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {index < 0 ? '—' : `${index + 1} / ${slides.length}`}
        </div>
      )}
    </div>
  );
}
