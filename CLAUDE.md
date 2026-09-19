# CLAUDE.md

> コマンド・設定・プロジェクト構成の一覧は [`README.md`](./README.md)、各項目の詳細は
> [`docs/`](./docs/README.md) を参照。ここには**入口と、迷ったときの行き先**だけを置く。

## 対話言語

ユーザーとの対話は常に日本語で行う。

## プロジェクト概要

設定された「ブランチペア」（`develop → staging` など）を定期的に巡回し、**差分があり、
まだオープンな MR が無いときだけ** GitLab のマージリクエストを自動作成する CLI ツール。
GitLab CI のスケジュールパイプラインから実行する前提で、**状態を保存せず、毎回 GitLab の
現在の状態だけで判断する**。

スコープ外のこと（MR のマージ・コンフリクト解消・GitHub 対応など）は
[`docs/requirements.md`](./docs/requirements.md)「2.2 対象外とすること」が正典。

## セットアップ / 環境構築

- Node.js 22.x, pnpm 11.x
- `pnpm install` で依存関係をインストール
- ローカル実行には `.env` に `GITLAB_URL` と、各設定ファイルの `accessTokenEnv` が指す
  `ACCESS_TOKEN_*`（`api` スコープ）を設定する
- タスク運用スキル（`/next-task`・`/plan-tasks`・`/list-tasks`）はユーザー単位
  （`~/.claude/skills/`）に導入されている前提。未導入でもビルド・テストは通るが、
  下の「進捗管理とHandoff」の進め方はできない

## よく使うコマンド

```bash
pnpm check                          # tsc --noEmit + lint + format:check + test（変更後は必ずこれを通す）
pnpm test                           # テスト全体
npx vitest run test/lib/config.test.ts  # 単体テストファイルのみ実行
pnpm lint                           # oxlint + config/ のバリデーション
pnpm format                         # oxfmt で自動整形
pnpm dev                            # tsx でローカル実行（.env を読み込む）
pnpm build && pnpm start            # ビルドしてから実行
```

## アーキテクチャ概要

`index.ts` → `main.ts` の `run()` → `process()` → `createMrIfNeeded()` → `lib/gitlab.ts` の
4 段。実装は直接読めば分かるので、ここには**原則の見出しだけ**を置く。

- **原則1**: この 4 段より下に段を増やさない。判定のロジックは `createMrIfNeeded` に集約し、
  `lib/gitlab.ts` は「API を 1 回叩いて素直な値を返す」だけに保つ
- **原則2**: `src/lib/` に置くかどうかは「特定の技術・外部システム・ファイル形式に依存するか」
  だけで判断する。**「複数箇所から呼ばれる」は `src/utils/` に置く理由にならない**
- **原則3**: 型は `src/types.ts` に置く。`src/main.ts` では `type` を定義しない
- **原則4**: `helpers.ts`・`utils.ts`・`common.ts` のような、**置き場所を名前にしたファイルを
  `src/` に作らない**
- **原則5**: CI・開発用スクリプトからしか呼ばれないコードは `src/` ではなく `scripts/<用途>/`

**置き場の早見表、各ファイルの責務、設計判断（なぜ今の形なのか）、既知の制約は
[`docs/architecture.md`](./docs/architecture.md) が正典。** 上の原則で迷ったら必ずそちらを開く
（このファイルには判断材料を二重に書かない）。

## 設定・環境変数

環境変数の一覧・`config/` のスキーマ・ディレクトリ構成は [`README.md`](./README.md)「設定」章が
正典。**環境変数を足すときは `src/lib/env.ts`・`README.md` の表・`.gitlab-ci.yml` の
`variables` を同時に更新する。**

## テスト方針

**TDD 必須**（RED → GREEN → REFACTOR。`/tdd` スキル参照）。実装コードの前に失敗するテストを書く。

置き場所・モックの方針は [`docs/coding-standards.md`](./docs/coding-standards.md)「テスト」節が
正典（ここには二重に書かない）。要点だけ: テストは `test/` 以下、`@gitbeaker/rest` は
`vi.mock` でモックする。

