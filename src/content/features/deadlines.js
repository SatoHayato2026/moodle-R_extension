(function () {
  const RLX = (window.RLX = window.RLX || {});

  const SELECTORS = {
    timetableBlock: ".block_rutime_table",
    // Phase 0では未検証。標準ブロックの実セレクタが違っても警告のみで機能全体は止めない。
    timelineBlock: '[data-block="timeline"], .block_timeline',
    blocksDrawer: '#theme_boost-drawers-blocks, [data-region="blocks-drawer"]',
    sidePre: "#block-region-side-pre",
    recentlyAccessedBlock: '[data-block="recentlyaccesseditems"], .block_recentlyaccesseditems',
  };

  const FILTER_OPTIONS = [
    { value: "overdue", label: "期限切れ" },
    { value: "7", label: "7日" },
    { value: "30", label: "30日" },
    { value: "all", label: "すべて" },
  ];

  const CACHE_KEY = "deadlines_events";
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function isWithinFilter(event, filter, nowMs) {
    const remainingMs = event.timesort * 1000 - nowMs;
    if (filter === "overdue") return remainingMs <= 0;
    if (filter === "all") return true;
    const rangeMs = Number(filter) * 86400000;
    return remainingMs <= rangeMs; // 超過分も含める（緊急度が高いイベントを常に見せるため）
  }

  function tierFor(remainingMs) {
    if (remainingMs <= 0) return "overdue";
    if (remainingMs <= 24 * 3600000) return "urgent";
    if (remainingMs <= 7 * 86400000) return "soon";
    return "normal";
  }

  function formatRemaining(remainingMs) {
    const abs = Math.abs(remainingMs);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const text = days > 0 ? `${days}日${hours}時間` : `${hours}時間`;
    return remainingMs <= 0 ? `${text}超過` : `残り${text}`;
  }

  const DUE_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function formatDueDate(timesortSec) {
    return DUE_DATE_FORMATTER.format(new Date(timesortSec * 1000));
  }

  // レスポンスのフィールド名がAPI側の非公開仕様により変わりうるため、複数候補を試す。
  function getEventUrl(event) {
    if (event.url) return event.url;
    if (event.action && event.action.url) return event.action.url;
    if (event.course && event.course.viewurl) return event.course.viewurl;
    return "#";
  }

  function getCourseName(event) {
    return (event.course && (event.course.fullnamedisplay || event.course.fullname)) || "";
  }

  function getActivityName(event) {
    return event.activityname || event.name || "";
  }

  // タイムラインは非表示にせず、時間割ブロックの直下（同じ列）に再配置する。
  function repositionTimeline() {
    const timetable = document.querySelector(SELECTORS.timetableBlock);
    const timeline = document.querySelector(SELECTORS.timelineBlock);
    if (!timetable || !timeline) {
      RLX.log.warn("deadlines: 時間割またはタイムラインブロックが見つからず再配置をスキップします");
      return;
    }
    timetable.insertAdjacentElement("afterend", timeline);
  }

  // 右のブロックドロワー（カレンダー等）はウィンドウ幅によって自動的に閉じることがあるため、
  // 常時表示状態に固定する（.rlx-force-openの実際のスタイルはbase.cssで共通定義）。
  function forceOpenBlocksDrawer() {
    const drawer = document.querySelector(SELECTORS.blocksDrawer);
    if (!drawer) {
      RLX.log.warn("deadlines: 右ブロックドロワーが見つからないため常時表示化をスキップします");
      return;
    }
    drawer.classList.add("rlx-force-open");
    const closeButton = drawer.querySelector('[data-action="closedrawer"]');
    if (closeButton) closeButton.classList.add("rlx-hidden");
  }

  function buildBlockSkeleton() {
    const section = document.createElement("section");
    section.className = "rlx-deadlines block card mb-3";

    const body = document.createElement("div");
    body.className = "card-body p-3";
    section.appendChild(body);

    const title = document.createElement("h3");
    title.className = "h5 card-title";
    title.textContent = "課題・小テスト（締切順）";
    body.appendChild(title);

    const select = document.createElement("select");
    select.className = "rlx-deadlines-filter form-select form-select-sm";
    FILTER_OPTIONS.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    body.appendChild(select);

    const errorEl = document.createElement("div");
    errorEl.className = "rlx-deadlines-error rlx-hidden";
    body.appendChild(errorEl);

    const listEl = document.createElement("div");
    listEl.className = "rlx-deadlines-list";
    body.appendChild(listEl);

    return section;
  }

  function showError(errorEl, error) {
    errorEl.textContent = `課題の取得に失敗しました（${error.message}）`;
    errorEl.classList.remove("rlx-hidden");
  }

  // 右ドロワーは幅が狭いため、表を使わず縦積みのカードリストにする。
  function renderList(listEl, events, nowMs) {
    listEl.textContent = "";

    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rlx-deadlines-empty text-muted mb-0";
      empty.textContent = "該当する課題はありません";
      listEl.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "rlx-deadlines-items unlist";

    events.forEach((event) => {
      const remainingMs = event.timesort * 1000 - nowMs;
      const tier = tierFor(remainingMs);

      const li = document.createElement("li");
      li.className = `rlx-deadline-item rlx-deadline-${tier}`;

      // 授業科目 → 課題内容 → 締切日（残り時間は締切日に併記）の3行構成。
      const courseEl = document.createElement("div");
      courseEl.className = "rlx-deadline-course";
      courseEl.textContent = getCourseName(event);
      li.appendChild(courseEl);

      const activityEl = document.createElement("div");
      activityEl.className = "rlx-deadline-activity";
      const link = document.createElement("a");
      link.href = getEventUrl(event);
      link.textContent = getActivityName(event);
      activityEl.appendChild(link);
      li.appendChild(activityEl);

      const dueEl = document.createElement("div");
      dueEl.className = "rlx-deadline-due";
      dueEl.textContent = `${formatDueDate(event.timesort)}（${formatRemaining(remainingMs)}）`;
      li.appendChild(dueEl);

      list.appendChild(li);
    });

    listEl.appendChild(list);
  }

  RLX.registerFeature({
    name: "deadlines",
    matches(pageInfo) {
      return pageInfo.type === "dashboard";
    },
    async init() {
      repositionTimeline();
      forceOpenBlocksDrawer();

      const sidePre = document.querySelector(SELECTORS.sidePre);
      const recentBlock = document.querySelector(SELECTORS.recentlyAccessedBlock);
      if (!sidePre && !recentBlock) {
        RLX.log.warn("deadlines: ブロックの挿入先が見つからないため何もしません");
        return;
      }

      const block = buildBlockSkeleton();
      if (recentBlock) {
        recentBlock.classList.add("rlx-hidden");
      }
      // カレンダーより上に来るよう、ドロワーの先頭に配置する。
      if (sidePre) {
        sidePre.insertBefore(block, sidePre.firstChild);
      } else if (recentBlock) {
        recentBlock.insertAdjacentElement("beforebegin", block);
      }

      const listEl = block.querySelector(".rlx-deadlines-list");
      const errorEl = block.querySelector(".rlx-deadlines-error");
      const select = block.querySelector(".rlx-deadlines-filter");

      // F2-5の既定値。settings.deadlines.defaultRangeDaysとのUI連動はPhase 6(設定画面)で行う。
      let currentFilter = "30";
      select.value = currentFilter;

      let events = [];
      try {
        const raw = await RLX.storage.getCachedOrFetch(CACHE_KEY, CACHE_TTL_MS, () =>
          RLX.api.getActionEventsByTimesort({ timesortfromDays: 14, limitnum: 50 })
        );
        // F2-2: このAPIはassign以外(url等)の完了予定日も返すため、課題・テストのみに絞る（Phase 0調査で確認、要件確定済み）。
        events = raw
          .filter((event) => RLX.modtype.ASSESSMENT_MODTYPES.includes(event.modulename))
          .sort((a, b) => a.timesort - b.timesort);
      } catch (e) {
        RLX.log.error("deadlines: 取得に失敗しました", e);
        showError(errorEl, e);
        return;
      }

      function render() {
        const nowMs = Date.now();
        const filtered = events.filter((event) => isWithinFilter(event, currentFilter, nowMs));
        renderList(listEl, filtered, nowMs);
      }

      select.addEventListener("change", () => {
        currentFilter = select.value;
        render();
      });

      render();
    },
  });
})();
