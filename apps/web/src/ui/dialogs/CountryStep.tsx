import { useState } from 'react';
import { useStore } from '../../state/store.ts';
import { countryBounds } from '../../app/geo.ts';
import { regionForCountryBounds } from '../../app/geocode.ts';

/* Passo "País inteiro": busca na lista de países e abre o mapa com a área do país. */
export function CountryStep({ onBack }: { onBack: () => void }) {
  const countries = useStore((s) => s.countries);
  const newScene = useStore((s) => s.newScene);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const open = async () => {
    const q = query.trim().toLowerCase();
    const c = countries.find((x) => x.name.toLowerCase() === q);
    if (!c) {
      toast('Escolha um país da lista.', 'warn');
      return;
    }
    setBusy(true);
    try {
      const b = await countryBounds(c.iso);
      if (!b) {
        toast('Não consegui ler o contorno deste país.', 'warn');
        return;
      }
      newScene('country', regionForCountryBounds(b[0], b[1], b[2], b[3]), c.name);
    } catch {
      toast('Não consegui carregar o mapa (verifique a internet).', 'err', 6000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="h">Qual país?</div>
      <p className="muted small">Digite o nome e escolha na lista. Ex.: Lituânia, Brasil, Zimbábue.</p>
      <input
        type="text"
        list="countryList"
        placeholder="Nome do país"
        aria-label="Nome do país"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void open();
        }}
      />
      <datalist id="countryList">
        {countries.map((c) => (
          <option key={c.iso} value={c.name} />
        ))}
      </datalist>
      <div className="foot">
        <button className="btn" onClick={onBack}>
          Voltar
        </button>
        <button className="btn primary" disabled={busy || countries.length === 0} onClick={() => void open()}>
          {countries.length === 0 ? 'Carregando países…' : 'Abrir mapa do país'}
        </button>
      </div>
    </>
  );
}
