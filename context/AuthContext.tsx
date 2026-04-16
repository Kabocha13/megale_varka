import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEMO_MODE } from '@env';
import { auth } from '../firebase/config';

const isDemoMode = DEMO_MODE === 'true';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: boolean;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => void;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// ---- バリデーション ----
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---- Firebase エラー → 日本語メッセージ ----
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

// ---- デモ用モック認証 ----
function demoDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 600));
}

async function demoLogin(inputEmail: string, inputPassword: string): Promise<void> {
  await demoDelay();
  if (!isValidEmail(inputEmail)) {
    throw new Error('メールアドレスの形式が正しくありません。');
  }
  if (inputPassword.length < 6) {
    throw new Error('パスワードは6文字以上で入力してください。');
  }
}

async function demoRegister(inputEmail: string, inputPassword: string): Promise<void> {
  await demoDelay();
  if (!isValidEmail(inputEmail)) {
    throw new Error('メールアドレスの形式が正しくありません。');
  }
  if (inputPassword.length < 6) {
    throw new Error('パスワードは6文字以上で入力してください。');
  }
}

async function demoResetPassword(inputEmail: string): Promise<void> {
  await demoDelay();
  if (!isValidEmail(inputEmail)) {
    throw new Error('メールアドレスの形式が正しくありません。');
  }
}

// ---- Provider ----
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [demoLoggedIn, setDemoLoggedIn] = useState(false);
  const [demoEmail, setDemoEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(inputEmail: string, inputPassword: string): Promise<void> {
    if (isDemoMode) {
      await demoLogin(inputEmail, inputPassword);
      setDemoEmail(inputEmail);
      setDemoLoggedIn(true);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, inputEmail, inputPassword);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(getErrorMessage(code));
    }
  }

  function loginAsDemo(): void {
    setDemoEmail('demo@example.com');
    setDemoLoggedIn(true);
  }

  async function register(inputEmail: string, inputPassword: string): Promise<void> {
    if (isDemoMode) {
      await demoRegister(inputEmail, inputPassword);
      setDemoEmail(inputEmail);
      setDemoLoggedIn(true);
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, inputEmail, inputPassword);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(getErrorMessage(code));
    }
  }

  async function logout(): Promise<void> {
    if (isDemoMode || demoLoggedIn) {
      setDemoLoggedIn(false);
      setDemoEmail(null);
      return;
    }
    await signOut(auth);
  }

  async function resetPassword(inputEmail: string): Promise<void> {
    if (isDemoMode) {
      await demoResetPassword(inputEmail);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, inputEmail);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(getErrorMessage(code));
    }
  }

  const isAuthenticated = isDemoMode ? demoLoggedIn : user !== null;
  const email = isDemoMode ? demoEmail : (user?.email ?? null);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isDemo: isDemoMode,
        email,
        login,
        loginAsDemo,
        register,
        logout,
        resetPassword,
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
