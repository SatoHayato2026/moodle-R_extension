# DOM調査メモ（Phase 0 + 実装後の追加調査）

> 未確定。下記スニペットの実行結果が届き次第、このファイルを実データで更新すること。
> 実装（Phase 1以降）はこのファイルが埋まってから着手する。

## 0. 目次（実装後に追加調査した項目）

Phase 0完了後、ユーザーからの追加要望に対応する過程で以下も調査済み（本文中に記載）。

- ダッシュボードの右ブロックドロワー（`#theme_boost-drawers-blocks`）と `#block-region-side-pre` / `#block-region-content` の使い分け → 「4. 右ブロックドロワー」参照
- 「コース概要」ブロック（`block_myoverview`）のカード構造とコース画像 → 「5. コース概要ブロックとコース画像」参照
- コース画面の右ドロワー「活動」ブロック（`block_activity_modules`） → 「6. 活動ブロック」参照

## 1. ダッシュボード（`/my/`, body#page-my-index）

- [x] `document.body.id`: `page-my-index`
- [x] `document.body.className`: `limitedwidth format-site path-my chrome dir-ltr lang-ja yui-skin-sam yui3-skin-sam lms-ritsumei-ac-jp pagelayout-mydashboard course-1 context-8494 theme uses-drawers drawer-open-index jsenabled local-learningtools`
  - **`drawer-open-index` が既定でついている＝コースインデックス系ドロワーが開いた状態がデフォルト**。幅圧迫の一因として有力。
  - `drawer-open-right`（通知等の右ドロワー）は別途要確認。
