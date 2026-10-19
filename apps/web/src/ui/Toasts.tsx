import { useStore } from '../state/store.ts';

/* Avisos flutuantes. Somem sozinhos (ver toast() em state/uiActions.ts). */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}${t.out ? ' out' : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
