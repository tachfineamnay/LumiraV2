'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  type ConsentValue,
  readConsentCookie,
  writeConsentCookie,
} from '../../lib/consent';

interface ConsentContextType {
  /** `null` = pas encore décidé, en attente de la bannière */
  consent: ConsentValue | null;
  grantConsent: () => void;
  denyConsent: () => void;
}

const ConsentContext = createContext<ConsentContextType>({
  consent: null,
  grantConsent: () => {},
  denyConsent: () => {},
});

export function useConsent() {
  return useContext(ConsentContext);
}

/**
 * Fournit l'état de consentement à toute l'arborescence React.
 * À placer au plus haut niveau du layout (autour de <body>).
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  // `null` pendant l'hydratation SSR, puis valeur réelle depuis le cookie.
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(readConsentCookie());
  }, []);

  const grantConsent = useCallback(() => {
    writeConsentCookie('granted');
    setConsent('granted');
  }, []);

  const denyConsent = useCallback(() => {
    writeConsentCookie('denied');
    setConsent('denied');
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, grantConsent, denyConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}
