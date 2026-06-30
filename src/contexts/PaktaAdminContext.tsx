import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface PaktaAdminCtx {
  password: string;
  setPassword: (p: string) => void;
  isLoggedIn: boolean;
  callAdmin: <T = unknown>(action: string, body?: Record<string, unknown>) => Promise<T>;
  logout: () => void;
}

const Ctx = createContext<PaktaAdminCtx | null>(null);

export function PaktaAdminProvider({ children }: { children: ReactNode }) {
  const [password, setPasswordState] = useState('');

  function setPassword(p: string) {
    setPasswordState(p);
  }

  function logout() {
    setPasswordState('');
  }

  const callAdmin = useCallback(async function<T = unknown>(
    action: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch('/api/pakta-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pakta-admin': password,
      },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data as T;
  }, [password]);

  return (
    <Ctx.Provider value={{
      password,
      setPassword,
      isLoggedIn: password.length > 0,
      callAdmin,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePaktaAdmin(): PaktaAdminCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePaktaAdmin must be used inside PaktaAdminProvider');
  return ctx;
}
