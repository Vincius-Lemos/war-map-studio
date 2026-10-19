import { useEffect, useState } from 'react';
import {
  etaHours,
  MAX_REACH_CELLS,
  posAt,
  reachableCells,
  shortestPath,
  UNIT_TYPE_LABELS,
  unitSpeedKmh,
  type LatLon,
  type ReachCell,
  type RouteResult,
} from '@map-draw/shared';
import { useStore } from '../../state/store.ts';

/* Planejar movimento da unidade selecionada: alcance em horas e rota até um ponto.
   Não grava nada na cena. A rota usa o ponto clicado no mapa; a ligação do clique é do líder. */

/* Tamanho da célula da malha de planejamento (km entre centros vizinhos). */
export const PLAN_CELL_KM = 5;

/* O que o mapa precisa para desenhar: passe para rangeLayer / routeLayer em overlays.ts. */
export interface RoutePlanView {
  cellKm: number;
  range: ReachCell[] | null;
  route: RouteResult | null;
}

interface Props {
  /* Pede um ponto ao usuário no mapa; chama `onPick` com o ponto clicado. Sem isto, o botão avisa que está pendente. */
  requestMapPoint?: (onPick: (p: LatLon) => void) => void;
  /* Avisa o mapa o que desenhar sempre que o alcance ou a rota mudam. Deve ser estável (useCallback). */
  onChange?: (view: RoutePlanView) => void;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 });

/* Horas decimais em "h min". Infinito (sem movimento): travessão. */
function hoursText(h: number): string {
  if (!Number.isFinite(h)) return '—';
  const min = Math.round(h * 60);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/* Lê "2,5" ou "2.5"; devolve NaN se inválido. */
function parseHours(text: string): number {
  return Number(text.replace(',', '.').trim());
}

export function RoutePanel({ requestMapPoint, onChange }: Props) {
  const sel = useStore((s) => s.sel);
  const units = useStore((s) => s.scene.units);
  const t = useStore((s) => s.t);

  const unit = sel?.kind === 'unit' ? units.find((u) => u.id === sel.id) : undefined;
  const start = unit ? posAt(unit.path, t) : null;
  const speed = unit ? unitSpeedKmh(unit) : 0;

  const [hoursInput, setHoursText] = useState('2');
  const [range, setRange] = useState<ReachCell[] | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState('');

  /* troca de unidade: o alcance e a rota antigos já não valem */
  const unitId = unit?.id;
  useEffect(() => {
    setRange(null);
    setRoute(null);
    setPicking(false);
    setMsg('');
  }, [unitId]);

  useEffect(() => {
    onChange?.({ cellKm: PLAN_CELL_KM, range, route });
  }, [range, route, onChange]);

  const hours = parseHours(hoursInput);
  const hoursOk = Number.isFinite(hours) && hours >= 0;

  if (!unit) {
    return (
      <section className="route-panel">
        <h4>Planejar movimento</h4>
        <div className="empty">Selecione uma unidade no mapa ou na lista.</div>
      </section>
    );
  }

  const canMove = speed > 0 && start !== null;

  const showRange = () => {
    if (!start) return setMsg('A unidade não tem posição neste instante.');
    if (!hoursOk) return setMsg('Informe um número de horas maior ou igual a zero.');
    setMsg('');
    setRoute(null);
    setRange(reachableCells(start, hours, PLAN_CELL_KM, speed));
  };

  const askRoute = () => {
    if (!start) return setMsg('A unidade não tem posição neste instante.');
    if (!requestMapPoint) return setMsg('Escolha do ponto no mapa ainda não está ligada (pendente).');
    setMsg('Clique no mapa para escolher o destino.');
    setPicking(true);
    requestMapPoint((p) => {
      setPicking(false);
      try {
        setRoute(shortestPath(start, p, PLAN_CELL_KM));
        setMsg('');
      } catch (e) {
        setRoute(null);
        setMsg(e instanceof Error ? e.message : 'Não foi possível calcular a rota.');
      }
    });
  };

  const eta = route ? etaHours(route.lengthKm, speed) : NaN;

  return (
    <section className="route-panel">
      <h4>Planejar movimento</h4>
      <div className="card-info">
        <span className="chip">{unit.name}</span> <span className="chip">{UNIT_TYPE_LABELS[unit.type]}</span>
      </div>
      <p>
        Velocidade: <strong>{fmt(speed)} km/h</strong>
        {speed === 0 && <span className="chip"> não se move</span>}
      </p>

      <label className="field">
        <span>Horas</span>
        <input
          type="text"
          inputMode="decimal"
          value={hoursInput}
          onChange={(e) => setHoursText(e.target.value)}
        />
      </label>

      <div className="row">
        <button type="button" className="btn" onClick={showRange} disabled={!canMove}>
          Mostrar alcance
        </button>
        <button type="button" className="btn" onClick={askRoute} disabled={!canMove || picking}>
          Calcular rota até o ponto
        </button>
        {range && (
          <button type="button" className="btn ghost" onClick={() => setRange(null)}>
            Limpar alcance
          </button>
        )}
      </div>

      {range && (
        <p>
          Alcance: <strong>{range.length}</strong> células
          {range.length >= MAX_REACH_CELLS && ' (limite atingido)'}
          {' · '}até {fmt(Math.max(0, ...range.map((c) => c.costKm)))} km
        </p>
      )}

      {route && (
        <p>
          Rota: <strong>{fmt(route.lengthKm)} km</strong> · estimativa <strong>{hoursText(eta)}</strong>
        </p>
      )}

      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
