# 完了タスクのアーカイブ

## T-001

**タスク**: config スキーマをグループ単位にし accessTokenEnv を必須フィールドとして追加する

**difficulty**: opus / **loopable**: Y / **dependencies**: なし / **passes**: True

**evidence**:

pnpm check 通過（11 files / 173 tests, exit 0）。config.test.ts は 19→26 件（accessTokenEnv の必須・命名規則のテスト 7 件追加）。config/team-a.yaml から accessTokenEnv を削ると pnpm lint:validate-config が exit 1 で落ちる（config ERROR: ... invalid_type path: accessTokenEnv）ことを確認。Config = readonly ConfigGroup[] とし loadConfigDir はファイル単位のまとまりを保持。

## 背景

`src/lib/config.ts` の `loadConfigDir()` は `config/` 内の `.yaml` を読み、各ファイルの
`repositories` を `flatMap` で1本の配列に潰している。そのため `Config` 型（`src/types.ts`）は
`{ repositories: readonly RepoConfig[] }` だけを持ち、「どのファイル由来か」という情報は
読み込んだ時点で失われる。

一方 `src/lib/env.ts` はモジュールのトップレベルで `ACCESS_TOKEN = loadEnv("ACCESS_TOKEN")` を
1本だけ読み、`src/main.ts` の `process()` がそれを `createClient()` に渡して全リポジトリで
共有している。グループごとに別のトークンを使うには、まず設定の読み込みがファイル単位の
まとまりを保つ必要がある。

参考実装は `/Users/sinnlos/ghq/github.com/sinnlosses/helm-yadokari`。設定ファイルの
トップレベルに `accessTokenEnv: ACCESS_TOKEN_TEAM_A` と**環境変数名だけ**を宣言し、
トークンの値そのものは設定ファイルに書かせない方式を採っている
（`config.example/my-team-chart/registry.yaml` と `src/lib/config/schema.ts` が実物）。

## 決まっていること（蒸し返さない）

- トークンを割り当てる単位は config ファイル1つ = 1グループ。ファイルのトップレベルに
  `accessTokenEnv` を書く
- `accessTokenEnv` は必須フィールドにする。省略時に単一 `ACCESS_TOKEN` へフォールバックする
  経路は作らない
- グループの実在チェック（トークンが特定のグループ外に届いていないかの照合）は今回の
  スコープに含めない。設定に `groupId` / `groupName` は持たせない

## 解くべき論点

- `Config` 型をどう変えるか。`accessTokenEnv` と `repositories` を持つ型を新設して `Config` を
  その配列にするのが素直だが、`src/main.ts` の `process()` が `repositories` を直接
  `flatMap` して `SKIP_PROJECT_IDS` で絞り込んでいる点への影響を見てから決める
- `accessTokenEnv` に許す値の形。参考実装は `ACCESS_TOKEN_` で始まる名前だけを許し、
  トークンの値そのものを設定ファイルに書けないようにしている。同じ制約を zod スキーマで
  課すかを決める
- ブランド型にするか。`src/types.ts` の既存の `ProjectId` / `BranchName` は factory 関数
  （`toProjectId` 等）でブランド型を作っている。`accessTokenEnv` も同じ形にするかを決める

## やること

1. テストを先に書く（TDD 必須）。`test/lib/config.test.ts` に、`accessTokenEnv` を含む YAML が
   読めること・省略するとエラーになること・不正な名前を弾くことのテストを追加する
2. `src/types.ts` の `Config` 型を変更し、必要なら新しい型と factory 関数を追加する
3. `src/lib/config.ts` の zod スキーマに `accessTokenEnv` を追加し、`loadConfigDir()` が
   ファイル単位のまとまりを保って返すようにする
4. `config/team-a.yaml` と `config/team-b.yaml` に `accessTokenEnv` を追記する
   （`pnpm lint` が `scripts/lint/validate-config.ts` で `config/` を検証するため、これを
   入れないと lint が落ちる）
5. `src/main.ts` は `Config` の形が変わったぶんだけ型が通るように最小限直す。グループごとの
   クライアント作り分けは次のタスクの担当なので、ここではまだ単一の `ACCESS_TOKEN` を
   使ったままでよい

## 完了条件

