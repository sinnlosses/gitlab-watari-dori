# 進捗管理とHandoffの詳細（このプロジェクト固有の部分）

`develop/tasks.json` / `develop/progress.md` / `develop/direction.md` でタスクを管理する運用の
**ルール本体（フィールド定義、`summary`・`difficulty` の基準、evidence の書き方、アーカイブの
トリガーと手順）は、ユーザー単位スキル `task-workflow` の `WORKFLOW.md` が正典**
（`~/.claude/skills/task-workflow/WORKFLOW.md`）。手順そのものは
[`CLAUDE.md`](../CLAUDE.md)「進捗管理とHandoff」が正典。

このファイルには、**このプロジェクトでしか成り立たないこと**だけを書く。

## このプロジェクトの値

検証コマンドと整形コマンドは [`CLAUDE.md`](../CLAUDE.md)「## タスク運用」節が正典。
それ以外（タスク ID の接頭辞 `T-`、アーカイブ先 `docs/history/`、アーカイブのトリガー）は
既定値のまま。

## コミットメッセージ

タスクに対応するコミットは件名の先頭にタスク ID を置く（書式は正典「コミットメッセージ」）。
[`coding-standards.md`](./coding-standards.md)「コメント」がコードとドキュメントにタスク番号を
書くことを禁じているが、**コミットメッセージはその対象外**。ID はアーカイブ後も
`docs/history/tasks.md` に `## T-XXX` の節として残るため、参照先の消えた識別子にはならない。

## 受け入れ判定に使う証拠

このプロジェクトの検証コマンドは `pnpm check`（型チェック → lint → format チェック → テスト）。
evidence には**テスト件数と、変更したファイル**を書く。`pnpm test` だけを走らせて
「通りました」とは書かない（型エラーと lint を見逃す）。

実 GitLab を叩く確認が必要なタスクは、[`smoke-test.md`](./smoke-test.md) の手順で
`DRY_RUN=true` の結果までを evidence にする。**MR を実際に作る検証は人間の承認を得てから**行う。

## evidence に書かない経緯の行き先

- 要件に関わるもの → [`requirements.md`](./requirements.md)
- 設計に関わるもの → [`architecture.md`](./architecture.md)「設計判断」
- 規約に関わるもの → [`coding-standards.md`](./coding-standards.md)
- それ以外 → `docs/history/` のアーカイブ
