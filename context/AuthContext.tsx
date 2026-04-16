import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase/config';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'メールアドレスまたはパスワードが正しくありません。';
    case 'auth/email-already-in-use':
      return 'このメールアドレスはすでに登録されています。';
    case 'auth/weak-password':
      return 'パスワードは6文字以上で入力してください。';
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません。';
    case 'auth/too-many-requests':
      return 'しばらく経ってから再度お試しください。';
    default:
      return 'エラーが発生しました。再度お試しください。';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(inputEmail: string, inputPassword: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(auth, inputEmail, inputPassword);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(getErrorMessage(code));
    }
  }

  async function register(inputEmail: string, inputPassword: string): Promise<void> {
    try {
      await createUserWithEmailAndPassword(auth, inputEmail, inputPassword);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(getErrorMessage(code));
    }
  }

  async function logout(): Promise<void> {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        isLoading,
        email: user?.email ?? null,
        login,
        register,
        logout,
      }}
    >
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