- `pnpm check` が通る
- `config/team-a.yaml` から `accessTokenEnv` を削ると `pnpm lint:validate-config` が
  エラーで落ちることを確認し、その出力を `evidence` に残す

## 注意

- `src/main.ts` に `type` を定義しない。型は `src/types.ts` に置く
- `as` キャストを factory 関数の外で使わない
- 実際のトークンの値を設定ファイル・テスト・コミットに書かない

## T-002

**タスク**: グループごとのトークンで GitLab クライアントを作り分ける

**difficulty**: opus / **loopable**: Y / **dependencies**: T-001 / **passes**: True

**evidence**:

pnpm check 通過（11 files / 186 tests, exit 0。着手前は 173 件で新規 13 件）。完了条件2は test/main.test.ts > process - グループごとのアクセストークン > 宣言された環境変数が未設定のとき MR 作成を1件も試みずにエラーになる で担保（createClient/branchExists/createMergeRequest がいずれも未呼び出しであることを確認）。env.ts の ACCESS_TOKEN export を廃し loadAccessToken/assertAccessTokensPresent に置換、pLimit は process() に1つのまま共有。

## 背景

`src/lib/env.ts` はモジュールのトップレベルで `export const ACCESS_TOKEN = loadEnv("ACCESS_TOKEN")`
を評価しており、`src/main.ts` の `process()` が `createClient(GITLAB_URL, ACCESS_TOKEN)` で
1つのクライアントを作り、全リポジトリに使い回している。前タスクで設定がグループ単位の
まとまりを持つようになるので、ここを「グループが宣言した環境変数名からトークンを引き、
グループごとにクライアントを作る」形に変える。

CLAUDE.md の規約により、モジュールのトップレベルで `process.env` に触れてよいのは
`src/lib/env.ts` だけ。トークンの環境変数名は設定ファイル由来で実行時にしか分からないため、
トップレベルの `const` では表せず、`env.ts` に名前を受け取る関数を置く形になる。

参考実装（`/Users/sinnlos/ghq/github.com/sinnlosses/helm-yadokari`）では
`src/lib/platform/token-routed-adapter.ts` が `ProjectId` からトークンを引き当てて委譲する
1枚を作り、呼び出し側が複数トークンで動いていることを意識しない形にしている。
watari-dori は `createMrIfNeeded()` が `gitlab` を第1引数で受け取る構造なので、同じ層を
足さなくても、タスクを組む時点でグループのクライアントを渡せば済む可能性が高い。

## 決まっていること（蒸し返さない）

- `accessTokenEnv` は必須。宣言された環境変数が未設定なら起動時にエラーで落とす。
  単一 `ACCESS_TOKEN` へのフォールバックは作らない

## 解くべき論点

- 不足トークンの検出をどこで行うか。MR を1件も作らないうちに全グループぶんまとめて検証して
  落とすのが望ましい。`process()` の冒頭と `env.ts` の関数のどちらに置くかを決める
- グループごとのクライアントを `process()` でどう持ち回すか。CLAUDE.md 原則1（`index.ts` →
  `run()` → `process()` → `createMrIfNeeded()` の4段より下に段を増やさない）を守ること
- 並列度の扱い。`pLimit(CONCURRENCY_LIMIT)` はいま1つのキューで全タスクを捌いている。
  グループ単位のループに変えても、同時実行数が `CONCURRENCY_LIMIT` を超えないようにする
- ログの秘匿。`src/utils/logger.ts` は `ACCESS_TOKEN` というキーを `[REDACTED]` にする実装を
  持つ（`test/utils/logger.test.ts`）。`ACCESS_TOKEN_` で始まるキーも同じ扱いになるかを
  確認し、ならないなら直す

## やること

1. テストを先に書く（TDD 必須）。`test/lib/env.test.ts` にトークン解決と不足検出のテスト、
   `test/main.test.ts` にグループごとに別のトークンでクライアントが作られることのテストを
   追加する
2. `src/lib/env.ts` から `ACCESS_TOKEN` の export を外し、環境変数名を受け取ってトークンを
   返す関数（と、複数まとめて検証する関数）を追加する
3. `src/main.ts` の `process()` をグループ単位に変え、グループごとのクライアントで
   `createMrIfNeeded()` を呼ぶ
