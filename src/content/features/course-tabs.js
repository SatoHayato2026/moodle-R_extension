(function () {
  const RLX = (window.RLX = window.RLX || {});

  // Phase 5着手前調査で確認したセレクタ（docs/DOM-NOTES.md参照）。
  const SELECTORS = {
    regionMain: "#region-main",
    section: 'li.section[data-for="section"]',
    sectionHeader: '[data-for="section_title"]',
    sectionToggle: 'a[data-toggle="collapse"]',
    cmList: '[data-for="cmlist"]',
    activity: 'li.activity[data-for="cmitem"]',
    activityBadge: ".activitybadge",
  };

  // セクションの折りたたみボタンのaria-labelに正式なセクション名が入っている
  // （data-for="section_title"配下には一括選択用のsr-onlyラベルも混在するため、こちらの方が確実）。
  function getSectionName(section) {
    const header = section.querySelector(SELECTORS.sectionHeader);
    const toggle = header && header.querySelector(SELECTORS.sectionToggle);
    const label = toggle && toggle.getAttribute("aria-label");
    return (label || (header && header.textContent.trim()) || "").trim();
  }

  // F3-5: 未提出/未読を判定できる確実なDOM要素が今回のコースには無かったため、
  // 唯一確認できた「活動バッジ（未読件数等）が空でない」ことだけを暫定的な優先シグナルとする。
  function hasPriority(li) {
    const badge = li.querySelector(SELECTORS.activityBadge);
    return !!(badge && badge.textContent.trim() !== "");
  }

  function ensureWeekLabel(li, weekName) {
    if (li.querySelector(".rlx-ct-week-label")) return;
    const label = document.createElement("div");
    label.className = "rlx-ct-week-label";
    label.textContent = weekName;
    li.insertBefore(label, li.firstChild);
  }

  function collectActivities(regionMain) {
    const activities = [];
    regionMain.querySelectorAll(SELECTORS.section).forEach((section) => {
      const list = section.querySelector(SELECTORS.cmList);
      if (!list) return;
      const weekName = getSectionName(section);
      list.querySelectorAll(SELECTORS.activity).forEach((li) => {
        const modtype = RLX.modtype.extractModtype(li);
        activities.push({
          li,
          homeList: list,
          weekName,
          category: RLX.modtype.categoryOf(modtype),
        });
      });
    });
    return activities;
  }

  function buildTabs() {
    const nav = document.createElement("div");
    nav.className = "rlx-ct-tabs";

    const classifyTab = document.createElement("button");
    classifyTab.type = "button";
    classifyTab.className = "rlx-ct-tab";
    classifyTab.textContent = "分類";

    const weeklyTab = document.createElement("button");
    weeklyTab.type = "button";
    weeklyTab.className = "rlx-ct-tab";
    weeklyTab.textContent = "週次（標準）";

    nav.appendChild(classifyTab);
    nav.appendChild(weeklyTab);
    return { nav, classifyTab, weeklyTab };
  }

  function buildCategoryContainers() {
    const container = document.createElement("div");
    container.className = "rlx-ct-classification";
    const lists = {};

    Object.entries(RLX.modtype.CATEGORIES).forEach(([key, def]) => {
      const details = document.createElement("details");
      details.className = "rlx-ct-category";
      details.open = true;

      const summary = document.createElement("summary");
      summary.textContent = `${def.label} `;
      const countSpan = document.createElement("span");
      countSpan.className = "rlx-ct-count";
      summary.appendChild(countSpan);

      const list = document.createElement("ul");
      list.className = "rlx-ct-list unlist";

      details.appendChild(summary);
      details.appendChild(list);
      container.appendChild(details);
      lists[key] = { list, countSpan };
    });

    return { container, lists };
  }

  // F3-6: 元DOMノードは複製せずappendChildで移設する（Moodle標準JSのイベントリスナを保つため）。
  function showClassification(activities, lists) {
    const grouped = {};
    Object.keys(lists).forEach((key) => (grouped[key] = []));
    activities.forEach((item) => grouped[item.category].push(item));

    Object.entries(grouped).forEach(([key, items]) => {
      // 安定ソートなので、優先度が同じ項目同士の元の順序は保たれる
      const sorted = items.slice().sort((a, b) => Number(hasPriority(b.li)) - Number(hasPriority(a.li)));
      sorted.forEach((item) => {
        ensureWeekLabel(item.li, item.weekName);
        lists[key].list.appendChild(item.li);
      });
      lists[key].countSpan.textContent = `(${items.length})`;
    });
  }

  // F3-7: 週次（標準）タブに戻す際も、元の順序どおりappendChildし直すだけで複製は行わない。
  function showWeekly(activities) {
    activities.forEach((item) => {
      item.homeList.appendChild(item.li);
    });
  }

  RLX.registerFeature({
    name: "courseTabs",
    matches(pageInfo) {
      return pageInfo.type === "course";
    },
    async init() {
      // 編集モード中はドラッグ&ドロップ並び替え等、Moodle自身のJSがDOM構造に依存する可能性があるため無効化する。
      if (document.body.classList.contains("editing")) {
        RLX.log.info("course-tabs: 編集モード中のため無効化します");
        return;
      }

      const regionMain = await RLX.wait.waitForElement(SELECTORS.regionMain, { timeout: 5000 });
      if (!regionMain) {
        RLX.log.warn("course-tabs: #region-main が見つからないため何もしません");
        return;
      }

      const firstSection = regionMain.querySelector(SELECTORS.section);
      if (!firstSection || !firstSection.parentElement) {
        RLX.log.warn("course-tabs: セクション一覧が見つからないため何もしません");
        return;
      }
      const weeklyContainer = firstSection.parentElement;

      const activities = collectActivities(regionMain);
      if (activities.length === 0) {
        RLX.log.warn("course-tabs: 活動が見つからないため何もしません");
        return;
      }

      const { nav, classifyTab, weeklyTab } = buildTabs();
      const { container: classificationContainer, lists } = buildCategoryContainers();

      weeklyContainer.parentElement.insertBefore(nav, weeklyContainer);
      weeklyContainer.parentElement.insertBefore(classificationContainer, weeklyContainer);

      function activate(tab) {
        const isClassify = tab === "classify";
        if (isClassify) {
          showClassification(activities, lists);
        } else {
          showWeekly(activities);
        }
        classificationContainer.classList.toggle("rlx-hidden", !isClassify);
        weeklyContainer.classList.toggle("rlx-hidden", isClassify);
        classifyTab.classList.toggle("active", isClassify);
        weeklyTab.classList.toggle("active", !isClassify);
      }

      classifyTab.addEventListener("click", () => activate("classify"));
      weeklyTab.addEventListener("click", () => activate("weekly"));

      activate("classify"); // F3-1: 既定は分類タブ
    },
  });
})();
