import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { isMunicipalityUser, type UserRole } from './accessControl';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'kayseri2026';

type AuthContextValue = {
  role: UserRole;
  isAdmin: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  role: 'guest',
  isAdmin: false,
  login: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('guest');

  const login = useCallback((username: string, password: string): boolean => {
    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setRole('municipality');
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setRole('guest');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ role, isAdmin: isMunicipalityUser(role), login, logout }),
    [role, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
