from weasyprint import HTML

# Content for the README.txt
readme_content = """# megale_varka プロジェクト README

このリポジトリは React Native を使用したモバイルアプリケーションの開発用プロジェクトです。

## 1. 開発の始め方（2回目以降の作業）

作業を開始する際は、常に最新のソースコードを取得し、自身の作業用ブランチに切り替えてから進めてください。

### ディレクトリの移動と最新化
cd Desktop/megale_varka
git checkout main
git pull origin main

### 作業ブランチの準備
git checkout feature/アカウント名
git merge main

---

## 2. アプリの起動方法

### Step 1: Metro（ビルドツール）の起動
JavaScriptのビルドを行うため、まず以下のコマンドを実行して待機させます。
npm start
# または yarn start

### Step 2: シミュレーターで実行
新しいターミナルウィンドウを開き、以下のコマンドを実行します。

#### iOSの場合
※初回実行時や、ライブラリを追加した後は CocoaPods のインストールが必要です。
bundle install
bundle exec pod install
npm run ios

#### Androidの場合
npm run android

---

## 3. 作業の保存と提出（コミット・プッシュ）

作業が一段落したら、以下の手順で変更を GitHub に反映させてください。

1. 変更をステージング
   git add .

2. ローカルに保存
   git commit -m "変更内容の簡潔な説明（例：〇〇画面のボタン配置修正）"

3. GitHubへ送信
   git push origin feature/アカウント名

4. プルリクエストの作成
   GitHubのWebサイトから「Pull Request」を作成してください。

5. 完了連絡
   PR作成後、下田まで連絡をお願いします。

---

## 4. 開発中の便利な操作

### Fast Refresh（自動反映）
App.tsx などのファイルを編集して保存すると、アプリに即座に変更が反映されます。

### 強制リロード
アプリの状態をリセットして再読み込みしたい場合：
・iOS：シミュレーター上で「R」キーを押す。
・Android：「R」キーを2回叩く、または Cmd/Ctrl + M でデバッグメニューを開き "Reload" を選択。

---

## 5. 困ったときは
セットアップやビルドでエラーが出る場合は、以下の公式ガイドを参照してください。
https://reactnative.dev/docs/troubleshooting