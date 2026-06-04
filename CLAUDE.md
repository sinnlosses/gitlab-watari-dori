# gitlab-watari-dori

GitLab の複数プロジェクトに対して、設定されたブランチペアの自動マージリクエストを作成する TypeScript スクリプト。

## コマンド

```bash
pnpm install          # 依存関係インストール
pnpm dev              # 開発実行（tsx src/main.ts）
pnpm build            # TypeScript コンパイル
pnpm start            # ビルド済み実行（node dist/main.js）
pnpm lint             # oxlint でリント
pnpm fmt              # oxfmt でフォーマット
pnpm test             # vitest でテスト実行
pnpm validate-config  # config/ ディレクトリの YAML スキーマ検証
pnpm check            # 型チェック・リント・フォーマット・テスト・config 検証 一括実行
```

## コーディング規約

- **セミコロンなし**（oxfmt が管理）
- **`pnpm fmt` を変更後に必ず実行**すること
- テストフレームワークは **vitest**
- HTTP エラーハンドリングは `src/utils/http.ts` の既存ユーティリティを使うこと
- 環境変数はすべて `src/lib/env.ts` で管理する

## テスト方針

- **TDD 必須**: 実装コードの前に失敗するテストを書く
- テストは `test/` 以下に配置する
- GitLab API クライアント（`@gitbeaker/rest`）は `vi.mock` でモックする
- **`pnpm test` が通ることを確認してから完了と報告すること**

## アーキテクチャ

```
src/main.ts           エントリポイント（起動のみ）
src/index.ts          メインロジック（createMrIfNeeded, main, parseSkipProjectIds）
src/lib/gitlab.ts     GitLab API 操作（@gitbeaker/rest ラッパー）
src/lib/config.ts     repositories.yaml のロード・Zod バリデーション
src/lib/env.ts        環境変数のロード・エクスポート
src/utils/errors.ts   FatalError クラス
src/utils/http.ts     HTTP ステータス判定（isFatalStatus: 401/5xx = fatal）
src/utils/logger.ts   構造化 JSON ロガー
```

## エラーハンドリング方針

- **401 / 5xx** → `FatalError` をスロー → 即時 `process.exit(1)`
- **ブランチ不在** → `ERROR`（設定ミスとみなす）
- **差分なし / MR 既存** → `SKIPPED`
- **その他の API エラー** → `ERROR`（ログ記録して継続）
