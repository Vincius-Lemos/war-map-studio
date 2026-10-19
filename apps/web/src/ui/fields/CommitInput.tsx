import { useEffect, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> {
  value: string | number;
  /* Chamado ao sair do campo ou ao apertar Enter, só se o texto mudou. */
  onCommit: (text: string) => void;
}

/* Campo de texto/número que grava ao sair (ou Enter), para não recalcular a cena a cada tecla. */
export function CommitInput({ value, onCommit, ...rest }: Props) {
  const external = String(value ?? '');
  const [draft, setDraft] = useState(external);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(external);
  }, [external, focused]);

  const commit = () => {
    setFocused(false);
    if (draft !== external) onCommit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setDraft(external);
      e.currentTarget.blur();
    }
  };

  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}
