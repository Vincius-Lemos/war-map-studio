import { create } from 'zustand';

/* Passo das marcas da régua de tempo, em horas. 0 = automático (tickStep da cena).
   É preferência de visualização: não entra na cena nem no desfazer. Guardada no navegador. */
export const RULER_STEPS: { hours: number; label: string }[] = [
  { hours: 0, label: 'Automática' },
  { hours: 1, label: '1 h' },
  { hours: 3, label: '3 h' },
  { hours: 6, label: '6 h' },
  { hours: 12, label: '12 h' },
  { hours: 24, label: '1 dia' },
  { hours: 48, label: '2 dias' },
  { hours: 168, label: '1 semana' },
];

const KEY = 'map-draw:ruler-step';

function readStep(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return RULER_STEPS.some((s) => s.hours === v) ? v : 0;
  } catch {
    return 0; /* armazenamento bloqueado: segue no automático */
  }
}

interface RulerState {
  step: number;
  setStep: (hours: number) => void;
}

export const useRuler = create<RulerState>()((set) => ({
  step: readStep(),
  setStep: (step) => {
    try {
      localStorage.setItem(KEY, String(step));
    } catch {
      /* sem persistência: vale só nesta sessão */
    }
    set({ step });
  },
}));