**IMPORTANT**: 変更後は必ず `pnpm check` を通してから完了を報告する。テスト件数・エラーなどの
根拠なしに「完了しました」と言わない。

## CI/CD

`.gitlab-ci.yml` 参照。`audit`（依存の脆弱性）・`check`（型チェック・lint・テスト）・
`create-merge-requests`（schedule / 手動実行時のみ本体を実行）・`renovate`（依存更新。本体の
処理とは無関係な別機能）の 4 ジョブ。

CI/CD Variables には `GITLAB_URL` と、各設定ファイルの `accessTokenEnv` が指す
`ACCESS_TOKEN_*` を登録する。トークンの変数は必ず **Masked: ON / Protected: ON**（手順は [`README.md`](./README.md)「CI/CD」が正典）。

## コーディング規約

**ルールの一覧**（理由・例外は [`docs/coding-standards.md`](./docs/coding-standards.md) が正典）:

- `as` キャストは極力使わない。ブランド型の生成は `toProjectId` のような factory 関数に
  封じ込め、**それ以外の場所で `as` を使わない**
- 型は `src/types.ts` に置く。`src/main.ts` では `type` を定義しない
- 環境変数はすべて `src/lib/env.ts` で管理する。**モジュールのトップレベルで `process.env` に
  触れてよいのはこのファイルだけ**
- HTTP エラーの判定は `src/utils/http.ts` の既存ユーティリティ（`isFatalError` /
  `extractHttpStatus` / `isNotFoundError` 等）を使う。gitbeaker のエラーの形を知ってよいのは
  このファイルだけ
- `try`/`catch` は `createMrIfNeeded` / `process()` / `branchExists` の 3 箇所だけ。増やさない
- 変数は基本 `const`。型のプロパティは `readonly`、配列は `readonly T[]`
- 相対 import には `.js` 拡張子を付ける（ESM）。型だけの import は `import type`
- コメントは**コードから読み取れないことだけ**を書く。`/** */` は**その関数を呼ぶ人**向け、
  `//` は**実装を読む人**向け。呼び出し元のファイル名は書かず「呼び出し側」と書く
- コード・ドキュメントにタスク番号（`T-` + 3桁）を書かない（コミットメッセージは対象外）

レビュー観点は `/code-review` スキルの Standards 軸（上記＋`docs/coding-standards.md`）と
Spec 軸（`docs/requirements.md`）を参照。

## エラーハンドリング方針

| ケース                          | 対応                                           |
| ------------------------------- | ---------------------------------------------- |
| 401 / 5xx / ネットワーク障害    | `FatalError` をスロー → 即時 `process.exit(1)` |
| 429 / 502 / 503 / 504           | 指数バックオフで最大 3 回リトライ              |
| ブランチ不在                    | `ERROR`（設定ミスとみなす）                    |
| 差分なし / MR 既存 / ドライラン | `SKIPPED`                                      |
| 403 / その他の API エラー       | `ERROR`（ログ記録して継続）                    |

**403 を fatal にしない理由**、`limit.clearQueue()` の位置、fatal 終了時の後始末は
[`docs/architecture.md`](./docs/architecture.md)「設計判断」「既知の制約・注意点」が正典。

## チームエージェント方針

### 3 エージェント構成

| エージェント    | 担当範囲                                                                        | 起動タイミング                                          |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| researcher      | 外部 API 仕様・ライブラリ Changelog・類似実装パターン・既存 Issue/PR の文脈収集 | 外部仕様確認・ライブラリアップグレード・新機能実装時    |
| tdd-implementer | テストリスト作成 → RED → GREEN → REFACTOR のサイクル。バグ調査・デバッグも担当  | 新機能・バグ修正・未テストコードへのテスト追加          |
| reviewer        | テストの質・TDD サイクルの遵守・コーディング規約・ドキュメント整合性のレビュー  | tdd-implementer が GREEN にしたコードをレビューするとき |

