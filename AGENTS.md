# Deno.bundle API 最新情報

## 概要

`Deno.bundle` は TypeScript/JavaScript コードをバンドルするための API です。

## ステータス

**unstable** - この API は不安定版であり、`--unstable` フラグが必要です。

## 関数シグネチャ

```typescript
Deno.bundle(options: Deno.bundle.Options): Promise<Deno.bundle.Result>
```

## 主要な型定義

### Deno.bundle.Options

- `entrypoints`: エントリーポイントのファイルパス（複数可）
- `outputPath`: 出力ファイルのパス
- `outputDir`: 出力ディレクトリ
- `write`: ファイルシステムに書き込むかどうか（boolean）
- `format`: 出力フォーマット（esm, cjs など）
- `platform`: ターゲットプラットフォーム（browser, node など）
- `minify`: 最小化するかどうか（boolean）
- `sourcemap`: ソースマップの種類
- `codeSplitting`: コード分割を有効にするか
- `inlineImports`: インポートをインライン化するか
- `external`: 外部依存関係として扱うモジュール
- `packages`: パッケージの扱い方

### Deno.bundle.Result

- `success`: バンドルが成功したかどうか（boolean）
- `outputFiles`: 出力ファイルの配列（`Deno.bundle.OutputFile[]`）
- `errors`: エラーメッセージの配列（`Deno.bundle.Message[]`）
- `warnings`: 警告メッセージの配列（`Deno.bundle.Message[]`）

### Deno.bundle.OutputFile

- `path`: ファイルパス
- `contents`: ファイルの内容（Uint8Array）
- `hash`: ファイルのハッシュ値
- `text()`: コンテンツをテキストとして取得するメソッド

## 重要なポイント

1. **`write: false` オプション**:
   ファイルに書き出さずにメモリ上でバンドル結果を取得できる
2. **`outputFiles`**: バンドル結果は `Result.outputFiles` から取得可能
3. **複数エントリーポイント**: `entrypoints` は配列で複数指定可能
4. **エラーハンドリング**: `Result.success` をチェックして、`errors`
   配列でエラー詳細を確認

## ユースケース

- Hono などのミドルウェアでオンザフライバンドル
- ビルド時のバンドル処理
- 開発サーバーでの動的バンドル配信

## 参考リンク

- https://docs.deno.com/api/deno/~/Deno.bundle

---

# deno.json への permissions の書き方

## 概要

Deno 2.5+ では、deno.json に permission sets
を定義できます。これにより、プロジェクトごとに権限を管理しやすくなります。

## 基本的な書き方

### 名前付き permission sets

`permissions` フィールドにキーと値のペアで権限セットを定義します：

```jsonc
{
  "permissions": {
    "read-data": {
      "read": "./data"
    },
    "read-and-write": {
      "read": true,
      "write": ["./data"]
    }
  }
}
```

使用時は `--permission-set=<name>` または `-P=<name>` フラグで指定：

```bash
deno run -P=read-data main.ts
```

### デフォルト permission

特別なキー `"default"` を使うと、`-P` フラグだけで使用可能：

```jsonc
{
  "permissions": {
    "default": {
      "env": true
    }
  }
}
```

```bash
deno run -P main.ts
```

## Permission の種類と書き方

### Permission の値の型

Permission は以下の2つの形式で指定できます：

1. **boolean または配列**：
   ```jsonc
   {
     "read": true, // すべての読み取りを許可
     "write": ["./data"], // ./data への書き込みのみ許可
     "net": false // ネットワークアクセスを拒否
   }
   ```

2. **オブジェクト形式（allow/deny/ignore）**：
   ```jsonc
   {
     "read": {
       "allow": ["./data", "./config"],
       "deny": ["./data/secret"],
       "ignore": ["./data/cache"]
     }
   }
   ```

### 利用可能な permission の種類

- `all`: すべての権限を許可（boolean のみ）
- `read`: ファイル読み取り（allow/deny/ignore 対応）
- `write`: ファイル書き込み（allow/deny 対応）
- `import`: モジュールインポート（allow/deny 対応）
- `env`: 環境変数（allow/deny/ignore 対応）
- `net`: ネットワークアクセス（allow/deny 対応）
- `run`: プロセス実行（allow/deny 対応）
- `ffi`: FFI（allow/deny 対応）
- `sys`: システム情報（allow/deny 対応）

### 例：複雑な permission 設定

```jsonc
{
  "permissions": {
    "production": {
      "read": {
        "allow": ["./data", "./config"],
        "deny": ["./config/secrets"]
      },
      "write": ["./data/output"],
      "net": ["api.example.com", "cdn.example.com"],
      "env": {
        "allow": ["NODE_ENV", "PORT"],
        "deny": ["SECRET_KEY"]
      }
    },
    "development": {
      "all": true // 開発時はすべて許可
    }
  }
}
```

## Test、Bench、Compile 用の permissions

`test`、`bench`、`compile` キー内で permission を指定できます。

### インライン定義

```jsonc
{
  "test": {
    "permissions": {
      "read": ["./data"]
    }
  }
}
```

### permission set の参照

```jsonc
{
  "test": {
    "permissions": "read-data"
  },
  "permissions": {
    "read-data": {
      "read": ["./data"]
    }
  }
}
```

### 使用時の注意

config に permissions が定義されている場合、`-P` または permission
フラグの指定が必須：

```bash
# エラー
deno test
# error: Test permissions were found in the config file. Did you mean to run with `-P`?

# OK
deno test -P
deno test --allow-read
deno test -A
```

これにより、権限を忘れたまま実行してしまうミスを防げます。

## Workspace での permissions

Test と bench の permissions は、最も近い `deno.json`
が使用されます。これにより、workspace のメンバーごとに異なる権限を設定できます。

## セキュリティリスク

Config ファイル内の permissions の脅威モデルは `deno task`
と同様です。スクリプトが `deno.json`
を変更して権限を昇格できる可能性があるため、`-P`
による明示的なオプトインが必要です。

このリスクを理解した上で使用すれば、非常に便利な機能です。

## 最新の型定義（config-file.v1.json より）

### permissionConfigValue

```typescript
type PermissionConfigValue = boolean | string[];
```

### allowDenyIgnorePermissionConfig

```typescript
interface AllowDenyIgnorePermissionConfig {
  allow?: boolean | string[];
  deny?: boolean | string[];
  ignore?: boolean | string[];
}
```

### allowDenyPermissionConfig

```typescript
interface AllowDenyPermissionConfig {
  allow?: boolean | string[];
  deny?: boolean | string[];
}
```

### permissionSet

```typescript
interface PermissionSet {
  all?: boolean;
  read?: PermissionConfigValue | AllowDenyIgnorePermissionConfig;
  write?: PermissionConfigValue | AllowDenyPermissionConfig;
  import?: PermissionConfigValue | AllowDenyPermissionConfig;
  env?: PermissionConfigValue | AllowDenyIgnorePermissionConfig;
  net?: PermissionConfigValue | AllowDenyPermissionConfig;
  run?: PermissionConfigValue | AllowDenyPermissionConfig;
  ffi?: PermissionConfigValue | AllowDenyPermissionConfig;
  sys?: PermissionConfigValue | AllowDenyPermissionConfig;
}
```

### permissionNameOrSet

```typescript
type PermissionNameOrSet = string | PermissionSet;
```

## 参考リンク

- https://docs.deno.com/runtime/fundamentals/configuration/#permissions
- https://github.com/denoland/deno/blob/main/cli/schemas/config-file.v1.json
