# moodle+R UI改善 Chrome拡張

`https://lms.ritsumei.ac.jp/*`（Moodle 4.x, theme_boost, 表示名 moodle+R）のフロントエンドを、
Chrome拡張のクライアントサイド書き換えのみで改善する。サーバ側・Moodleプラグインには一切手を入れない。

このファイルは、次にこのプロジェクトを触る人（AIセッション含む）が数分で全体像を把握し、
すぐ修正作業に入れるようにするための入り口。個別の調査ログは `docs/` 以下を参照。

---

## ⚠️ 次にやること: 学期開始後にF2「課題・小テスト（締切順）」ブロックを検証する

**これが現時点で唯一の未検証・要フォローアップ項目。それ以外の全機能はユーザーによる実機確認済み。**
開発時点（2026年9月・学期開始直前）では履修コースに提出待ちの課題・テストが1件も無く、
API（`core_calendar_get_action_events_by_timesort`）が返すイベントも `mod_url` の完了予定1件のみ
だったため、`assign`/`quiz`/`workshop` の実データでは一度も動作確認ができていない。

### 対象コードと現在の仕様

- 表示ロジック本体: [src/content/features/deadlines.js](src/content/features/deadlines.js)
- API呼び出し: [src/lib/moodle-api.js](src/lib/moodle-api.js) の `getActionEventsByTimesort()`
- スタイル: [src/styles/deadlines.css](src/styles/deadlines.css)
- 表示場所: ダッシュボード右のブロックドロワー内、**カレンダーより上・「最近アクセスされたアイテム」の
  代わりの位置**（`deadlines.js` の `init()` で `sidePre.insertBefore(block, sidePre.firstChild)` により
  ドロワーの先頭に挿入している）
- タイトル: 「課題・小テスト（締切順）」
- 表示フィルタ: `assign` / `quiz` / `workshop` のみ（`RLX.modtype.ASSESSMENT_MODTYPES`で絞り込み。
  他の完了予定イベント(`url`/`page`等)は意図的に除外——ユーザー確認済みの仕様）
- 1件あたりの表示形式（`renderList()`内、3行構成。ユーザー指定の仕様）:
  1. `.rlx-deadline-course` — 授業科目名（太字）
  2. `.rlx-deadline-activity` — 課題・小テスト名（リンク、字下げ）
  3. `.rlx-deadline-due` — 締切日時 + `（残り○日○時間）`、緊急度4段階で色分け（字下げ）
- 期間フィルタ: 期限切れ / 7日 / 30日（既定） / すべて（`isWithinFilter()`）
- キャッシュ: `chrome.storage.local` に5分間（`CACHE_KEY = "deadlines_events"`）

### 確認すること（優先順）

1. **実際に締切間近の課題・テストが表示されるか。** 表示されない場合はまず以下を疑う:
   - `modulename` フィルタ（`assign`/`quiz`/`workshop`）が厳しすぎないか。Moodleが実際に返す
     `modulename` の値がこれらと綴りも含め一致しているか（`console.log`等で生データを確認）
   - `limitnum:50`（Moodle側の絶対上限。100等に増やすと`Limit must be between 1 and 50 (inclusive)`
     エラーになるので変更不可）以内に該当課題が収まっているか。他の完了予定イベント（url等）に
     枠を取られて漏れていないか
   - `timesortfromDays: 14`（現在時刻の14日前）より前に締切があるものは取得対象外になる点に注意
2. **提出済みの課題がどう扱われるか。** 提出済みでもAPIが返し続ける場合、除外ロジックの追加が
   必要になる可能性がある（Moodleの「活動完了」設定が有効かどうかで挙動が変わりうる）
3. **色分け・残り時間表示が実際の日付で正しく機能するか**（`tierFor()` / `formatRemaining()`）
4. **期間フィルタの切り替えが実データで期待通りに動くか**
5. **エラー時・空データ時の表示**（`showError()`、空配列時の「該当する課題はありません」表示）が
   実際にどちらのパスを通ることになるか
6. 課題・小テスト以外の活動（`workshop`）が実際にこのコースで使われているか未確認。使われていない
   場合はテストできないだけなので問題ない

