# Google OAuth2 認証セットアップガイド

## 概要

このプロジェクトでは、Google Drive API にアクセスするために OAuth2
認証を使用します。

## セットアップ手順

### 1. Google Cloud Console でプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成するか、既存のプロジェクトを選択

### 2. Google Drive API を有効化

1. [APIs & Services > Library](https://console.cloud.google.com/apis/library)
   に移動
2. "Google Drive API" を検索
3. "有効にする" をクリック

### 3. OAuth 同意画面を設定

1. [APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
   に移動
2. User Type: "外部" を選択して "作成"
3. アプリ情報を入力：
   - アプリ名: "gdrive-tree" など
   - ユーザーサポートメール: 自分のメールアドレス
   - デベロッパーの連絡先情報: 自分のメールアドレス
4. "保存して次へ"
5. スコープ画面: そのまま "保存して次へ"
6. **テストユーザー画面: 重要！**
   - "ADD USERS" をクリック
   - **認証に使用する Google アカウントのメールアドレスを追加**
   - "保存して次へ"
7. 概要を確認して "ダッシュボードに戻る"

> **重要**: OAuth
> 同意画面が「テスト中」の場合、テストユーザーに追加されたアカウントのみが認証できます。

### 4. OAuth2 クライアント ID を作成

1. [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
   に移動
2. "認証情報を作成" > "OAuth クライアント ID" をクリック
3. アプリケーションの種類: "デスクトップ アプリ" を選択
4. 名前を入力（例: "gdrive-tree-app"）
5. "作成" をクリック
6. クライアント ID とクライアント シークレットが表示されるので、コピーして保存

### 5. .env ファイルに認証情報を追加

```bash
# .env ファイルを編集
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 6. refresh token を取得

以下のコマンドを実行して、refresh token を取得します：

```bash
deno task auth
```

1. ターミナルに表示された URL をブラウザで開く
2. Google アカウントでログイン
3. アプリケーションへのアクセスを許可
4. ターミナルに refresh token が表示される

### 7. refresh token を .env に追加

ターミナルに表示された refresh token を .env ファイルに追加：

```bash
GOOGLE_REFRESH_TOKEN=your-refresh-token-here
```

## 使用方法

セットアップが完了したら、通常通りアプリケーションを起動できます：

```bash
deno task dev
```

OAuth2 トークンは自動的に取得・更新されます。

## API Key との併用

OAuth2 認証が設定されていない場合、自動的に API Key にフォールバックします。
ただし、API Key には使用制限があるため、OAuth2 認証の使用を推奨します。

## トラブルシューティング

### "アプリは現在テスト中で、デベロッパーに承認されたテスターのみがアクセスできます" エラー

**原因**: OAuth
同意画面が「テスト中」モードで、認証しようとしているアカウントがテストユーザーとして追加されていません。

**解決方法**:

1. [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
   に移動
2. "Test users" セクションで "ADD USERS" をクリック
3. 認証に使用する Google アカウントのメールアドレスを追加
4. 保存後、再度 `deno task auth` を実行

### "invalid_grant" エラー

refresh token が無効になっている可能性があります。`deno task auth`
を再実行してください。

### "Access denied" エラー

Google Cloud Console で OAuth 同意画面が正しく設定されているか確認してください。

## セキュリティ注意事項

- `.env` ファイルは Git にコミットしないでください（既に `.gitignore`
  に追加されています）
- クライアント シークレットと refresh token は第三者に共有しないでください
