# 用語集

ドメイン用語と、コード上の識別子の対応表。**用語を増やすときはコードの識別子と一緒に**書く。

## 用語の索引

| 用語                                          | 節         |
| --------------------------------------------- | ---------- |
| プロジェクト / projectId / projectName        | 対象の指定 |
| ブランチペア / source / target                | 対象の指定 |
| 設定ファイル / 設定の結合 / accessTokenEnv    | 対象の指定 |
| 巡回                                          | 実行の単位 |
| ドライラン                                    | 実行の単位 |
| 処理結果（CREATED / SKIPPED / ERROR）         | 結果       |
| スキップ理由（no_diff / mr_exists / dry_run） | 結果       |
| 実行結果（SUCCESS / PARTIAL_FAILURE）         | 結果       |
| fatal なエラー / リトライ可能なエラー         | エラー     |
| ブランド型                                    | 型         |
| ログイベント                                  | ログ       |

## 対象の指定

### プロジェクト

MR を作成する対象の GitLab リポジトリ。コード上は `RepoConfig`、設定ファイルでは
`repositories[]` の 1 要素。**「リポジトリ」と「プロジェクト」は同義**で、GitLab の
UI 表記に合わせて「プロジェクト」を優先する。

### projectId

GitLab の数値 ID（`ProjectId`。`Settings > General` または URL から確認できる）。
API 呼び出しで実際に使うのはこの値だけ。

### projectName

**ログ表示用の任意の識別名**（`ProjectName`）。GitLab 上の実際の名前と一致する必要はなく、
API 呼び出しにも使われない。人がログを読むときの手がかり。

### ブランチペア

MR の作成方向を表す `source` と `target` の組（`BranchPair`）。`source` → `target` の向きで
MR を作る。1 プロジェクトに複数定義できる（`develop → staging` と `staging → production` など）。

### source / target

- **source**: MR の作成元ブランチ。変更が入っている側
- **target**: MR の取り込み先ブランチ

差分確認では `target` を base に置き、**source にあって target に無いコミット**を数える
（`hasDiff`）。同じブランチ名を両方に指定することはできない（起動時にエラー）。

### 設定ファイル

`config/` 配下の `.yaml` / `.yml`。グループ単位でファイルを分けられる。コード上は 1 ファイル =
`ConfigGroup` 1 件で、これがアクセストークンを割り当てる単位（グループ）にあたる。

### accessTokenEnv

設定ファイルのトップレベルに書く**環境変数の名前**（`AccessTokenEnvName`。必須）。そのファイルの
リポジトリを操作するトークンがどの環境変数に入っているかの宣言で、**トークンの値そのものは
設定ファイルに書かない**。`ACCESS_TOKEN_` で始まる英大文字・数字・アンダースコアの名前だけを許す。

### 設定の結合

`CONFIG_PATH` がディレクトリのとき、配下の `.yaml` / `.yml` を**アルファベット順**に読むこと
（`loadConfigDir`）。ファイルごとに `accessTokenEnv` が違うため `repositories` は連結せず、
**ファイル単位のまとまり（`ConfigGroup`）を保ったまま** `Config`（その配列）にする。
**同じ `projectId` が複数ファイルにあっても重複排除しない**（両方が処理される）。

## 実行の単位

### 巡回

設定に書かれた全プロジェクト × 全ブランチペアを 1 回ずつ処理すること。これがこのツールの
実行 1 回分にあたる。状態を保存しないため、毎回すべてのペアを GitLab に問い合わせる。

### ドライラン

`DRY_RUN=true` のときのモード。**MR 作成だけ**を行わず、判定はすべて実行する。
結果は `SKIPPED`（`reason: "dry_run"`）になる。

## 結果

### 処理結果（MrCreationResult）

ブランチペア 1 件ごとの結末。

| 値        | 意味                                                      |
| --------- | --------------------------------------------------------- |
| `CREATED` | MR を作成した                                             |
| `SKIPPED` | 作成する必要がなかった（理由は `reason` に出る）          |
| `ERROR`   | 作成できなかった（設定ミス、または継続可能な API エラー） |

### スキップ理由（reason）

| 値          | 意味                                   |
| ----------- | -------------------------------------- |
| `no_diff`   | source → target に差分コミットが無い   |
| `mr_exists` | 同じペアのオープン中の MR がすでにある |
| `dry_run`   | ドライランのため作成しなかった         |

`ERROR` のときの `reason` は固定語ではなく、`branch_not_found. missingBranches: ...` または
`httpStatus: ..., message: ...` の形の文字列。

### 実行結果（RunResult）

巡回 1 回分の結末。`ERROR` が 0 件なら `SUCCESS`、1 件以上あれば `PARTIAL_FAILURE`。
`PARTIAL_FAILURE` のとき `exit(1)` する。

**fatal なエラーで落ちた場合は `RunResult` にならない**（例外として投げ上がり、
`index.ts` の `catch` で `exit(1)` する）。

## エラー

### fatal なエラー

全プロジェクトに影響し、処理を続ける意味が無いエラー。**401（認証失敗）・5xx（サーバー障害）・
ネットワーク障害**（`ECONNREFUSED` / `ENOTFOUND` / `ETIMEDOUT`）。`FatalError` に包んで
投げ、即時終了する。

**403 は fatal ではない**。トークンが特定プロジェクトへの権限を持たない場合に起きるため、
そのペアだけ `ERROR` にして続ける。

### リトライ可能なエラー

一時的で、待てば直る見込みのあるエラー。**429 / 502 / 503 / 504**。`withRetry` が指数
バックオフ（1s → 2s）で最大 3 回試す。リトライを使い切ると通常のエラーとして扱われ、
502 / 503 / 504 はそこで fatal に分類される。

## 型

### ブランド型

`number` / `string` に `unique symbol` のマーカーを足して、実体は同じだが型としては
別物にしたもの。`ProjectId` / `ProjectName` / `BranchName` / `GitLabUrl` /
`AccessTokenEnvName` の 5 つがある。
生成は factory 関数（`toProjectId` など）に限る
（[`coding-standards.md`](./coding-standards.md)「`as` キャスト」）。

## ログ

### ログイベント（event）

構造化ログの `event` フィールドに入る固定語。

| 値                | いつ出るか                                                |
| ----------------- | --------------------------------------------------------- |
| `run_start`       | 巡回の開始時（環境変数の実効値を一緒に出す）              |
| `skip_projects`   | `SKIP_PROJECT_IDS` によって除外したプロジェクトがあるとき |
| `create_mr`       | ブランチペア 1 件の判定結果ごと                           |
| `summary`         | 処理結果の件数集計                                        |
| `run_end`         | 巡回の終了時（`duration_ms` を含む）                      |
| `fatal_error`     | `FatalError` で終了したとき                               |
| `unhandled_error` | 想定外の例外で終了したとき                                |
