# コーディング規約の詳細

ルールの一覧は [`CLAUDE.md`](../CLAUDE.md)「コーディング規約」にある。このファイルには
**各ルールの理由と例外**を書く（一覧を二重に持たない）。

## 節の索引

| 節                 | 何が書いてあるか                                  |
| ------------------ | ------------------------------------------------- |
| `as` キャスト      | 使ってよい唯一の場所と、その理由                  |
| 型の置き場所       | `src/types.ts` に寄せる理由                       |
| 環境変数の扱い     | `src/lib/env.ts` を通す理由                       |
| エラー処理の書き方 | `utils/http.ts` の使い分けと `try`/`catch` の位置 |
| 不変性             | `const` と `readonly` の扱い                      |
| import と ESM      | 拡張子・並び順                                    |
| コメント           | 何を書き、何を書かないか                          |
| テスト             | 置き場所・モック・TDD                             |

## `as` キャスト

**`as` を書いてよいのは `src/types.ts` の factory 関数の中だけ。**

```ts
export function toProjectId(n: number): ProjectId {
  return n as ProjectId
}
```

ブランド型は構造上 `as` なしでは作れないので、生成をこの 4 関数
（`toProjectId` / `toProjectName` / `toBranchName` / `toGitLabUrl`）に閉じ込め、
**それ以外の場所からは `as` を消せる**ようにしている。呼び出し側に `as` が現れたら、
factory を通していないか、そもそも型が合っていないかのどちらか。

外部入力から作る場合も factory を通す。`src/lib/config.ts` は Zod の
`.transform(toBranchName)` を使っており、**検証を通った値だけ**がブランド型になる。

`as const` と、テスト内でのモックの型合わせはこの規約の対象外。

## 型の置き場所

**`src/main.ts` に `type` を定義しない。型は `src/types.ts` に置く。**

`main.ts` は判定のロジックを読む場所で、型定義が混ざると「このツールの語彙が何か」を
知るのに 2 ファイルを開くことになる。`types.ts` を開けば語彙が一覧できる状態を保つ。

`src/lib/gitlab.ts` の `GitlabClient` のように、**外部ライブラリの型からの派生**だけは
その場に置く（`types.ts` に置くと `types.ts` が gitbeaker に依存してしまう）。

## 環境変数の扱い

**`process.env` に触れてよいのは `src/lib/env.ts` だけ。** 読み取りは同ファイルの
`loadEnv` / `loadOptionalEnv` を通す。

- `loadEnv`: 未設定・空白のみなら例外を投げる（必須の変数用）
- `loadOptionalEnv`: 未設定・空白のみなら `undefined`（空文字は「未設定」として扱う）

値はモジュールのトップレベルで評価・検証する。**設定ミスは起動直後に落ちるべき**で、
並列処理の途中で初めて気づくのは遅い（[`architecture.md`](./architecture.md)「設計判断」）。

例外はアクセストークンで、環境変数名が設定ファイル由来のため `const` にできない。
`loadAccessToken` / `assertAccessTokensPresent` を使い、MR を 1 件も作らないうちに
`process()` の冒頭でまとめて検証する。

新しい環境変数を足すときは、`env.ts` に `export const` を足し、
[`README.md`](../README.md) の環境変数表と `.gitlab-ci.yml` の `variables` も同時に更新する。

## エラー処理の書き方

**HTTP エラーの判定を自分で書かない。** `src/utils/http.ts` の既存ユーティリティを使う。

| 関数                | 使いどころ                                             |
| ------------------- | ------------------------------------------------------ |
| `extractHttpStatus` | ステータスをログに載せたいとき                         |
| `isNotFoundError`   | 404 を「無い」という値に変換するとき（`branchExists`） |
| `isFatalStatus`     | ステータス値から直接判定するとき                       |
| `isFatalError`      | 例外から判定するとき（ネットワーク障害も含む）         |
| `toErrorMessage`    | `unknown` をログ用の文字列にするとき                   |

gitbeaker のエラー構造（`Error → cause.response.status`）を知ってよいのは `utils/http.ts`
だけ。他のファイルで `error.cause` を掘らない。

**`try`/`catch` の位置**:

- `src/main.ts` の `createMrIfNeeded` — API エラーを `ERROR` という値に変換する
- `src/main.ts` の `process()` — `FatalError` を検出して `limit.clearQueue()` を呼ぶためだけ
- `src/lib/gitlab.ts` の `branchExists` — 404 を `false` に変換するためだけ

これ以外の場所に `try`/`catch` を増やさない。増やすと「どこでエラーが値に変わるのか」が
追えなくなる。

## 不変性

- 変数は基本 `const`。`let` は `retry.ts` のループ変数のように、再代入が本質的な場面だけ
- 型のプロパティは `readonly`、配列は `readonly T[]`（`types.ts` の各型を参照）
- 集計は再代入ではなく `reduce` / スプレッドで新しいオブジェクトを作る

## import と ESM

- **相対 import には `.js` 拡張子を付ける**（`"./main.js"`）。ソースは `.ts` だが、
  ESM 出力がそのまま解決できる必要がある
- 型だけの import は `import type` を使う
- 並び順は「外部パッケージ → 空行 → 内部モジュール」。`oxfmt` が整形する

## コメント

**コードから読み取れないことだけ**を書く。型名・関数名の言い換えは書かない。

- `/** */` は**その関数を呼ぶ人**向け。何を返すか、どんなときに何を返すかを書く
  （`createMrIfNeeded` の JSDoc が手本）
- `//` は**実装を読む人**向け。なぜこの書き方なのかを書く。`process()` の
  `limit.clearQueue()` の前のコメント、`utils/http.ts` の 403 に関するコメントが手本
- 呼び出し元のファイル名を書かない（呼び出し元が変わると嘘になる）。「呼び出し側」と書く
- コード・ドキュメントにタスク番号を書かない（コミットメッセージは対象外。
  [`workflow.md`](./workflow.md)「コミットメッセージ」）

## テスト

### 置き場所とモック

- テストは `test/` 以下に、`src/` と同じ階層で置く（`src/lib/env.ts` → `test/lib/env.test.ts`）
- GitLab API クライアント（`@gitbeaker/rest`）は `vi.mock` でモックする。**実 API を叩かない**
- HTTP エラーの生成は `test/helpers.ts` の `makeHttpError(status)` を使う。
  gitbeaker のエラー構造を各テストに写さない

### TDD

**実装コードの前に失敗するテストを書く**（RED → GREEN → REFACTOR）。`/tdd` スキル参照。

### 完了の判定

**`pnpm check`（型チェック・lint・format チェック・テスト）が通ることを確認してから完了と
報告する。** テスト件数やエラー出力などの根拠なしに「完了しました」と言わない。
