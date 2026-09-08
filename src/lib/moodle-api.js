(function () {
  const RLX = (window.RLX = window.RLX || {});

  // N-2: sesskeyはMAIN world注入ではなくDOMから取得する。
  // input[name=sesskey]が無いページ（ダッシュボード等）ではlogoutリンクのhrefから正規表現で抽出する（Phase 0で確認済みの手法）。
  function getSesskey() {
    const input = document.querySelector("input[name=sesskey]");
    if (input && input.value) return input.value;

    const logoutLink = document.querySelector('a[href*="logout.php?sesskey="]');
    const match = logoutLink && logoutLink.href.match(/sesskey=([^&]+)/);
    if (match) return match[1];

    throw new Error("sesskeyを取得できませんでした");
  }

  async function callAjax(methodname, args) {
    const sesskey = getSesskey();
    const response = await fetch(
      `/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=${encodeURIComponent(methodname)}`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ index: 0, methodname, args }]),
      }
    );
    if (!response.ok) {
      throw new Error(`Moodle AJAX APIがHTTP ${response.status}を返しました`);
    }
    const [result] = await response.json();
    if (!result || result.error) {
      throw new Error(`Moodle AJAX APIがエラーを返しました: ${JSON.stringify(result && result.exception)}`);
    }
    return result.data;
  }

  // Phase 0調査で、このAPIは課題以外（url等）の完了予定日も返すことを確認済み。
  // 呼び出し側（deadlines.js）でmodulenameによる絞り込みを行う前提の生データを返す。
  async function getActionEventsByTimesort({ timesortfromDays = 14, limitnum = 50 } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const data = await callAjax("core_calendar_get_action_events_by_timesort", {
      limitnum,
      timesortfrom: now - timesortfromDays * 86400,
      limittononsuspendedevents: true,
    });
    return data.events || [];
  }

  // 「コース概要」ブロックが内部で使うのと同じAPI。ブロックのAJAX描画完了を待たずに
  // 直接呼び出すことで、時間割の背景イラスト取得を他の処理と並行して進められるようにする。
  async function getEnrolledCourseImages() {
    const data = await callAjax("core_course_get_enrolled_courses_by_timeline_classification", {
      classification: "all",
      limit: 0,
      offset: 0,
      sort: "fullname",
    });
    return data.courses || [];
  }

  RLX.api = {
    getSesskey,
    callAjax,
    getActionEventsByTimesort,
    getEnrolledCourseImages,
  };
})();
