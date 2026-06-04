<p align="center">
  <img src="assets/logo.svg" alt="gitlab-watari-dori" width="280"/>
</p>

<h1 align="center">gitlab-watari-dori</h1>

<p align="center">
  渡り鳥が季節ごとに決まった経路を辿るように、設定されたブランチペアを定期的に巡回し、<br>
  必要なときだけマージリクエストを自動作成します。
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/pnpm-11-f69220?logo=pnpm" alt="pnpm">
  <img src="https://img.shields.io/badge/Tested_with-Vitest-6e9f18?logo=vitest" alt="Vitest">
  <img src="https://img.shields.io/badge/GitLab_CI-Compatible-fc6d26?logo=gitlab" alt="GitLab CI">
</p>

---

`develop → staging → production` のような多段リリースフローを持つチームでは、毎回の MR 作成がオーバーヘッドになりがちです。  
**gitlab-watari-dori** はスケジュールパイプラインから定期実行することで、差分があるブランチペアへの MR 作成を完全自動化します。

## Features

- **複数プロジェクト・複数ブランチペアに対応** — 1 つの YAML に複数リポジトリ・ブランチペアを定義。チームごとにファイルを分割できます
- **重複作成を防ぐ 3 段階チェック** — ①ブランチ存在確認 → ②差分コミット確認 → ③既存 MR 確認 の順に検証し、必要なときだけ作成します
- **並列実行による高速処理** — `CONCURRENCY_LIMIT` で同時実行数を制御（デフォルト: 5）
- **自動リトライ** — Rate Limit (429) やゲートウェイエラー (502/503/504) を検出し、指数バックオフで最大 3 回リトライします
- **ドライランモード** — `DRY_RUN=true` で API 呼び出しをスキップ。設定ファイルのバリデーションを安全に確認できます
- **構造化ログ出力** — すべての処理結果を JSON 形式で出力。CI ログから直接収集・解析できます
- **設定バリデーション** — 起動時に Zod でスキーマを検証し、設定ミスを早期に検出します
- **特定プロジェクトのスキップ** — `SKIP_PROJECT_IDS` で緊急メンテナンス時などに一時除外できます

## Quick Start

**前提条件**

- Node.js 22.x 以上
- pnpm 11.x 以上
- GitLab Personal Access Token または Project Access Token（スコープ: `api`）

```bash
# 1. インストール
git clone <this-repo>
cd gitlab-watari-dori
pnpm install

# 2. 設定ファイルを作成
cp config/team-a.yaml config/my-team.yaml
# → project_id と branch_pairs を自分の環境に合わせて編集

# 3. 動作確認（API 呼び出しなし・安全）
GITLAB_URL=https://gitlab.example.com \
ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx \
DRY_RUN=true \
pnpm dev

# 4. 実行
GITLAB_URL=https://gitlab.example.com \
ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx \
pnpm dev
```

> **ヒント:** `DRY_RUN=true` を指定すると GitLab API への呼び出しを一切行いません。MR の事前確認には使えませんが、設定ファイルのバリデーションは確認できます。

## 仕組み

`config/` に定義されたリポジトリとブランチペアを並列処理し、以下の条件をすべて満たす場合のみ MR を作成します。

```mermaid
flowchart TD
    A[⏰ スケジュールパイプライン起動] --> B[config/ を読み込む]
    B --> C{対象リポジトリを並列処理}
    C --> D[source / target ブランチ存在確認]
    D -->|不在| E[❌ ERROR]
    D -->|存在| F[差分コミット確認]
    F -->|差分なし| G[⏭ SKIPPED]
    F -->|差分あり| H[オープン MR 確認]
    H -->|MR 既存| G
    H -->|MR なし| I[✅ MR 自動作成]
```

### 実行ログの例

```json
{"level":"info","event":"run_start","dryRun":false,"concurrencyLimit":5}
{"level":"info","projectId":123,"projectName":"my-service-a","source":"develop","target":"staging","result":"CREATED"}
{"level":"info","projectId":124,"projectName":"my-service-b","source":"develop","target":"staging","result":"SKIPPED","reason":"no_diff"}
{"level":"info","projectId":125,"projectName":"my-service-c","source":"develop","target":"staging","result":"SKIPPED","reason":"mr_exists"}
{"level":"info","event":"summary","CREATED":1,"SKIPPED":2,"ERROR":0}
{"level":"info","event":"run_end","duration_ms":842}
```

## 設定

### 環境変数

| 変数名              | 必須 | デフォルト | 説明                                                                                           |
| ------------------- | :--: | ---------- | ---------------------------------------------------------------------------------------------- |
| `GITLAB_URL`        |  ✓   | —          | GitLab インスタンスの URL（`http://` または `https://` で始まる形式）                          |
| `ACCESS_TOKEN`      |  ✓   | —          | `api` スコープを持つ Personal Access Token または Project Access Token（`glpat-...`）          |
| `SKIP_PROJECT_IDS`  |      | —          | MR 作成をスキップするプロジェクト ID（カンマ区切り、例: `"123,456"`）                          |
| `CONFIG_PATH`       |      | `config/`  | 設定ファイルまたはディレクトリのパス（`..` を含むパスは拒否されます）                          |
| `CONCURRENCY_LIMIT` |      | `5`        | 並列実行数（1 以上の整数。非整数・0 以下はエラーで終了）                                       |
| `DRY_RUN`           |      | `false`    | `"true"` のとき GitLab API への呼び出しを一切行わず、すべての結果を `SKIPPED` として出力します |

