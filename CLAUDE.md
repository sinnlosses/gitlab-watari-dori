# gitlab-watari-dori — Claude 向け開発ガイド

> コマンド・設定・プロジェクト構成は README.md を参照。

## コーディング規約

- **変更後は必ず `pnpm run check` を実行**すること
- HTTP エラーハンドリングは `src/utils/http.ts` の既存ユーティリティを使うこと
- 環境変数はすべて `src/lib/env.ts` で管理する
- **`as` キャストは極力使わない**。ブランド型の生成は `toProjectId` のような factory 関数に封じ込め、それ以外の箇所で `as` を使わないこと
- `src/main.ts` では `type` を定義せず `src/types.ts`に定義すること

## テスト方針

- **TDD 必須**: 実装コードの前に失敗するテストを書く
- テストは `test/` 以下に配置する
- GitLab API クライアント（`@gitbeaker/rest`）は `vi.mock` でモックする
- **`pnpm test` が通ることを確認してから完了と報告すること**

## アーキテクチャメモ

README の構成図に載っていない実装上の補足：

- `src/main.ts` — `run` / `process` / `createMrIfNeeded` / `parseSkipProjectIds` の 4 関数が主体
  - `run()`: エントリポイント。全体を時間計測でラップ
  - `process()`: 設定読み込み・並列処理・結果集約
- `src/utils/http.ts` — `isFatalStatus`（401/5xx）、`isFatalError`（ネットワーク障害含む）、`extractHttpStatus`
- `src/utils/retry.ts` — 429/502/503/504 を指数バックオフでリトライする `withRetry`
- `src/lib/config.ts` — Zod で BranchPair のバリデーション（空文字・同一ブランチ禁止・パストラバーサル禁止）

## エラーハンドリング方針

| ケース                       | 対応                                           |
| ---------------------------- | ---------------------------------------------- |
| 401 / 5xx / ネットワーク障害 | `FatalError` をスロー → 即時 `process.exit(1)` |
| ブランチ不在                 | `ERROR`（設定ミスとみなす）                    |
| 差分なし / MR 既存           | `SKIPPED`                                      |
| その他の API エラー          | `ERROR`（ログ記録して継続）                    |

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
