# 進捗

## 完了したこと

### 2026-09-20 グループごとのトークンで GitLab クライアントを作り分ける（T-002）

`env.ts` の単一 `ACCESS_TOKEN` export を廃し、環境変数名を受け取る `loadAccessToken` と、
全グループぶんをまとめて検証する `assertAccessTokensPresent` を追加。`process()` は設定を
読んだ直後に検証してからグループごとにクライアントを作る（`pLimit` は1つのまま共有）。

### 2026-09-20 config スキーマをグループ単位にし accessTokenEnv を必須化（T-001）

設定ファイル 1 つ = 1 グループとして `accessTokenEnv`（環境変数名。`ACCESS_TOKEN_` 始まり必須）を
トップレベルに追加し、`Config` を `readonly ConfigGroup[]` に変更した。実行時のトークンはまだ
単一の `ACCESS_TOKEN` のままで、グループごとの作り分けは次タスクの担当。

## 未解決

## 注意
