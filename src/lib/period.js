(function () {
  const RLX = (window.RLX = window.RLX || {});

  const DOW_LABELS = ["月", "火", "水", "木", "金", "土"];

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  // periodsはsettings.periods（{index,start,end}[]）を渡す。現在時刻が属する時限のindexを返す（無ければnull）。
  function getCurrentPeriodIndex(periods, date = new Date()) {
    const nowMinutes = date.getHours() * 60 + date.getMinutes();
    const hit = periods.find(
      (p) => nowMinutes >= toMinutes(p.start) && nowMinutes <= toMinutes(p.end)
    );
    return hit ? hit.index : null;
  }

  // 時間割は月〜土の6列（日曜列は無い）。getDay()の0=日,1=月...6=土を0=月...5=土に変換し、日曜はnullにする。
  function getDowColumnIndex(date = new Date()) {
    const dow = date.getDay();
    return dow === 0 ? null : dow - 1;
  }

  RLX.period = {
    DOW_LABELS,
    toMinutes,
    getCurrentPeriodIndex,
    getDowColumnIndex,
  };
})();
