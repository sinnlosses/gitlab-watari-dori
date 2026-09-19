# 進捗

## 完了したこと

### 2026-09-20 config スキーマをグループ単位にし accessTokenEnv を必須化（T-001）

設定ファイル 1 つ = 1 グループとして `accessTokenEnv`（環境変数名。`ACCESS_TOKEN_` 始まり必須）を
トップレベルに追加し、`Config` を `readonly ConfigGroup[]` に変更した。実行時のトークンはまだ
単一の `ACCESS_TOKEN` のままで、グループごとの作り分けは次タスクの担当。

## 未解決

## 注意
