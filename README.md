# megale_varka

健康管理と就活管理を統合した React Native モバイルアプリケーションです。

## 機能

- **ヘルスケア** — HealthKit 連携による健康データの記録・可視化
- **求人管理** — 求人情報の閲覧・管理
- **通知** — Notifee を利用したプッシュ通知
- **認証** — Firebase による会員登録・ログイン・パスワードリセット

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# iOS のみ: CocoaPods のインストール
bundle install
bundle exec pod install
```

## ソーシャルログイン（Google / Apple）のセットアップ

コード側は実装済みです。ビルド前に以下の設定が必要です。
**iOS（Appleログイン）**

Sign in with Apple は**有料の Apple Developer Program 加入が必須**です
（無料の Personal Team では provisioning profile エラーになります）。
未加入の間は `.env` の `APPLE_SIGNIN_ENABLED=false`（既定値）のままにしておくと、
Appleログインボタンは表示されず、ビルドにも影響しません。

加入後に有効化する手順:

1. Xcode > TARGETS > megale_varka > Signing & Capabilities で Team を有料アカウントに変更
2. 「+ Capability」→「Sign in with Apple」を追加
   （`megale_varka.entitlements` に `com.apple.developer.applesignin` キーが追加されます）
3. Firebase Console > Authentication で Apple プロバイダを有効化
4. `.env` で `APPLE_SIGNIN_ENABLED=true` に変更

**Android**

1. Firebase Console のプロジェクト設定に、デバッグ／リリース用の SHA-1 フィンガープリントを登録
   （`cd android && ./gradlew signingReport` で確認できます）
## Googleログインのトラブルシューティング

**iOS でエラーになる場合（このリポジトリの現状はこれに該当します）**

現在リポジトリに入っている `ios/GoogleService-Info.plist` には `CLIENT_ID` /
`REVERSED_CLIENT_ID` が含まれていません。これは Firebase Console で Google
プロバイダを**有効化する前に**ダウンロードした plist です。以下を実施してください。

1. Firebase Console > Authentication > ログイン方法 で「Google」を有効化
2. **有効化したあとに** iOS 用 `GoogleService-Info.plist` を再ダウンロードして差し替え
   （`CLIENT_ID` / `REVERSED_CLIENT_ID` が含まれていることを確認）
3. Xcode で TARGETS > megale_varka > Info > URL Types に、plist 内の
   `REVERSED_CLIENT_ID` の値を URL Schemes として追加
   （未設定だと「missing support for the following URL schemes」エラーになります）

**Android で `DEVELOPER_ERROR` が出る場合**

1. Firebase Console > プロジェクト設定 > マイアプリ（Android）に SHA-1 を登録
   （デバッグビルドの SHA-1 は `cd android && ./gradlew signingReport` で確認）
2. `.env` の `GOOGLE_WEB_CLIENT_ID` が **「ウェブクライアントID」**（末尾が
   `.apps.googleusercontent.com` で、種類が「ウェブアプリケーション」のもの）に
   なっているか確認。Android クライアントIDを設定すると `DEVELOPER_ERROR` になります。
3. SHA-1 を登録・変更した直後は反映まで数分かかることがあります。

アプリ内のエラーメッセージにもエラーコード（`DEVELOPER_ERROR` など）が表示される
ようになっているので、そのコードを手がかりに上記を確認してください。

## 運営からのお知らせ・お問い合わせ（Firestore 設定）

**お知らせ（`announcements` コレクション）**

設定画面の「運営からのお知らせ」は、Firestore のトップレベルコレクション
`announcements` を新しい順に表示します。運営者が Firebase Console から直接
ドキュメントを追加してください。

| フィールド | 型 | 内容 |
| --- | --- | --- |
| `title` | string | お知らせのタイトル |
| `body` | string | 本文 |
| `createdAt` | timestamp | 掲載日時（この順で新しい順に表示・NEW判定に使用） |

**お問い合わせ（`inquiries` コレクション）**

アプリ内フォームからの送信は `inquiries` コレクションに保存されます
（`uid` / `email` / `category` / `message` / `platform` / `createdAt`）。
Firebase Console で内容を確認してください。メールでの問い合わせ先は
`services/inquiry.ts` の `SUPPORT_EMAIL` で変更できます。

**セキュリティルールの例**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // お知らせ: 誰でも読み取り可・書き込みはConsoleからのみ
    match /announcements/{id} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    // 問い合わせ: ログインユーザーが作成のみ可能
    match /inquiries/{id} {
      allow create: if request.auth != null;
      allow read, update, delete: if false;
    }
  }
}
```
