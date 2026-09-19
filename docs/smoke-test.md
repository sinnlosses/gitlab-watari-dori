# 実機スモークテスト手順

ユニットテストは `@gitbeaker/rest` をモックするため、**GitLab API の実際の応答とのズレは
検出できない**。gitbeaker のアップグレード時、GitLab インスタンスの更新後、判定ロジックを
変えたときは、この手順で実機確認する。

## 用意するもの

| もの                       | 内容                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| 検証用 GitLab プロジェクト | 壊してよいもの 1 つ。`api` スコープのトークンでアクセスできること                  |
| ブランチ 3 本              | `main`（= target）、`feat-diff`（差分あり）、`feat-empty`（`main` と同一コミット） |
| `.env`                     | `GITLAB_URL` と、設定ファイルの `accessTokenEnv` が指す環境変数                    |
| 検証用設定ファイル         | `CONFIG_PATH` で指す。`config/` は汚さない                                         |

ブランチの作り方:

```bash
# main から分岐して空でないコミットを 1 つ置く
git switch -c feat-diff main && echo smoke >> README.md && git commit -am "smoke" && git push -u origin feat-diff
# main と同一コミットのブランチ
git switch -c feat-empty main && git push -u origin feat-empty
```

検証用設定ファイル（例: `/tmp/smoke.yaml` ではなく**作業ディレクトリ内**に置くこと。
`CONFIG_PATH` は作業ディレクトリ外を拒否する）:

```yaml
# smoke-config.yaml（.gitignore されないので、確認後に消す）
accessTokenEnv: ACCESS_TOKEN_SMOKE
repositories:
  - projectId: <検証用プロジェクトの数値 ID>
    projectName: smoke
    branchPairs:
      - source: feat-diff
        target: main
      - source: feat-empty
        target: main
      - source: no-such-branch
        target: main
```

## 手順

```bash
# 0. 環境変数を用意する（.env でもよい）
export GITLAB_URL=https://gitlab.example.com
export ACCESS_TOKEN_SMOKE=<api スコープのトークン>  # 設定ファイルの accessTokenEnv と同じ名前
export CONFIG_PATH=smoke-config.yaml
```

### パス1: ドライラン（書き込みなし）

```bash
DRY_RUN=true pnpm dev
```

期待する結果:

| ブランチペア              | `result`  | `reason`                                            |
| ------------------------- | --------- | --------------------------------------------------- |
| `feat-diff` → `main`      | `SKIPPED` | `dry_run`                                           |
| `feat-empty` → `main`     | `SKIPPED` | `no_diff`                                           |
| `no-such-branch` → `main` | `ERROR`   | `branch_not_found. missingBranches: no-such-branch` |

`summary` は `{"CREATED":0,"SKIPPED":2,"ERROR":1}`、終了コードは `1`
（`ERROR` が 1 件あるため `PARTIAL_FAILURE`）。

### パス2: 実作成（**人間の承認を得てから**）

```bash
pnpm dev
```

`feat-diff` → `main` が `CREATED` になり、GitLab 上に
`Auto MR by Watari-Dori : feat-diff into main` というタイトルの MR ができていること。

### パス3: 再実行（重複作成しないこと）

パス2 の MR を**開いたまま**もう一度実行する。

```bash
pnpm dev
```

`feat-diff` → `main` が `SKIPPED` / `mr_exists` になること。**MR が 2 件にならないこと**を
GitLab の UI でも確認する。

### パス4: 認証エラー（即時終了すること）

```bash
ACCESS_TOKEN_SMOKE=invalid-token pnpm dev
```

`fatal_error` イベントが出て即座に終了し、終了コードが `1` であること。
`create_mr` の結果ログが**全件は出ないこと**（`limit.clearQueue()` が効いている）。

### パス5: プロジェクトスキップ

```bash
SKIP_PROJECT_IDS=<検証用プロジェクトの数値 ID> DRY_RUN=true pnpm dev
```

`skip_projects` イベントが出て、`create_mr` のログが 1 件も出ないこと。
`summary` は全件 0 で、終了コードは `0`。

## 後片付け

1. パス2 で作られた MR を閉じる（マージしない）
2. `feat-diff` / `feat-empty` ブランチを削除する
3. `smoke-config.yaml` を削除する
4. `unset GITLAB_URL ACCESS_TOKEN_SMOKE CONFIG_PATH`

## 繰り返すときの注意

- パス3 の後にもう一度パス2 を試すには、**先に MR を閉じる**（`mr_exists` で止まる）
- `feat-diff` に新しいコミットを積まなくても、MR を閉じれば `no_diff` にはならない
  （差分自体は残っているため）
