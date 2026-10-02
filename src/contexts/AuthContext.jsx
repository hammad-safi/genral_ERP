import React, { createContext, useContext, useState, useEffect } from 'react';
import { logAudit } from '@/lib/audit';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const sessionUser = sessionStorage.getItem('erp_session');
        if (sessionUser) {
          setUser(JSON.parse(sessionUser));
        }
      } catch (e) {
        console.error('Failed to initialize auth:', e);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to login');
    }
    
    setUser(data);
    sessionStorage.setItem('erp_session', JSON.stringify(data));
    logAudit(data.id, data.username, 'LOGIN', 'SYSTEM', 'User logged in successfully');
  };

  const logout = () => {
    if (user) {
      logAudit(user.id, user.username, 'LOGOUT', 'SYSTEM', 'User logged out');
    }
    setUser(null);
    sessionStorage.removeItem('erp_session');
  };

  const hasPermission = (module, action) => {
    if (!user || !user.permissions) return false;
    
    if (user.role === 'Admin' || user.role === 'Owner') {
      return true;
    }

    const modulePerms = user.permissions[module];
    if (!modulePerms) return false;
    return modulePerms[action] === true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
