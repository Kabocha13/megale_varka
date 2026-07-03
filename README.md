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
