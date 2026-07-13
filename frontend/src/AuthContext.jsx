import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredAuth, getStoredAuth, storeAuth } from './auth';
import { getMe } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const initial = getStoredAuth();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [loading, setLoading] = useState(Boolean(initial.token));

  useEffect(() => {
    let cancelled = false;

    async function refreshUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getMe();
        if (!cancelled) {
          setUser(profile);
          storeAuth(token, profile);
        }
      } catch {
        if (!cancelled) {
          clearStoredAuth();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    refreshUser();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(() => ({
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    signIn(authResult) {
      storeAuth(authResult.access_token, authResult.user);
      setToken(authResult.access_token);
      setUser(authResult.user);
    },
    signOut() {
      clearStoredAuth();
      setToken(null);
      setUser(null);
    },
  }), [loading, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
