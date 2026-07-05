import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { BmsProvider } from '@/store/provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <BmsProvider>
        {children}
      </BmsProvider>
    </I18nextProvider>
  );
}
