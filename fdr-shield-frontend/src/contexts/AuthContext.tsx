import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'institution_admin' | 'aicte_officer' | 'senior_official' | 'competent_authority' | 'system_admin';
  institution_id?: string | null;
  institution_name?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fdr_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fdr_token'));

  useEffect(() => {
    if (token && !user) {
      api.get('/auth/me')
        .then(res => {
          if (res.data.success) {
            setUser(res.data.data.user);
            localStorage.setItem('fdr_user', JSON.stringify(res.data.data.user));
          }
        })
        .catch(() => logout());
    }
  }, [token]);

  const login = async (email: string, password = 'Admin@123') => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      const receivedToken = res.data.data.token;
      const receivedUser = res.data.data.user;
      setToken(receivedToken);
      setUser(receivedUser);
      localStorage.setItem('fdr_token', receivedToken);
      localStorage.setItem('fdr_user', JSON.stringify(receivedUser));
    } else {
      throw new Error(res.data.message || 'Login failed');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fdr_token');
    localStorage.removeItem('fdr_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
