# megale_varka

健康管理と就活管理を統合した React Native モバイルアプリケーションです。

## 機能

- **ヘルスケア** — HealthKit 連携による健康データの記録・可視化
- **求人管理** — 求人情報の閲覧・管理
- **通知** — Notifee を利用したプッシュ通知
- **認証** — Firebase による会員登録・ログイン・パスワードリセット

## 必要環境

| ツール | バージョン |
|--------|-----------|
| Node.js | >= 22.11.0 |
| React Native | 0.85.1 |
| Ruby (iOS) | Gemfile 準拠 |
| Xcode (iOS) | 最新安定版 |
| Android Studio (Android) | 最新安定版 |

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

## 起動方法

**Step 1: Metro バンドラーを起動する**

```bash
npm start
```

**Step 2: 別のターミナルでシミュレーター/エミュレーターを起動する**

```bash
# iOS
npm run ios

# Android
npm run android
```

## 開発ワークフロー

```bash
# 最新の main を取り込む
git checkout main
git pull origin main

# 作業ブランチへ切り替え・マージ
git checkout feature/<アカウント名>
git merge main

# 変更をコミット & プッシュ
git add .
git commit -m "変更内容の簡潔な説明"
git push origin feature/<アカウント名>
```

その後、GitHub 上でプルリクエストを作成してください。

## テスト・リント

```bash
npm test   # Jest によるユニットテスト
npm run lint  # ESLint
```

## 便利な操作

| 操作 | iOS | Android |
|------|-----|---------|
| 強制リロード | `R` キー | `R` × 2 または `Cmd/Ctrl+M` → Reload |
| Fast Refresh | ファイル保存で自動反映 | ファイル保存で自動反映 |

## トラブルシューティング

ビルドや起動でエラーが発生した場合は [React Native 公式ガイド](https://reactnative.dev/docs/troubleshooting) を参照してください。
