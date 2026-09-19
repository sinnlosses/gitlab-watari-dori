# 未対応の指示メモ

## 2026-09-20

- チームごとじゃなくグループごとのファイルにするほうがいいからREADMEのMY_TEAMとかteam-aとかはグループにするといいかな。ほかも洗い出してもらえると嬉しい

| 項目                                                      | タスクID |
| --------------------------------------------------------- | -------- |
| サンプル名（`team-a` / `ACCESS_TOKEN_TEAM_A` など）の統一 | T-004    |
| 設定ファイルの単位を指す散文の「チーム」の書き換え        | T-005    |
| README の「結合します」が実装と食い違っている             | T-005    |

洗い出しのうえで方針を3点確認した。命名は `group-a` / `ACCESS_TOKEN_GROUP_A` /
`my-group`（実グループ名っぽい例にはしない）。人の集まりを指す「チーム」（README の背景、
`docs/requirements.md` の 3 箇所、CLAUDE.md の「## チームエージェント方針」）は残す。
用語集に「この設定上のグループ ≠ GitLab のグループ」と明記する案は提示したが採用されず、
スコープ外とした。

以下は `develop/direction.md` に書かれていた指示の原文。

### 「チーム」ではなく「グループ」に用語を揃える

トークンを割り当てる単位はチームではなくグループなので、サンプル名と説明文の
「チーム（team / TEAM）」を「グループ（group / GROUP）」に揃えたい。

命名は `group-a` / `ACCESS_TOKEN_GROUP_A` / `my-group` の形にする
（`platform` のような実グループ名っぽい例にはしない）。

洗い出し済みの対象:

**サンプル名のリネーム（実体の変更を伴う）**

- `config/team-a.yaml` → `config/group-a.yaml`、`config/team-b.yaml` → `config/group-b.yaml`
  （`git mv`。中の `accessTokenEnv` も `ACCESS_TOKEN_GROUP_A` / `_GROUP_B` に）
- `.env.example` の `ACCESS_TOKEN_TEAM_A` / `_TEAM_B`
- `README.md` の 53（`cp` のコマンド例）・58・64・225・229（`ACCESS_TOKEN_TEAM_A=`）・
  105（環境変数表の例示）・117〜118（ツリー図）・122・126（`my-team.yaml` と
  `ACCESS_TOKEN_MY_TEAM`）
- `.gitlab-ci.yml` の先頭コメントの例示
- `src/types.ts` の `AccessTokenEnvName` のコメント、`src/lib/config.ts` の zod エラー
  メッセージの例示、`src/utils/logger.ts` のコメントの例示
- `test/lib/config.test.ts`（約 20 箇所。`ACCESS_TOKEN_TEAM_A/B` とフィクスチャ名
  `team-a.yaml` / `team-b.yaml`）、`test/main.test.ts` の変数 `teamA` / `teamB`、
  `test/utils/logger.test.ts` のキーと値（`"glpat-team-a"` など）

**説明文の書き換え（設定ファイルの単位を指している「チーム」だけ）**

- `README.md:28`「チームごとにファイルを分割できます」
- `README.md:113`「対象リポジトリとブランチペアをチームごとのファイルで定義します」
- `docs/glossary.md:54`「チーム単位でファイルを分けられる」
- `docs/architecture.md:107`「`config/` がもともとチーム・リポジトリ群ごとに
  ファイルを分ける前提だから」（設計判断の根拠文なので、理由が薄くならないよう書き換える）

**そのままにする（人の集まりを指しているので直さない）**

- `README.md:23`、`docs/requirements.md` の 18・43・51、`CLAUDE.md:121`
  「## チームエージェント方針」

### README の「結合します」が実装と食い違っている

`README.md:113` は `config/` の複数ファイルを「アルファベット順に読み込み、結合します」と
書いているが、実装は `repositories` を連結せずファイル単位のまとまり（`ConfigGroup`）を
保つ形に変わっている。`docs/glossary.md`「設定の結合」は追随済みで README だけ古い。
上の用語統一と同じ箇所なので、あわせて直す。

---

- /Users/sinnlos/ghq/github.com/sinnlosses/helm-yadokari を参考に、グループごとのアクセストークンを設定できるようにしてほしい

| 項目                                       | タスクID              |
| ------------------------------------------ | --------------------- |
| グループごとのアクセストークンを設定できる | T-001 / T-002 / T-003 |

タスク化にあたり、方針を3点ユーザーに確認した（結果は各タスクの
`## 決まっていること（蒸し返さない）` に焼き込み済み）。グループの単位は「config ファイル
1つ = 1グループ」、`accessTokenEnv` は必須で単一 `ACCESS_TOKEN` は全廃、helm-yadokari が
持つ「トークンがグループ外に届いていないか」の実在検証は今回のスコープに含めない。