### config/

対象リポジトリとブランチペアをチームごとのファイルで定義します。`config/` ディレクトリ内の `.yaml` / `.yml` ファイルをアルファベット順に読み込み、結合します。

```
config/
├── team-a.yaml
└── team-b.yaml
```

```yaml
# config/my-team.yaml

repositories:
  # project_id: GitLab の Settings > General または URL から確認できる数値 ID
  - project_id: 123
    project_name: my-service-a # ログ表示用の任意の識別名
    branch_pairs:
      # develop → staging への定期 MR を自動作成
      - source: develop
        target: staging
      # staging → production へのリリース MR を自動作成
      - source: staging
        target: production

  - project_id: 456
    project_name: my-service-b
    branch_pairs:
      - source: develop
        target: main
```

> **バリデーション:** `source` / `target` が空文字・同一ブランチ名・`..` を含むパスの場合は起動時にエラーで終了します。

設定ファイルの文法チェックのみ実行する場合:

```bash
pnpm lint:validate-config
```

単一ファイルで管理する場合は `CONFIG_PATH=path/to/file.yaml` で指定できます。

## エラーハンドリング

| ケース                                                 | 挙動                                        |
| ------------------------------------------------------ | ------------------------------------------- |
| 401 認証エラー / 5xx サーバーエラー / ネットワーク障害 | 即時 `exit(1)` でパイプライン失敗           |
| 429 / 502 / 503 / 504                                  | 指数バックオフで最大 3 回リトライ後にエラー |
| ブランチ不在                                           | 該当ペアを `ERROR` としてログ記録し処理継続 |
| 差分なし / MR 既存                                     | `SKIPPED` としてログ記録                    |
| その他の API エラー                                    | 該当ペアを `ERROR` としてログ記録し処理継続 |

1 件以上の `ERROR` があってもパイプラインは成功扱いで終了します（致命的エラーを除く）。

## CI/CD

`.gitlab-ci.yml` にジョブが定義されています。GitLab の **スケジュールパイプライン** として設定することで定期実行できます。

### ジョブ構成

| ジョブ名                | トリガー        | 内容                           |
| ----------------------- | --------------- | ------------------------------ |
| `audit`                 | push / MR       | 依存パッケージの脆弱性チェック |
| `check`                 | push / MR       | 型チェック・リント・テスト     |
| `create-merge-requests` | schedule / 手動 | MR の自動作成メイン処理        |

### セットアップ手順

1. **Settings > CI/CD > Variables** に以下を登録する

   | 変数名         | Masked | Protected | 説明                            |
   | -------------- | :----: | :-------: | ------------------------------- |
   | `GITLAB_URL`   |        |           | GitLab インスタンスの URL       |
   | `ACCESS_TOKEN` |   ✓    |     ✓     | Personal / Project Access Token |

   > **セキュリティ:** `ACCESS_TOKEN` は必ず **Masked: ON / Protected: ON** で登録してください。ジョブログへの値の露出を防ぎます。Project Access Token を使用する場合はロールを `Developer` 以上に設定してください。

2. **CI/CD > Schedules** でスケジュールを作成する（例: 毎朝 9:00 JST → `0 0 * * *`）

### 手動実行時のオプション（Pipeline inputs）

Web UI または API からパイプラインを手動起動する際に指定できます。

| input              | 型      | デフォルト | 説明                                        |
| ------------------ | ------- | ---------- | ------------------------------------------- |
| `dry_run`          | boolean | `false`    | `true` のとき MR を作成しない               |
| `skip_project_ids` | string  | `""`       | スキップするプロジェクト ID（カンマ区切り） |

## 開発

```bash
# 依存インストール
pnpm install

# 型チェック・リント・フォーマット・テストをまとめて実行
pnpm check

# 個別実行
pnpm lint             # リント + 設定ファイルバリデーション
pnpm format           # フォーマット
pnpm test             # テスト
pnpm test:coverage    # カバレッジ付きテスト

# ローカル実行（TypeScript 直接）
GITLAB_URL=https://gitlab.example.com ACCESS_TOKEN=<token> pnpm dev

# 本番ビルド後に実行
pnpm build
GITLAB_URL=https://gitlab.example.com ACCESS_TOKEN=<token> pnpm start
```

### プロジェクト構成

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
├── config/               # 対象リポジトリ設定
├── .gitlab-ci.yml        # CI ジョブ定義
└── package.json
```

## Contributing

バグ報告・機能提案は Issue にてお知らせください。

プルリクエストを送る場合:

1. ブランチを切る（`git checkout -b feat/your-feature`）
2. テストを追加する（TDD 推奨）
3. `pnpm check` が通ることを確認する
4. プルリクエストを作成する

## License

[MIT](./LICENSE)
