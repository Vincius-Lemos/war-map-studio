import type { ReactNode } from 'react';

interface Props {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/* Seção recolhível do painel esquerdo (mesmo visual da referência: details/summary). */
export function Section({ title, count, defaultOpen = false, children }: Props) {
  return (
    <details className="sec" open={defaultOpen}>
      <summary>
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </summary>
      <div className="body">{children}</div>
    </details>
  );
}