### 典型的なフロー

```
# 新機能実装
Agent(researcher, run_in_background=true)    // 仕様確認が必要な場合のみ
→ Agent(tdd-implementer)                     // researcher の結果を渡してから起動
→ Agent(reviewer)                            // GREEN 報告を受けてから起動

# バグ修正
Agent(tdd-implementer)                       // diagnose スキルで根本原因を特定してから委任
→ Agent(reviewer)
```

## Git運用

個人開発のため、**作業ブランチは切らず `main` に直接コミットする**。「デフォルトブランチに
いるならまずブランチを切る」という一般的な既定挙動より、このルールを優先する。レビューのために
差分を分けたいときなど、必要な場合だけ明示的に指示する。

## タスク運用

- 検証コマンド: `pnpm check`（変更後は必ずこれを通す。受け入れ判定に使う）
- 整形コマンド: `pnpm format`
- ブランチ: 切らない。直接 main にコミットする（理由は上の「Git運用」）

`develop/tasks.json`・`develop/progress.md`・`develop/direction.md` で管理する。
指示は `develop/direction.md` に溜め、`/plan-tasks` でタスク化して `/next-task` で進める。

## 進捗管理とHandoff

会話やセッションが切れても再開できるよう、状態はチャットではなく `develop/` 配下の
`tasks.json` / `progress.md` に記録する。ユーザーからの指示も同様に `direction.md` に書く。
**各手順の詳細（フィールド定義・difficulty の基準と委譲の書き方・evidence の粒度・
アーカイブのトリガーと手順）は、ユーザー単位スキル `task-workflow` の `WORKFLOW.md` が正典。**
このプロジェクト固有の値は上の「タスク運用」節、経緯は
[`docs/workflow.md`](./docs/workflow.md) に書く。

1. セッション開始時に `develop/progress.md` と `develop/tasks.json` を読み、アーカイブすべき
   タイミングなら作業前にアーカイブする。`develop/direction.md` に見出し以外の中身があれば
   未タスク化の指示が残っているので、他の作業より先に `/plan-tasks` でタスク化する
2. `tasks.json` から依存が完了済みの `todo` タスクを1つ選ぶ
3. 作業する。タスクは **`difficulty` と同じモデルを指定したサブエージェントに委譲**する
   （メインセッションのモデルは判断材料にしない）。想定より判断が必要だと分かったら、
   その場で押し切らず `difficulty` を上げてから再開する
4. 完了の判定はテスト結果・生成物・実行ログなど検証可能な証拠で行う（宣言だけで合格にしない）
5. `develop/tasks.json` の `status`/`passes`/`evidence` と `develop/progress.md` を更新する

**IMPORTANT**: 以下は必ず人間の承認を得てから行う — 外部への公開・送信、破壊的な git 操作、
本番/共有環境への反映、認証情報や権限の変更、**実 GitLab への MR 作成を伴う検証**。

## 関連リンク

- ドキュメントの索引: [`docs/README.md`](./docs/README.md)
- 要件（何を作るか / 作らないか、判定順序、非機能要件）: `docs/requirements.md`
- アーキテクチャ詳細（置き場の早見表、設計判断、既知の制約）: `docs/architecture.md`
- コーディング規約の詳細（各ルールの理由・例外）: `docs/coding-standards.md`
- 用語集（ドメイン用語とコード上の識別子の対応）: `docs/glossary.md`
- 実機スモークテストの手順: `docs/smoke-test.md`
- 進捗管理の詳細: ユーザー単位スキル `task-workflow` の `WORKFLOW.md`。
  このプロジェクト固有の値と経緯は `docs/workflow.md`
- 完了タスク・過去セッションの記録: `docs/history/`（アーカイブ時に自動生成される。
  セッション開始時に読む必要はない）
- 調査記録（一次情報の出典と、採らなかった案）: `docs/research/`（必要になった時点で作る）
