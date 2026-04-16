import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

// -----------------------------------------------------------------------
// Firebase プロジェクトの設定値をここに入力してください。
// 取得手順:
//   1. https://console.firebase.google.com でプロジェクトを作成
//   2. 「Authentication」→「Sign-in method」→「メール / パスワード」を有効化
//   3. プロジェクトの設定（歯車アイコン）→「マイアプリ」→ Web アプリを追加
//   4. 表示される firebaseConfig の値を以下に貼り付ける
// -----------------------------------------------------------------------
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

// AsyncStorage を使って認証状態をデバイスに永続化する
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
