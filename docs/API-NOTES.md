# Moodle Web API 調査メモ（Phase 0）

> 未確定。`core_calendar_get_action_events_by_timesort` の疎通確認結果が届き次第、
> このファイルを実データ（レスポンスJSON全体、および項目定義）で更新すること。

## 呼び出し方法

- sesskey取得元:
- エンドポイント: `/lib/ajax/service.php?sesskey=...&info=core_calendar_get_action_events_by_timesort`

## レスポンス実例

`{index:0, methodname:'core_calendar_get_action_events_by_timesort', args:{limitnum:50, timesortfrom: now-14*86400, limittononsuspendedevents:true}}` で疎通確認できた。実レスポンス（1件目）:

```json
{
  "error": false,
  "data": {
    "events": [
      {
        "id": 3419550,
        "name": "成績発表等日程掲載場所 要完了",
        "description": "",
        "descriptionformat": 1,
        "location": "",
        "categoryid": null,
        "groupid": null,
        "userid": 47988,
        "repeatid": null,
        "eventcount": null,
        "component": "mod_url",
        "modulename": "url",
        "activityname": "成績発表等日程掲載場所",
        "activitystr": "65_URL 必要アクション",
        "instance": 295193,
        "eventtype": "expectcompletionon",
        "timestart": 1788384600,
        "timeduration": 0,
        "timesort": 1788384600,
        "timeusermidnight": 1788361200,
        "visible": 1,
        "timemodified": 1788316920,
        "overdue": true,
        "icon": {
          "key": "monologo",
          "component": "url",
          "alttext": "活動イベント",
          "iconurl": "https://lms.ritsumei.ac.jp/theme/image.php/boost/url/1786062698/monologo?filtericon=1",
          "iconclass": ""
        },
        "course": {
          "id": 42987,
          "fullname": "経営学部生のコース",
          "shortname": "mdba0016",
          "viewurl": "https://lms.ritsumei.ac.jp/course/view.php?id=42987"
        }
      }
    ]
  }
}
```
（`action`, `url` 等それ以降のフィールドは出力が長大なため未転記。実装時に改めてフルレスポンスをファイルに保存して確認する）

## 項目定義（レスポンスの主要フィールド、確認できた分）

| フィールド | 型 | 意味 | 備考 |
|---|---|---|---|
| `id` | number | イベントID | |
| `name` | string | イベント名（例: "成績発表等日程掲載場所 要完了"） | 表示名としてそのまま使うと冗長。`activityname`の方が短く適切 |
| `component` / `modulename` | string | 活動の種類（`mod_url` / `url` 等） | **F2の絞り込みに必須** |
| `activityname` | string | 活動名（例: "成績発表等日程掲載場所"） | 表示用 |
| `eventtype` | string | イベント種別（例: `expectcompletionon` = 完了予定日） | assignの締切は別の値（`due`等）になる想定、要追加確認 |
| `timesort` | number(unix) | 締切昇順ソート用タイムスタンプ | F2-3のソートキー |
| `overdue` | boolean | 超過しているか | F2-4の色分けにそのまま使える |
| `course.id` / `course.fullname` / `course.viewurl` | | コース情報 | 表示・リンクに使用 |
| `icon.iconurl` | string | 活動アイコンURL | |

## F2要件との整合性チェック

- [x] **想定と食い違いを検出**: このAPIは「課題(assign)の締切」だけでなく、**活動完了(completion)の予定日全般**を返す。今回の1件目は `mod_url`（単なるURLリンク活動）の完了予定イベントだった。`eventtype: "expectcompletionon"` がそれを示す。
  - → **【決定】F2は `modulename` が `assign` / `quiz` / `workshop` のイベントのみ表示する**（F3の「課題・テスト」カテゴリと同一の絞り込み条件で統一。ユーザー確認済み、2026-09-06）。それ以外の `url`/`page`/`resource` 等の完了予定イベントはAPIレスポンスから除外してよい。
- [x] コース名・課題名・締切タイムスタンプ・遷移URLの取得元フィールドを確認: `course.fullname`, `activityname`, `timesort`, `course.viewurl`（個別活動へのURLは`url`フィールド等、別途確認要）

### 未検証（学期開始後、実際の課題・テストがある状態で確認すること。README.mdの「次にやること」も参照）

- [ ] `assign`/`quiz`/`workshop` の実際のイベントが返ってくるか、その際のフィールド構成（`activitystr`, `eventtype`が`due`等になるか等）
- [ ] 提出済み課題は返却データから除外されるか、それとも含まれて完了フラグが立つか（提出済みassignを取得して`overdue`/完了フラグの挙動を見る。除外されない場合、`deadlines.js`に提出済み判定の除外ロジックを追加する必要あり）
- [ ] 空配列時のレスポンス形状（現状「該当する課題はありません」表示で対応しているが、実際に空配列 `[]` が返るのか、`events`キー自体が無いのか未確認）
- [ ] 認証切れ・sesskey不正時のレスポンス形状（`deadlines.js`の`catch`でエラー表示にはなるはずだが、メッセージが分かりやすいか要確認）
- [ ] 課題数が多い場合、`limitnum:50`の上限に収まらず、締切が近い課題が漏れることが無いか（`timesortfromDays:14`とソート順の関係を要確認）

## 実装時に判明した制約

- **`limitnum` は1〜50の範囲のみ許可**（`Limit must be between 1 and 50 (inclusive)` エラーを実際に確認）。100を指定して実装時にエラーになった。50を上限として使うこと。

## core_course_get_enrolled_courses_by_timeline_classification（コース画像取得用に追加採用）

「コース概要」ブロック（`block_myoverview`）が内部で使っているのと同じAPI。ブロック自体のAJAX描画完了を待たずに直接呼び出せるため、時間割の背景イラスト取得（F1拡張）に採用した。

呼び出し例:
```js
{ index: 0, methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
  args: { classification: 'all', limit: 0, offset: 0, sort: 'fullname' } }
```

レスポンス（`data.courses[]`）の主要フィールド:

| フィールド | 型 | 意味 |
|---|---|---|
| `id` | number | コースID |
| `fullname` / `fullnamedisplay` | string | コース名 |
| `viewurl` | string | コースへのリンク |
| `courseimage` | string | `data:image/svg+xml;base64,...` 形式の自動生成イラスト。コースごとに固有 |

`limit: 0` で全コース分を1回のリクエストで取得できることを確認済み。`RLX.storage.getCachedOrFetch`で30分キャッシュして再利用している。