### 参考: 開発時点で確認済みのAPIレスポンス例

`docs/API-NOTES.md` に実際のレスポンス（1件）とフィールド定義を記載済み。ただしこれは
「完了扱いの `mod_url`」1件のみのサンプルで、`assign`/`quiz`/`workshop` の実例は未確認。
実データが手に入ったら、このREADMEと`docs/API-NOTES.md`の該当チェックリストを更新すること。

---

## アーキテクチャ

MV3のcontent scriptはES Modulesに非対応のため、ビルドツールを使わず、`manifest.json` の
`js` 配列に依存順で列挙し、各ファイルが `window.RLX` 名前空間に自分を登録する方式にしている。

```
src/lib/*.js          → RLX.log / RLX.settings / RLX.storage / RLX.wait / RLX.page /
                         RLX.modtype / RLX.period / RLX.api を定義（他featureから共通利用）
src/content/features/*.js
                       → RLX.registerFeature({ name, matches(pageInfo), init({pageInfo, settings}) })
                         で自分をRLX.featuresに登録するだけで、実行はmain.jsに任せる
src/content/main.js   → 最後に読み込まれる。ページ種別を判定し、設定を読み込み、
                         matches()がtrueなfeatureのinit()を並行実行する
                         （1つのfeatureの例外は他に影響しない。N-5）
options/*             → 設定画面。src/lib/settings.jsを直接読み込んで共有ロジックを再利用
```

- **featureの追加手順**: `src/content/features/`に新規ファイルを作り`RLX.registerFeature(...)`
  で登録 → `manifest.json`の`content_scripts[0].js`に追記 → 必要なら`src/lib/settings.js`の
  `DEFAULT_SETTINGS.features`と`options/options.html`にトグルを追加
- **セレクタは各featureファイル冒頭の`SELECTORS`定数に集約**。Moodle更新で壊れる前提で、
  要素が見つからない場合は`RLX.log.warn()`で警告を出し、そのfeatureだけ何もせず終了する
  （他のfeatureやページ自体は壊さない）
- **冪等性**: `RLX.wait.markDone(el)` / `RLX.wait.isDone(el)` で処理済みDOMに印を付け、
  MutationObserver等による多重適用を防ぐ
- **待機**: AJAX後描画される要素は `RLX.wait.waitForElement(selector, {timeout})` で
  MutationObserverベースに待つ（タイムアウトしても警告のみでクラッシュしない）
- **ドロワーの常時展開**: `.rlx-force-open`（`base.css`で定義、`transform/visibility/display`を
  `!important`で固定）というクラスを付与する方式。左右のドロワーで`course-index.js`と`deadlines.js`
  それぞれが自分の担当ページで呼んでいる（重複しているが実害はない小さな関数）

---

## 機能ごとの実装場所と現状

要件定義書（`docs/REQUIREMENTS.md`）からユーザーフィードバックにより変更された点が多いため、
**実際の挙動はこの表と各ファイルのコードが正**。REQUIREMENTS.mdは初期設計の記録として残す。

| 機能 | ファイル | 現状 |
|---|---|---|
| F1 時間割 | `src/content/features/timetable.js`, `src/styles/timetable.css` | 幅制限解除・コース名/教室名整形（複数行折り返し可）・本日の曜日列を薄い赤でハイライト・現在時限を赤い枠線で強調・コース概要イラストを背景に表示（API直取得、非同期・並行処理）。左ボーダー色・アイコンのバッジ化・空の時限を表示するトグルボタンは全て削除済み（未使用/非機能のため） |
| F2 課題・小テストブロック | `src/content/features/deadlines.js`, `src/styles/deadlines.css` | ダッシュボード右ドロワーの先頭（カレンダーより上、「最近アクセスされたアイテム」があった位置）に表示。**未検証、上記「次にやること」参照**。タイムラインの再配置・右ドロワー常時展開もこのファイルが担当 |
| F3 分類タブ | `src/content/features/course-tabs.js`, `src/styles/course-tabs.css` | 実装済みだが**既定OFF**（設定でON可）。コース画面中央を標準の週次表示のままにしたいというユーザー要望のため |
| F4 コースインデックス | `src/content/features/course-index.js`, `src/styles/course-index.css` | 左右ドロワー常時展開（全ページ）、検索・全展開既定・完了ドット、右ドロワー「活動」ブロックのプルダウン化（既定展開）、ドロワー上部にコース名リンク（複数行可）を表示、右ドロワーのブロック順を「活動→完了プログレス→コース概要→私の先生にメッセージ」に固定 |
| 上部ナビ整理 | `src/content/features/nav-menu.js` | 「ダッシュボード」「ノート」「Respon」「My Library」「Campus Web」「シラバス」「その他」に整理（全ページ共通のヘッダーのため） |
| ノート一覧の全展開 | `src/content/features/note-list.js` | `local_learningtools`の「ノート」ページ専用。Bootstrapアコーディオンの`data-parent`を外して同時展開する |
| F5 設定画面 | `options/options.html`, `options/options.js` | F1〜F4・上部ナビのON/OFF、標準ブロック「コース概要」の非表示、時限の時刻表編集 |

