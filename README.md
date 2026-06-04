# gitlab-watari-dori

GitLab の複数プロジェクトに対して、設定されたブランチペアの自動マージリクエストを作成するスクリプトです。
GitLab CI のスケジュールパイプラインから定期実行することを想定しています。

## 動作概要

`config/` ディレクトリ（または `CONFIG_PATH` で指定したファイル）に定義されたリポジトリとブランチペアを読み込み、以下の条件をすべて満たす場合にマージリクエストを自動作成します。

1. `source` / `target` ブランチが両方とも存在する
2. `source` → `target` に差分コミットがある
3. 同じブランチペアのオープン中のマージリクエストが存在しない

## セットアップ

```bash
pnpm install
```

## 開発

```bash
# リント
pnpm lint

# フォーマット
pnpm fmt

# テスト
pnpm test

# 型チェック・リント・フォーマット・テストをまとめて実行
pnpm check
```

## 設定

### 環境変数

| 変数名              | 必須 | 説明                                                                  |
| ------------------- | ---- | --------------------------------------------------------------------- |
| `GITLAB_URL`        | ✓    | GitLab インスタンスの URL（例: `https://gitlab.example.com`）         |
| `ACCESS_TOKEN`      | ✓    | マージリクエスト作成権限を持つ Personal Access Token                  |
| `SKIP_PROJECT_IDS`  |      | MR 作成をスキップするプロジェクト ID（カンマ区切り、例: `"123,456"`） |
| `CONFIG_PATH`       |      | 設定ファイルまたはディレクトリのパス（デフォルト: `config/`）         |
| `CONCURRENCY_LIMIT` |      | 並列実行数（デフォルト: `5`）                                         |
| `DRY_RUN`           |      | `true` のとき MR を作成せずログのみ出力する（デフォルト: `false`）    |

### config/

対象リポジトリとブランチペアをチームごとのファイルで定義します。
`config/` ディレクトリ内の `.yaml` / `.yml` ファイルがアルファベット順に読み込まれ、結合されます。

```
config/
├── team-a.yaml
└── team-b.yaml
```

各ファイルの形式:

```yaml
repositories:
  - project_id: 123
    project_name: my-service-a
    branch_pairs:
      - source: develop
        target: client-stg
      - source: client-stg
        target: client-prod
```

| フィールド              | 説明                   |
| ----------------------- | ---------------------- |
| `project_id`            | GitLab プロジェクト ID |
| `project_name`          | ログ表示用の任意の名前 |
| `branch_pairs[].source` | マージ元ブランチ       |
| `branch_pairs[].target` | マージ先ブランチ       |

単一ファイルで管理する場合は `CONFIG_PATH=path/to/file.yaml` で指定できます。

## 実行

### 開発時（TypeScript 直接実行）

```bash
GITLAB_URL=https://gitlab.example.com ACCESS_TOKEN=<token> pnpm dev
```

> `pnpm dev` は内部的に `tsx src/main.ts` を実行します。

### 本番（ビルド後実行）

```bash
pnpm build
GITLAB_URL=https://gitlab.example.com ACCESS_TOKEN=<token> pnpm start
```

## CI/CD

`.gitlab-ci.yml` にジョブが定義されています。GitLab の **スケジュールパイプライン** として設定することで定期実行できます。

必要な CI/CD 変数（Settings > CI/CD > Variables）:

- `GITLAB_URL`（必須）
- `ACCESS_TOKEN`（必須）
- `SKIP_PROJECT_IDS`（任意）
- `CONFIG_PATH`（任意）
- `CONCURRENCY_LIMIT`（任意）
- `DRY_RUN`（任意）

## プロジェクト構成

```
.
├── src/
│   ├── index.ts          # エントリポイント
│   ├── main.ts           # メインロジック
│   ├── types.ts          # 型定義
│   ├── lib/
│   │   ├── gitlab.ts     # GitLab API クライアント操作
│   │   ├── config.ts     # 設定ファイルのロード・パース
│   │   └── env.ts        # 環境変数ユーティリティ
│   └── utils/
│       ├── errors.ts     # カスタムエラー
│       ├── http.ts       # HTTP ユーティリティ
│       └── logger.ts     # 構造化 JSON ロガー
├── test/                 # テスト
├── config/               # 対象リポジトリ設定（複数ファイルに分割）
├── .gitlab-ci.yml        # CI ジョブ定義
└── package.json
```
