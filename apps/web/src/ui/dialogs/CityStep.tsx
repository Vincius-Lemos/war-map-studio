import { useState } from 'react';
import { useStore } from '../../state/store.ts';
import { lookupPlace } from '../../app/geocode.ts';

/* Passo "Cidade ou CEP": ViaCEP + Nominatim para achar o lugar e abrir o mapa de ruas. */
export function CityStep({ onBack }: { onBack: () => void }) {
  const newScene = useStore((s) => s.newScene);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!query.trim()) {
      toast('Digite um CEP ou um endereço.', 'warn');
      return;
    }
    setBusy(true);
    toast('Buscando o lugar…');
    try {
      const res = await lookupPlace(query);
      if (res.ok) newScene('tiles', res.region, res.title);
      else toast(res.error, 'warn');
    } catch {
      toast('Não consegui buscar o lugar agora. Verifique a conexão.', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="h">Onde fica a ação?</div>
      <p className="muted small">
        Digite um CEP (ex.: 88010-400) ou um endereço/cidade (ex.: Florianópolis, SC). Com CEP, o mapa mostra o quarteirão. Com
        cidade, mostra a área toda.
      </p>
      <input
        type="text"
        placeholder="CEP ou cidade/endereço"
        aria-label="CEP ou cidade"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void search();
        }}
      />
      <div className="foot">
        <button className="btn" onClick={onBack}>
          Voltar
        </button>
        <button className="btn primary" disabled={busy} onClick={() => void search()}>
          Buscar e abrir
        </button>
      </div>
      <p className="muted small">Usa ViaCEP e OpenStreetMap (Nominatim) para achar o lugar, e o mapa de ruas do OpenStreetMap.</p>
    </>
  );
}
