import React, { createContext, useContext, useState } from 'react';

type AuthContextType = {
  isAuthenticated: boolean;
  email: string | null;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

// In-memory user store
const users: { email: string; password: string }[] = [];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  function login(inputEmail: string, inputPassword: string): boolean {
    const user = users.find(
      u => u.email === inputEmail && u.password === inputPassword,
    );
    if (user) {
      setIsAuthenticated(true);
      setEmail(inputEmail);
      return true;
    }
    return false;
  }

  function register(inputEmail: string, inputPassword: string): boolean {
    const exists = users.some(u => u.email === inputEmail);
    if (exists) {
      return false;
    }
    users.push({ email: inputEmail, password: inputPassword });
    setIsAuthenticated(true);
    setEmail(inputEmail);
    return true;
  }

  function logout() {
    setIsAuthenticated(false);
    setEmail(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, email, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