- [x] `.block_rutime_table` の構造（HTML抜粋）: 下記「実HTML」参照。想定通り `section#instXXXXXX.block_rutime_table.block.card.mb-3` → `.card-body` → `.timetable-main` → `.timetable-legend` + `.timetable-table > table.timetable`
- [x] 時間割テーブルの `scrollHeight` / `clientHeight`: **1244 / 1244（等しい＝内部縦スクロールなし）**
- [x] 時間割テーブルの `scrollWidth` / `clientWidth`: **560 / 560（等しい＝内部横スクロールなし）**
- [x] → スクロール方向（縦/横）の結論: **テーブル要素自体はスクロールしていない。幅圧迫（560px幅に7列を詰め込む）によりセル内テキストの折り返しが増え、テーブル自体の高さが1244pxまで膨張している。ユーザー体感の「スクロールしないと一覧できない」は、ページ全体を下にスクロールする必要がある、という意味だったと判明。F1-1の対策方向（幅を広げる）は妥当だが、実装はoverflow解除ではなく「幅拡大→折り返し削減→高さ圧縮」で行う。**
- [x] `#region-main` の実効幅（`getComputedStyle(...).width`）: **119.2px（要検証・異常値の可能性。DevToolsのドッキングで実ウィンドウ幅が狭くなっていた可能性あり。追加確認依頼中）**
- [x] `.timetable-legend` の有無・構造: 存在する。`.legend-container > .legend-item × 4`（お気に入り／未読アナウンス／未提出課題／未読フォーラムの凡例、それぞれimg+span.legend-text）
- [x] `thead` / `tbody tr` の実際のセレクタ確認: `thead > tr > th`(空th 1つ + `月火水木金土` の6th、**日曜日カラムなし＝6列**）。`tbody > tr > td.time`（時限番号） + `td.highlight`（授業あり）/ `td.empty`（授業なし、未確認だが要件通り想定）
- [x] `td.highlight` セル内の実HTML（`a.active-course-name`, `div.room`, `span.on/off` の実例）:
  ```html
  <td class="highlight">
    <div class="subjects">
      <div class="subject">
        <a href="https://lms.ritsumei.ac.jp/course/view.php?id=31479" core-link="" [capture]="true" class="active-course-name">52336:財務会計論 (B) § 52337:財務会計論(B)</a>
        <div class="room">月1:AC231</div>
        <span class="off"><img src=".../star" class="favouriteicon" alt="お気に入り 消灯"></span>
        <span class="off"><img src=".../news" class="newsicon" alt="未読アナウンスメント 消灯"></span>
        <br>
        <span class="off"><img src=".../assign" class="assignicon" alt="未提出課題 消灯"></span>
        <span class="off"><img src=".../forum" class="forumicon" alt="未読フォーラム 消灯"></span>
      </div>
    </div>
  </td>
  ```
  - `a.active-course-name` に謎の属性 `core-link=""` と `[capture]="true"`（未評価のフレームワーク構文がリテラルで出力されている可能性。実害なし、セレクタには影響しない想定）
  - コース名「52336:財務会計論 (B) § 52337:財務会計論(B)」→ F1-2/F1-3の正規表現・§分割がそのまま適用できることを確認
  - 教室「月1:AC231」→ F1-4の接頭辞除去がそのまま適用できることを確認
  - `span.off` に消灯アイコン4種（favouriteicon/newsicon/assignicon/forumicon）。`span.on` はまだ実例未確認（該当条件のコースがないと出現しない可能性、要追加確認）
- [x] `fieldset.timetable-others` の有無・構造: 存在は確認（`others fieldset exists: true`）。内部構造は未確認、追加確認が必要。

### 幅制限の原因特定（確定）

祖先要素を `#region-main` から `<body>` までたどった結果、幅を830pxに制限しているのは
**`#topofscroll.main-inner`** であることが確定した（`max-width: 830px`）。
これは `body.limitedwidth` が付与されているときにのみ効くルールと推測される
（`#page`, `.container-fluid`, `#page-content`, `#page-content-box` 自体には max-width は付いていない）。

```
DIV #region-main               | max-width: none  | width: 814px
DIV #region-main-box           | max-width: none  | width: 814px
DIV #page-content .pb-3        | max-width: none  | width: 814px
DIV #topofscroll .main-inner   | max-width: 830px | width: 830px   ← ここが犯人
DIV #page .drawers.drag-container | max-width: none | width: 1520.8px
DIV #page-wrapper              | max-width: none  | width: 1520.8px
BODY.limitedwidth              | max-width: none  | width: 1520.8px
```

ウィンドウ幅を1006px→1536pxに変えても `#region-main` は814pxで変化しなかった
（`main-inner`の830pxからカード等のpadding/marginを引いた分と一致）ことから、
コースインデックスドロワーの開閉ではなく、この`max-width: 830px`固定値が
支配的な制約であることが確認できた。

**F1-1 実装方針（確定）**: `body.limitedwidth#page-my-index #topofscroll.main-inner { max-width: none; }`
のようなCSSで `/my/` ページに限定して解除する。ドロワー圧迫分（開いていれば〜190px程度）は
別途残るが、830px制限の解除だけでも大幅に改善する見込み。

### 未確認・追加調査が望ましい項目

- `span.on`（点灯状態）の実例（該当条件のコースが今回のアカウントに無かった可能性。お気に入り登録済み or 未読アナウンス/未提出課題ありのコースがあれば確認したい）
- `td.empty`（空セル）の実HTML構造
- `fieldset.timetable-others`（曜日時限を持たないコース欄）の内部HTML構造
- ドロワーを閉じた状態での`#region-main`幅（今回は未実施のままmax-width要因が判明したため優先度低）

## 2. コース画面（`/course/view.php?id=...`, body#page-course-view-*）

- [x] `document.body.id`: `page-course-view-topics`（想定どおり `page-course-view-*` パターン。フォーマットが末尾に付く＝`topics`フォーマット使用中と判明）
- [x] コースインデックス（左ドロワー）のルート要素セレクタ: `#theme_boost-drawers-courseindex`（`div.drawer.drawer-left`, `data-region="fixed-drawer"`, `data-preference="drawer-open-index"`）。ヘッダ部に開閉ボタン(`[data-action="closedrawer"]`)、オプションドロップダウン(`#courseindexdrawercontrols`、`[data-action="expandallcourseindexsections"]` などMoodle標準ですでに「すべて展開する」機能が存在する点に注意＝F4-7と機能重複の可能性)。
  - **要追加確認**: ドロワー内部の実際のツリー項目（セクション/活動）のセレクタ（`outerHTML.slice(0,1500)` がヘッダ部で切れてしまったため、リスト本体が未確認）
- [x] セクション要素のセレクタと `data-*` 属性: `li.section.course-section.main` — `data-for="section"`, `data-id`（内部ID、例505214）, `data-number`（表示順番号、0始まり）, `data-sectionname`（セクション名、例「★本授業の授業形態について」）, `data-sectionreturnnum`
  - 内部に `div.section-item > div.course-section-header[data-for="section_title"]`
- [x] 活動要素のセレクタと `data-*` 属性: `li.activity.activity-wrapper.{modtype}.modtype_{modtype}` — `data-for="cmitem"`, `data-id`（cmid, 例58102）, `id="module-{cmid}"`
  - 内部に `div.activity-item[data-activityname="アナウンスメント"][data-region="activity-card"]`（`data-activityname`に活動名が入る＝表示名取得に利用可能）
- [x] `document.querySelectorAll('[class*="modtype_"]')` の実在一覧: `modtype_forum`, `modtype_resource`, `modtype_url`, `modtype_questionnaire`, `modtype_assign`, `modtype_quiz`
  - `modtype_questionnaire` はF3の分類表（授業資料/課題テスト/アナウンス/その他）に無いため「その他」に自動分類される想定どおりでOK
  - `modtype_folder`, `modtype_page`, `modtype_book`, `modtype_label`, `modtype_workshop` は今回のコースには無かった（未確認だが要件のカテゴリ定義は変更不要と判断）

## 3. 備考・想定との差異

- **F1の原因**: 想定どおり幅制限が主因と確定。ただし制限元は `body.limitedwidth` 直下の `#page` ではなく、より内側の `#topofscroll.main-inner`（`max-width: 830px`）。CSSはこの要素を狙う。
- **F1のスクロール方向**: 想定は「テーブル内スクロール」だったが、実際は「テーブル自体が高さ方向に膨張し、ページ全体のスクロールが必要になる」という挙動だった。overflow解除ではなく幅拡大による折り返し削減で対応する。
- **コース画面の構造**: `li.section`, `li.activity`, `modtype_*` は想定どおりのセレクタで存在を確認。コースインデックス（左ドロワー）は `.courseindex-section[data-for="section"]` / 折りたたみ内側は `#courseindexcollapse{N}` というBootstrap collapse方式。Moodle標準に「すべて展開する」機能が既にあり、F4-7と機能重複することが判明（実装時は標準機能との共存/使い分けを検討）。
- **F2 APIの挙動**: `core_calendar_get_action_events_by_timesort` は課題(assign)以外にもURL等の完了予定イベントを返すことが判明。`modulename` が `assign`/`quiz`/`workshop` のみに絞る方針で確定（ユーザー確認済み）。
- **未確認のまま残す項目**（実装時に随時確認、見つからない場合はN-5/N-9の設計方針どおり警告ログを出して機能をスキップする）:
  - `span.on`（点灯状態）の実HTML
  - `td.empty`（空セル）の実HTML
  - `fieldset.timetable-others` の内部構造

### コースインデックス（左ドロワー）内部構造（Phase 4着手前に確認、確定）

セクション行:
```html
<div class="courseindex-section" id="course-index-section-505214" data-for="section" data-id="505214" data-number="0" role="treeitem" aria-owns="courseindexcollapse0" tabindex="0" aria-selected="true">
  <div class="courseindex-item d-flex courseindex-section-title" id="courseindexsection0" data-for="section_item">
    <a data-toggle="collapse" href="#courseindexcollapse0" class="courseindex-chevron icons-collapse-expand" aria-expanded="true" aria-controls="courseindexcollapse0">...</a>
    <!-- セクション名テキスト等 -->
  </div>
</div>
```

折りたたみ内側（活動項目）:
```html
<div id="courseindexcollapse0" class="courseindex-item-content collapse show" aria-labelledby="courseindexsection0" role="group">
  <ul class="courseindex-sectioncontent unlist" data-for="cmlist" data-id="505214" role="group">
    <li class="courseindex-item d-flex" id="course-index-cm-58102" data-for="cm" data-id="58102" role="treeitem" aria-selected="false">
      <span class="completioninfo completion_none" data-for="cm_completion" data-value="NaN"></span>
      <a class="courseindex-link text-truncate" href="https://lms.ritsumei.ac.jp/mod/forum/view.php?id=58102" data-for="cm_name">アナウンスメント</a>
      <span class="courseindex-locked ms-1" data-for="cm_name"><i class="icon fa fa-lock fa-fw"></i></span>
    </li>
  </ul>
</div>
```

- 活動項目セレクタ: `li.courseindex-item[data-for="cm"]`（`data-id`=cmid）
- 完了状態: `span.completioninfo[data-for="cm_completion"]` のクラスは3種類のみ確認: `completion_none`（未設定）/ `completion_complete`（完了）/ `completion_incomplete`（未完了）。**F4-8の未読/未提出ドットは `completion_incomplete` の存在で判定する。**
- 活動種別: このドロワー内の要素自体に `modtype_*` クラスは無いため、`a.courseindex-link` の `href` から `/mod/(forum|resource|url|quiz|assign)/` を正規表現抽出して種別を得る（実在確認: forum, resource, url, quiz, assign）
- ロック（アクセス制限）中の活動: `span.courseindex-locked` が存在

## 4. 右ブロックドロワーと本文ブロック領域の使い分け（ダッシュボード）

- 右のブロックドロワー: `#theme_boost-drawers-blocks`（`div.drawer.drawer-right`, `data-preference="drawer-open-block"`）
  - 内部の `#block-region-side-pre`（`aside[data-blockregion="side-pre"]`）に「カレンダー」(`block_calendar_month`)、「最近アクセスされたアイテム」(`block_recentlyaccesseditems`) 等が入る
  - 閉じるボタン: `[data-action="closedrawer"]`（ドロワー内`.drawerheader`にある）。開くボタンは既定で開いていたため未確認（`[data-action="opendrawer"]`で探したがヒットしなかった）
  - `data-close-on-resize="1"` が付いており、ウィンドウ幅によって自動的に閉じる挙動がある → 常時表示させるには `transform/visibility/display` をCSSで`!important`固定するのが確実（クラス操作だけだとMoodle側のリサイズ処理で戻される）
- ダッシュボード本文側（`#region-main` 配下）の `aside#block-region-content`（`data-blockregion="content"`）に、時間割(`block_rutime_table`)・タイムライン(`block_timeline`)等が並ぶ。こちらは幅の広いメインカラム。

## 5. 「コース概要」ブロックとコース画像（ダッシュボード）

- ブロック本体: `[data-block="myoverview"]`（`.block_myoverview.block-cards`）
- 各コースカード: `div.card.course-card[data-region="course-content"][data-course-id="<courseId>"]`
- カード画像: カード内の `a > div.card-img-top` の**インラインstyle**に `background-image: url("data:image/svg+xml;base64,...")` が入っている（コースごとに自動生成された幾何学模様パターン）
- **同じ画像データはMoodle Web API `core_course_get_enrolled_courses_by_timeline_classification` のレスポンス（`data.courses[].courseimage`、`data.courses[].id`）からも直接取得できる**ことを確認済み。呼び出し例:
  ```js
  { index:0, methodname:'core_course_get_enrolled_courses_by_timeline_classification',
    args: { classification: 'all', limit: 0, offset: 0, sort: 'fullname' } }
  ```
  - `block_myoverview`自体のAJAX描画完了を待たずにこのAPIを直接呼べるため、時間割の背景イラスト取得にはこちらを採用した（DOM待ちより高速化できる）

## 6. コース画面の右ドロワー「活動」ブロック

- ブロック本体: `[data-block="activity_modules"]`（`.block_activity_modules.list_block`）
- 構造: `ul.unlist > li.r0/r1 > div.column.c1 > a[href]`
- リンク先パターン:
  - 通常のmodtype: `/mod/{modtype}/index.php?id={courseId}`（例: `/mod/forum/index.php?id=31432`, `/mod/assign/index.php?id=...`, `/mod/quiz/index.php?id=...`）
  - 資料系をまとめたもの（「リソース」表記）: `/course/resources.php?id={courseId}`（resource/page/url/folder/book等を横断的に含む集約ページ、単一modtypeに対応しない点に注意）
- 実装では、これらのリンクへの遷移を止め、コース本文（`#region-main`内）の `li.activity[data-for="cmitem"]` から同じmodtypeの活動を集めてプルダウン表示することでページ遷移を回避している
  - 活動名の取得元: `li.activity`内の `[data-activityname]` 属性（`div.activity-item[data-activityname="..."]`、modtypeによらず共通して存在することを確認済み）
  - 活動個別ページのURLは `data-id`（cmid）とmodtypeから `/mod/{modtype}/view.php?id={cmid}` を組み立てて生成（forumで実例確認済みのURLパターンと一致）

## 7. コース画面の右ブロックドロワーの構成

コース画面（コース閲覧ページ）の右ドロワー（`#theme_boost-drawers-blocks`）には、確認できた範囲で
以下4つの標準ブロックが並ぶ（`[data-block]`属性で識別）。Moodle既定の並び順は
`course_summary → activity_modules → completion_progress → messageteacher` だったが、
ユーザー要望により `activity_modules → completion_progress → course_summary → messageteacher`
の順に並び替えている（`course-index.js`の`reorderBlocksDrawer()`、共通の親要素の中で
`appendChild`により並び替え。要素の複製はしていない）。

- `course_summary`: コース概要
- `activity_modules`: 活動（フォーラム/課題/小テスト/リソース等へのリンク集。セクション6参照）
- `completion_progress`: 完了プログレス
- `messageteacher`: 私の先生にメッセージ

このコース以外で有効化されているブロックの種類・順序は未確認。ブロック構成が異なるコースでは
`reorderBlocksDrawer()`は「見つかったものだけ」を指定順に並べ、無いものはスキップする作りなので
壊れることはないはずだが、未検証。