4. `vitest.config.ts` の `env`、`test/helpers.ts`、`test/main.test.ts`、
   `test/main-integration.test.ts` のテスト用環境変数を新方式に合わせて直す

## 完了条件

- `pnpm check` が通る
- 宣言された環境変数が1つでも未設定のとき、MR 作成を1件も試みずにエラー終了することを
  テストで示し、そのテスト名を `evidence` に残す

## 注意

- モジュールのトップレベルで `process.env` に触れるのは `src/lib/env.ts` だけ
- `try`/`catch` は `createMrIfNeeded` / `process()` / `branchExists` の3箇所だけ。増やさない
- 実 GitLab への接続を伴う検証（`pnpm dev` の実行など）はユーザーの承認が要る。
  このタスクでは単体テストだけで判定する

## T-003

**タスク**: グループごとのトークンに合わせて README・CI 設定を更新する

**difficulty**: sonnet / **loopable**: Y / **dependencies**: T-001, T-002 / **passes**: True

**evidence**:

pnpm check 通過（11 files / 186 tests, exit 0）。やること1〜4（README・.gitlab-ci.yml・CLAUDE.md・docs/requirements.md・docs/smoke-test.md）は先行コミット 25c7656 で追随済みだったことを実物で確認し、未着手だったやること5（docs/architecture.md の設計判断「グループ = 設定ファイル 1 つ、単一トークンへのフォールバックは作らない」）を追加。grep -rn ACCESS*TOKEN --include=*.md --include=\_.yml の結果、単一トークン前提の記述は develop/progress.md と docs/history/direction.md（いずれも過去の記録）のみ。

## 背景

`ACCESS_TOKEN` は単一のトークンとして次の箇所に書かれている。前タスクで実装が
`ACCESS_TOKEN_<グループ名>` 方式に変わるので、これらを追随させる。

- `README.md`（7箇所。Quick Start のコマンド例、「設定 > 環境変数」表、「CI/CD」節の変数表と
  Masked/Protected の注意、「開発」節のコマンド例）
- `CLAUDE.md`（「セットアップ / 環境構築」節、「CI/CD」節）
- `docs/requirements.md`（Masked: ON / Protected: ON の非機能要件）
- `docs/smoke-test.md`（前提の表、環境変数の export 例、認証エラーの確認手順）
- `.gitlab-ci.yml`（先頭コメントと `variables`）

CLAUDE.md は「環境変数を足すときは `src/lib/env.ts`・`README.md` の表・`.gitlab-ci.yml` の
`variables` を同時に更新する」と定めている。

## 決まっていること（蒸し返さない）

- グループの単位は config ファイル1つ。設定ファイルのトップレベルに `accessTokenEnv` を書く
- 単一 `ACCESS_TOKEN` へのフォールバックは無い。ドキュメントにも移行用の経路として
  書かない

## やること

1. `README.md` の「設定 > 環境変数」表の `ACCESS_TOKEN` 行を `ACCESS_TOKEN_<GROUP>` に
   書き換え、「config/」節に `accessTokenEnv` の説明と記述例を足す
2. `README.md` の Quick Start・「CI/CD」節・「開発」節のコマンド例と変数表を新方式に直す
3. `.gitlab-ci.yml` の先頭コメントと `variables` を新方式に合わせる。グループごとのトークンは
   名前が設定ファイル依存で可変なため `variables` に列挙できない可能性がある — 列挙できない
   なら書かず、CI/CD Variables 側に登録する手順として `README.md` に書く
4. `CLAUDE.md`・`docs/requirements.md`・`docs/smoke-test.md` を新方式に直す
5. `docs/architecture.md` に、この方式を採った設計判断（グループ = config ファイル1つ、
   フォールバックを作らない理由）を1節として足す

## 完了条件

- `pnpm check` が通る
- `grep -rn 'ACCESS_TOKEN' --include='*.md' --include='*.yml' .`（`node_modules` を除く）の
  結果に、単一トークンを前提にした記述が残っていないことを確認し、その出力を `evidence` に
  残す

## 注意

- Masked: ON / Protected: ON の指示は方式が変わっても残す
- ドキュメントにタスク番号を書かない

## T-004

