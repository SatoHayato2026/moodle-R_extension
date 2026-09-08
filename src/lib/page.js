(function () {
  const RLX = (window.RLX = window.RLX || {});

  // Phase 0調査で確認したbody#id: ダッシュボードは"page-my-index"固定、
  // コース画面は"page-course-view-<format>"（例: page-course-view-topics）。
  function detect() {
    const bodyId = document.body.id || "";
    const className = document.body.className || "";

    let type = "other";
    let courseFormat = null;
    if (bodyId === "page-my-index") {
      type = "dashboard";
    } else if (bodyId.startsWith("page-course-view-")) {
      type = "course";
      courseFormat = bodyId.slice("page-course-view-".length);
    }

    const courseIdMatch = className.match(/(?:^|\s)course-(\d+)(?:\s|$)/);
    const courseId = courseIdMatch ? Number(courseIdMatch[1]) : null;

    return {
      type,
      bodyId,
      courseFormat,
      courseId,
      limitedWidth: className.includes("limitedwidth"),
    };
  }

  RLX.page = { detect };
})();
