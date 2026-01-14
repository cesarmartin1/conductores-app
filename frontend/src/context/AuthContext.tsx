import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '../config/authConfig';
import { api } from '../services/api';

interface User {
  id: number;
  email: string;
  nombre: string;
  rol: 'admin' | 'supervisor' | 'conductor';
  conductorId: number | null;
  microsoftId?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isSupervisor: boolean;
  isConductor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (inProgress !== InteractionStatus.None) {
        return;
      }

      if (isAuthenticated && accounts.length > 0) {
        try {
          // Obtener token de acceso
          const response = await instance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
          });

          // Guardar token para las peticiones API
          localStorage.setItem('msToken', response.accessToken);

          // Sincronizar/obtener usuario del backend
          const backendResponse = await api.post('/auth/microsoft', {
            accessToken: response.accessToken,
            email: accounts[0].username,
            nombre: accounts[0].name || accounts[0].username,
            microsoftId: accounts[0].localAccountId,
          });

          setUser(backendResponse.data.user);
          localStorage.setItem('token', backendResponse.data.token);
        } catch (error) {
          console.error('Error en autenticación:', error);
          // Si falla el token silencioso, el usuario tendrá que hacer login de nuevo
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [isAuthenticated, accounts, inProgress, instance]);

  const login = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('msToken');
    setUser(null);
    instance.logoutPopup({
      postLogoutRedirectUri: '/',
    });
  };

  const isAdmin = user?.rol === 'admin';
  const isSupervisor = user?.rol === 'supervisor';
  const isConductor = user?.rol === 'conductor';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAdmin,
      isSupervisor,
      isConductor
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
