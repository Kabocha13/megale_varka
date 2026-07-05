import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { DEMO_MODE, GOOGLE_WEB_CLIENT_ID } from '@env';
import { auth } from '../firebase/config';

const isDemoMode = DEMO_MODE === 'true';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: boolean;
  uid: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
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
    case 'auth/account-exists-with-different-credential':
      return 'このメールアドレスは別のログイン方法で登録されています。';
    case 'auth/operation-not-allowed':
      return 'このログイン方法は現在利用できません。Firebaseの設定を確認してください。';
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

// ---- ソーシャルログイン ----

let googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

// Googleログインのネイティブエラーを原因がわかる日本語メッセージに変換する
function getGoogleSignInErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.IN_PROGRESS:
        return 'Googleログインの処理がすでに進行中です。しばらく待ってから再度お試しください。';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play開発者サービスが利用できません。更新してから再度お試しください。';
      case 'DEVELOPER_ERROR':
        return (
          'Googleログインの設定に問題があります（DEVELOPER_ERROR）。' +
          'Firebase ConsoleにアプリのSHA-1フィンガープリントが登録されているか、' +
          '.env の GOOGLE_WEB_CLIENT_ID が「ウェブクライアントID」になっているか確認してください。'
        );
      default:
        return `Googleログインに失敗しました（${error.code}）。再度お試しください。`;
    }
  }
  return 'Googleログインに失敗しました。再度お試しください。';
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

  async function loginWithGoogle(): Promise<void> {
    if (isDemoMode) {
      await demoDelay();
      setDemoEmail('demo-google@example.com');
      setDemoLoggedIn(true);
      return;
    }
    ensureGoogleConfigured();
    if (Platform.OS === 'android') {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      } catch {
        throw new Error('Google Play開発者サービスが利用できません。');
      }
    }
    let result;
    try {
      result = await GoogleSignin.signIn();
    } catch (error: unknown) {
      throw new Error(getGoogleSignInErrorMessage(error));
    }
    if (result.type !== 'success') {
      return; // ユーザーがキャンセルした場合は何もしない
    }
    const idToken = result.data.idToken;
    if (!idToken) {
      throw new Error('Googleの認証情報を取得できませんでした。再度お試しください。');
    }
    try {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      throw new Error(getErrorMessage(code));
    }
  }

  async function loginWithApple(): Promise<void> {
    if (isDemoMode) {
      await demoDelay();
      setDemoEmail('demo-apple@example.com');
      setDemoLoggedIn(true);
      return;
    }
    if (Platform.OS !== 'ios') {
      throw new Error('AppleでのログインはiOSでのみ利用できます。');
    }
    let identityToken: string | null = null;
    let rawNonce: string | undefined;
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      identityToken = response.identityToken;
      rawNonce = response.nonce;
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      if (code === appleAuth.Error.CANCELED) {
        return; // ユーザーがキャンセルした場合は何もしない
      }
      throw new Error('Appleでのログインに失敗しました。再度お試しください。');
    }
    if (!identityToken) {
      throw new Error('Appleの認証情報を取得できませんでした。再度お試しください。');
    }
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken, rawNonce });
    try {
      await signInWithCredential(auth, credential);
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
  const uid = isDemoMode ? (demoLoggedIn ? 'demo' : null) : (user?.uid ?? null);
  const email = isDemoMode ? demoEmail : (user?.email ?? null);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isDemo: isDemoMode,
        uid,
        email,
        login,
        register,
        loginWithGoogle,
        loginWithApple,
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