**タスク**: サンプル設定の識別子を team から group に揃える

**difficulty**: haiku / **loopable**: Y / **dependencies**: なし / **passes**: True

**evidence**:

pnpm check 通過（11 files / 186 tests, exit 0）。config/ は group-a.yaml / group-b.yaml のみで team-\*.yaml は残っていない（git mv）。grep -rn -iE 'team|チーム'（node_modules・develop/・docs/history/ を除く）の残りは README.md:23・CLAUDE.md:121・docs/requirements.md の 18/43/51 の 5 件のみで、すべて人の集まりを指す除外対象。

## 背景

`config/` のサンプル設定は `team-a.yaml` / `team-b.yaml` という名前で、中の
`accessTokenEnv` も `ACCESS_TOKEN_TEAM_A` / `ACCESS_TOKEN_TEAM_B` になっている。
トークンを割り当てる単位は「チーム」ではなく設定ファイル 1 つ = 1 グループ
（`ConfigGroup`。`src/types.ts`）なので、サンプルの識別子を `group` に揃える。

これは識別子・ファイル名・環境変数名だけを対象にした機械的な置換で、散文の
「チーム」という語の書き換えは別タスクが担当する。

## 決まっていること（蒸し返さない）

- 命名は `group-a` / `group-b` / `ACCESS_TOKEN_GROUP_A` / `ACCESS_TOKEN_GROUP_B`、
  README の雛形は `my-group.yaml` / `ACCESS_TOKEN_MY_GROUP` にする
- `platform` / `infra` のような実グループ名を思わせる例には**しない**

## やること

1. `git mv config/team-a.yaml config/group-a.yaml`、
   `git mv config/team-b.yaml config/group-b.yaml`。中の `accessTokenEnv` を
   `ACCESS_TOKEN_GROUP_A` / `ACCESS_TOKEN_GROUP_B` に書き換える
2. `.env.example` の `ACCESS_TOKEN_TEAM_A` / `ACCESS_TOKEN_TEAM_B` を置き換える
3. `README.md` の次の箇所を置き換える（行番号は目安。実物を見て判断する）
   - 53 行目付近の `cp config/team-a.yaml config/my-team.yaml`
   - 58・64・225・229 行目付近の `ACCESS_TOKEN_TEAM_A=` のコマンド例
   - 105 行目付近の環境変数表にある例示 `ACCESS_TOKEN_TEAM_A`
   - 117〜118 行目付近のディレクトリツリー `team-a.yaml` / `team-b.yaml`
   - 122・126 行目付近の `# config/my-team.yaml` と `accessTokenEnv: ACCESS_TOKEN_MY_TEAM`
4. `.gitlab-ci.yml` 先頭コメントの例示 `ACCESS_TOKEN_TEAM_A`
5. `src/types.ts` の `AccessTokenEnvName` の JSDoc、`src/lib/config.ts` の zod エラー
   メッセージ、`src/utils/logger.ts` のコメント、いずれも例示の
   `ACCESS_TOKEN_TEAM_A` を置き換える
6. テストを置き換える。`test/lib/config.test.ts`（`ACCESS_TOKEN_TEAM_A/B` と
   フィクスチャのファイル名 `team-a.yaml` / `team-b.yaml`。小文字を弾くテストで使って
   いる `ACCESS_TOKEN_team_a` も `ACCESS_TOKEN_group_a` に）、`test/main.test.ts` の
   ローカル変数 `teamA` / `teamB` とその値、`test/utils/logger.test.ts` のキーと
   ダミー値（`"glpat-team-a"` など）

## 触ってはいけない箇所（人の集まりを指す「チーム」なので残す）

- `README.md` 23 行目付近「多段リリースフローを持つチームでは」
- `docs/requirements.md` の 18・43・51 行目付近
- `CLAUDE.md` の「## チームエージェント方針」節
- `develop/` 配下と `docs/history/` 配下（過去の記録なので書き換えない）

**`grep -rl` から `sed` へ一括で流さないこと。** 上の除外箇所を巻き込むため、
対象ファイルを 1 つずつ確認して置き換える。

## 完了条件

