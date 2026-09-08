(function () {
  const RLX = (window.RLX = window.RLX || {});

  // Phase 0調査で確認した実DOM構造に基づくセレクタ集。Moodle更新で変わりうるため一箇所に集約する。
  const SELECTORS = {
    block: ".block_rutime_table",
    legend: ".timetable-legend",
    table: ".timetable-table table.timetable",
    theadRow: "thead tr",
    bodyRows: "tbody tr",
    timeCell: "td.time",
    subject: ".subject",
    courseLink: "a.active-course-name",
    room: ".room",
  };

  const COURSE_IMAGE_CACHE_KEY = "timetable_course_images";
  const COURSE_IMAGE_CACHE_TTL_MS = 30 * 60 * 1000;

  function stripCourseCode(text) {
    return text.replace(/^\d+[:：]\s*/, "").trim();
  }

  // F1-3: "52336:財務会計論 (B) § 52337:財務会計論(B)" のような合併クラス表記から最初の要素のみ残す
  function stripMergedSuffix(text) {
    const idx = text.indexOf("§");
    return idx === -1 ? text : text.slice(0, idx).trim();
  }

  // F1-4: "月1:AC231" → "AC231"
  function stripRoomPrefix(text) {
    return text.replace(/^[月火水木金土日]\d+[:：]\s*/, "").trim();
  }

  function courseIdFromHref(href) {
    const m = href && href.match(/[?&]id=(\d+)/);
    return m ? m[1] : null;
  }

  function cleanCourseNames(root) {
    root.querySelectorAll(SELECTORS.courseLink).forEach((a) => {
      if (RLX.wait.isDone(a)) return;
      const original = a.textContent.trim();
      a.textContent = stripMergedSuffix(stripCourseCode(original));
      a.title = original;
      RLX.wait.markDone(a);
    });
  }

  function cleanRoomLabels(root) {
    root.querySelectorAll(SELECTORS.room).forEach((div) => {
      if (RLX.wait.isDone(div)) return;
      div.textContent = stripRoomPrefix(div.textContent.trim());
      RLX.wait.markDone(div);
    });
  }

  // courseId -> 背景イラスト(CSSのbackground-image値) の対応表を作る。
  function buildCourseImageMap(courses) {
    const map = {};
    courses.forEach((course) => {
      if (course.id && course.courseimage) {
        map[String(course.id)] = `url("${course.courseimage}")`;
      }
    });
    return map;
  }

  function applyCourseImages(root, imageMap) {
    root.querySelectorAll(SELECTORS.subject).forEach((subject) => {
      const link = subject.querySelector(SELECTORS.courseLink);
      const courseId = link && courseIdFromHref(link.getAttribute("href"));
      const backgroundImage = courseId && imageMap[courseId];
      if (backgroundImage) {
        subject.style.backgroundImage = backgroundImage;
        subject.classList.add("rlx-has-course-image");
      }
    });
  }

  // 「コース概要」ブロック自体のAJAX描画完了を待つとその分遅くなるため、
  // ブロックが内部で使うのと同じAPIを直接呼び出す。他の処理と並行して進むよう、
  // init()の本流とは切り離し、取得でき次第、非同期に適用する。
  function applyCourseImagesWhenReady(block) {
    RLX.storage
      .getCachedOrFetch(COURSE_IMAGE_CACHE_KEY, COURSE_IMAGE_CACHE_TTL_MS, () => RLX.api.getEnrolledCourseImages())
      .then((courses) => {
        applyCourseImages(block, buildCourseImageMap(courses));
      })
      .catch((e) => {
        RLX.log.warn("timetable: コース画像の取得に失敗したため背景イラストの反映をスキップします", e);
      });
  }

  function hideLegend(root) {
    const legend = root.querySelector(SELECTORS.legend);
    if (legend) legend.classList.add("rlx-hidden");
  }

  // F1-9: 本日の曜日列をハイライトする。表は月〜土の6列固定（日曜列は無い）。
  function highlightToday(table) {
    const colIndex = RLX.period.getDowColumnIndex();
    if (colIndex === null) return;

    const dayHeaders = Array.from(table.querySelectorAll(`${SELECTORS.theadRow} th`)).slice(1);
    if (dayHeaders[colIndex]) dayHeaders[colIndex].classList.add("rlx-today-col");

    table.querySelectorAll(SELECTORS.bodyRows).forEach((tr) => {
      const dayCells = Array.from(tr.querySelectorAll("td")).slice(1);
      if (dayCells[colIndex]) dayCells[colIndex].classList.add("rlx-today-col");
    });
  }

  // F1-10: 現在時刻が属する時限の行を枠線で強調する。対応表はsettings.periodsから取得。
  function highlightCurrentPeriod(table, periods) {
    const currentIndex = RLX.period.getCurrentPeriodIndex(periods);
    if (currentIndex === null) return;
    table.querySelectorAll(SELECTORS.bodyRows).forEach((tr) => {
      const timeCell = tr.querySelector(SELECTORS.timeCell);
      if (timeCell && timeCell.textContent.trim() === String(currentIndex)) {
        tr.classList.add("rlx-current-period-row");
      }
    });
  }

  RLX.registerFeature({
    name: "timetable",
    matches(pageInfo) {
      return pageInfo.type === "dashboard";
    },
    async init({ settings }) {
      const block = await RLX.wait.waitForElement(SELECTORS.block, { timeout: 5000 });
      if (!block) {
        RLX.log.warn("timetable: .block_rutime_table が見つからないため何もしません");
        return;
      }
      const table = block.querySelector(SELECTORS.table);
      if (!table) {
        RLX.log.warn("timetable: table.timetable が見つからないため何もしません");
        return;
      }

      hideLegend(block);
      cleanCourseNames(block);
      cleanRoomLabels(block);
      applyCourseImagesWhenReady(block);
      highlightToday(table);
      highlightCurrentPeriod(table, settings.periods);
    },
  });
})();
