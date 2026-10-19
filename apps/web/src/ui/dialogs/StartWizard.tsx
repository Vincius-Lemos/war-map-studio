import { useState } from 'react';
import { useStore } from '../../state/store.ts';
import { CountryStep } from './CountryStep.tsx';
import { CityStep } from './CityStep.tsx';
import { FreeStep } from './FreeStep.tsx';

type Step = 'pick' | 'country' | 'city' | 'free';

/* Tela inicial "Novo mapa": escolher a escala do mapa. */
export function StartWizard() {
  const hasSaved = useStore((s) => s.hasSaved);
  const closeDialog = useStore((s) => s.closeDialog);
  const openDialog = useStore((s) => s.openDialog);
  const [step, setStep] = useState<Step>('pick');

  const choose = (kind: Step | 'ai') => {
    if (kind === 'ai') {
      openDialog('ai');
      return;
    }
    setStep(kind);
  };

  return (
    <div className="overlay">
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="wizTitle">
        <h2 id="wizTitle">Qual mapa você quer fazer?</h2>
        <p className="lead">Escolha o ponto de partida. Você pode mudar depois, no botão “Novo mapa”.</p>
        {hasSaved && (
          <button className="btn primary" onClick={closeDialog} style={{ marginBottom: 12 }}>
            Continuar a última cena
          </button>
        )}
        {step === 'pick' && (
          <div className="cards">
            <button className="card" onClick={() => choose('country')}>
              <span className="ic">🌍</span>
              <b>País inteiro</b>
              <span>Mapa de países com fronteiras reais. Ideal para avanços e controle de territórios.</span>
            </button>
            <button className="card" onClick={() => choose('city')}>
              <span className="ic">🏙️</span>
              <b>Cidade ou CEP</b>
              <span>Mapa de ruas a partir de um CEP ou endereço. Ideal para batalhas e movimentos locais.</span>
            </button>
            <button className="card" onClick={() => choose('free')}>
              <span className="ic">🎨</span>
              <b>Modo livre</b>
              <span>Tela em branco ou sua própria imagem (planta, mapa escaneado, print), sem localização real.</span>
            </button>
            <button className="card" onClick={() => choose('ai')}>
              <span className="ic">✦</span>
              <b>Criar com IA</b>
              <span>Descreva o que aconteceu, copie as instruções para uma IA e importe o resultado.</span>
            </button>
          </div>
        )}
        {step === 'country' && <CountryStep onBack={() => setStep('pick')} />}
        {step === 'city' && <CityStep onBack={() => setStep('pick')} />}
        {step === 'free' && <FreeStep onBack={() => setStep('pick')} />}
        <div className="foot">
          <button className="btn" onClick={closeDialog}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