- `pnpm check` が通る
- `grep -rn -iE 'team|チーム' --include='*.md' --include='*.yml' --include='*.yaml'
--include='*.ts' --include='*.example' .`（`node_modules`・`develop/`・`docs/history/`
  を除く）の結果が、上の「触ってはいけない箇所」だけになることを確認し、その出力を
  `evidence` に残す
- `config/` に `team-a.yaml` / `team-b.yaml` が残っていない

## 注意

- 実際のトークンの値を設定ファイル・テスト・コミットに書かない
- `config/` の `projectId` や `branchPairs` の中身は変えない（名前だけの変更）

## T-005

**タスク**: 設定ファイルの単位を指す散文の「チーム」を「グループ」に直す

**difficulty**: sonnet / **loopable**: Y / **dependencies**: T-004 / **passes**: True

**evidence**:

pnpm check 通過（11 files / 186 tests, exit 0）。grep -n '結合します' README.md が該当なし。grep -rn 'チーム' --include=\*.md（node_modules・develop・history を除く）の残りは README.md:23・CLAUDE.md:121・docs/requirements.md の 18/43/51 の 5 件のみで全て除外対象。architecture.md の根拠文は「人や運用の都合でリポジトリ群ごとに分ける前提だったから」に直し、循環を解消した。

## 背景

`config/` のファイル分割を説明する散文が、まだ「チームごと」という言い方をしている。
トークンを割り当てる単位は設定ファイル 1 つ = 1 グループ（`ConfigGroup`。`src/types.ts`）
なので、**設定ファイルの単位を指している箇所だけ**を「グループ」に直す。

あわせて `README.md` の「config/」節に、実装と食い違う記述が残っている。`config/` の
複数ファイルを「アルファベット順に読み込み、結合します」と書いているが、
`src/lib/config.ts` の `loadConfigDir()` は `repositories` を連結せずファイル単位の
まとまりを保って返すよう変わっている（`docs/glossary.md`「設定の結合」は追随済みで、
README だけが古い）。同じ節の同じ文なので、このタスクでまとめて直す。

## 決まっていること（蒸し返さない）

- 人の集まりを指す「チーム」は残す。直すのは設定ファイルの単位を指している箇所だけ
- 用語集に「この設定上のグループ ≠ GitLab のグループ」という注記を足すことは、
  今回のスコープに含めない

## 解くべき論点

- `docs/architecture.md` の設計判断「グループ = 設定ファイル 1 つ、単一トークンへの
  フォールバックは作らない」は、「`config/` がもともと**チーム・リポジトリ群ごとに**
  ファイルを分ける前提だから」を根拠にしている。ここは「もともとそういう分け方を
  していたから、その境界を再利用した」という因果が要点なので、単純に「グループごと」に
  置換すると「グループだからグループ」という循環になる。因果が残る書き方を考える

## やること

1. `README.md` の Features「チームごとにファイルを分割できます」を直す
2. `README.md`「### config/」の「対象リポジトリとブランチペアをチームごとのファイルで
   定義します。`config/` ディレクトリ内の `.yaml` / `.yml` ファイルをアルファベット順に
   読み込み、結合します。」を、**グループごとという言い方**に直したうえで、
   **「結合します」を実装どおりの説明に改める**（ファイル単位のまとまりを保ったまま
   読み込むこと。言い回しは `docs/glossary.md`「設定の結合」に合わせる）
3. `docs/glossary.md`「設定ファイル」の「チーム単位でファイルを分けられる」を直す
4. `docs/architecture.md` の設計判断にある「チーム・リポジトリ群ごと」を、上の論点を
   踏まえて書き換える

## 触ってはいけない箇所（人の集まりを指す「チーム」なので残す）

- `README.md` 23 行目付近「多段リリースフローを持つチームでは」
- `docs/requirements.md` の 18・43・51 行目付近
- `CLAUDE.md` の「## チームエージェント方針」節
- `develop/` 配下と `docs/history/` 配下

## 完了条件

- `pnpm check` が通る
- `README.md` に「結合します」という記述が残っていない
- `grep -rn 'チーム' --include='*.md' .`（`node_modules`・`develop/`・`docs/history/`
  を除く）の結果が、上の「触ってはいけない箇所」だけになることを確認し、その出力を
  `evidence` に残す

## 注意

- ドキュメントにタスク番号（`T-` + 3桁）を書かない