---

## 開発・デバッグ方法

### 読み込み

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」で `moodle+R_extension/`(このプロジェクトのルート) を選択
4. コードを変更したら、拡張機能カードの再読み込みボタン（⟳）を押してから対象ページを再読み込みする

### ログの見方

- content scriptのログは**対象ページ自身のDevTools Console**に出る（拡張機能用の別コンソールではない）
- `[moodle+R]` プレフィックス付きで出力される
- `RLX.log.info()` は常時表示、`RLX.log.debug()` は既定非表示（`RLX.log.setDebug(true)`で有効化）
- 各featureの起動成功/失敗は `info`/`error` レベルで必ず出るので、まずここを見る

### Moodle Web APIの疎通確認のやり方（F2検証時に使う）

sesskeyはDOMから取得する（`input[name=sesskey]`が無ければlogoutリンクのhrefから正規表現抽出）。
コンソールで以下のようなスニペットを実行すれば、拡張機能を介さず生のAPIレスポンスを確認できる
（`docs/API-NOTES.md`にも同様の例あり）。

```js
const sesskey = document.querySelector('input[name=sesskey]')?.value
  || document.querySelector('a[href*="logout.php?sesskey="]')?.href.match(/sesskey=([^&]+)/)?.[1];
const now = Math.floor(Date.now()/1000);
const r = await fetch(`/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`, {
  method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'},
  body: JSON.stringify([{index:0, methodname:'core_calendar_get_action_events_by_timesort',
    args:{limitnum:50, timesortfrom: now - 14*86400, limittononsuspendedevents:true}}])
});
const json = await r.json();
console.log('events:', json[0].data.events);
console.log('modulename内訳:', json[0].data.events.reduce((acc,e)=>{acc[e.modulename]=(acc[e.modulename]||0)+1; return acc;}, {}));
```

### 既知の制約

- 資料・活動個別ページ（`page-mod-*`）では、Moodle自体が右ブロックドロワーを生成しないため、
  F4の「右ドロワー常時展開」は対象外（左のコースインデックスドロワーのみ対応。あえて追加実装はしない方針で確定済み）
- コース画面の分類タブ（F3）は既定OFF

---

## 設定

拡張機能の詳細ページから「拡張機能のオプション」を開くと、以下を設定できる。

- F1（時間割）・F2（締切ブロック）・F3（分類タブ）・F4（コースインデックス）・上部ナビ整理の個別ON/OFF
- 標準ブロック「コース概要」の非表示ON/OFF
- 時限↔時刻の対応表の編集（初期値は未確認の仮値なので要確認）

---

## 参考ドキュメント

- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — 初期要件定義（設計の出発点。現状と異なる箇所あり、上記表を優先）
- [docs/DOM-NOTES.md](docs/DOM-NOTES.md) — 実際のMoodle DOM構造の調査ログ（セレクタの根拠）
- [docs/API-NOTES.md](docs/API-NOTES.md) — Moodle Web APIの調査ログ（`core_calendar_get_action_events_by_timesort`,
  `core_course_get_enrolled_courses_by_timeline_classification` の実レスポンス例と制約。**F2検証時は必読**）
