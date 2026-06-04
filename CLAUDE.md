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

## チームエージェント方針

**包括的なレビュー・改善提案を求められた場合は、必ず複数の専門エージェントを並列で起動すること。**

### 対象タスク

以下のタスクは単独で回答せず、チームエージェント総力戦で対応する：

- 「改善案を出して」「レビューして」「非機能要件を整理して」など、複数の観点が必要な依頼
- 設計・アーキテクチャ、テスト品質、セキュリティ、コード品質のいずれかが絡む網羅的な調査

### 必須の 4 エージェント構成

単一の `Agent` ツール呼び出しで以下 4 つを **同時に** バックグラウンド起動する：

| エージェント             | 担当範囲                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| 設計・アーキテクチャ     | モジュール境界・責務分離・型設計・並列処理設計・拡張性              |
| テスト品質               | カバレッジの抜け・未テストパス・テスト設計パターン・新規テスト提案  |
| セキュリティ・非機能要件 | シークレット管理・SSRF・ログ漏洩・リトライ戦略・依存関係管理・CI/CD |
| コード品質・実装詳細     | バグ・論理的問題・TypeScript 活用・コメント・設定ファイル           |

### 起動方法

```
Agent(設計レビュー, run_in_background=true)
Agent(テストレビュー, run_in_background=true)
Agent(セキュリティレビュー, run_in_background=true)
Agent(コード品質レビュー, run_in_background=true)
```

4 つ全エージェントの完了を待ってから結果を統合して回答する。

### アウトプット形式

統合結果は以下の構造で社内共有できる形式にまとめる：

1. **総評**（2〜3 文）
2. **即対応**（クリティカルな問題、具体的な修正コード付き）
3. **次スプリント**（優先度高・中の改善、工数目安付き）
4. **次クォーター以降**（設計上の改善、任意対応）
5. **優先度マトリクス**（全項目をリスクレベル・工数・推奨優先度で一覧化）
