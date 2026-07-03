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

**共通（Firebase Console）**

1. Authentication > ログイン方法 で「Google」「Apple」を有効化
2. Google のウェブクライアントIDを `.env` の `GOOGLE_WEB_CLIENT_ID` に設定

**iOS（Googleログイン）**

1. `bundle exec pod install` を再実行（ネイティブモジュールの追加のため）
2. Firebase Console で Google プロバイダを有効化した**あとに** iOS 用 `GoogleService-Info.plist` を再ダウンロードし、
   Xcode のファイル一覧の `megale_varka` フォルダにドラッグ＆ドロップして追加
   （Copy items if needed / Add to targets: megale_varka にチェック。
   有効化後の plist には `CLIENT_ID` / `REVERSED_CLIENT_ID` が含まれます）
3. Xcode で TARGETS > megale_varka > Info > URL Types に、plist 内の `REVERSED_CLIENT_ID` の値を
   URL Schemes として追加（Googleログインのコールバック用）

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