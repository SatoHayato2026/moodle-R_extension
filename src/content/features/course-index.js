(function () {
  const RLX = (window.RLX = window.RLX || {});

  // Phase 0 + Phase 4着手前調査で確認したセレクタ（docs/DOM-NOTES.md参照）。
  const SELECTORS = {
    drawer: "#theme_boost-drawers-courseindex",
    blocksDrawer: '#theme_boost-drawers-blocks, [data-region="blocks-drawer"]',
    section: ".courseindex-section",
    sectionTitle: ".courseindex-section-title",
    sectionToggle: 'a[data-toggle="collapse"]',
    cmItem: 'li[data-for="cm"]',
    cmLink: "a.courseindex-link",
    completionInfo: ".completioninfo",
    // 右ドロワーの「活動」ブロック（活動種別ごとの一覧ページへのリンク集）。
    activityModulesBlock: '[data-block="activity_modules"]',
    activityModulesLink: "ul.unlist > li > div.column > a[href]",
    mainActivity: 'li.activity[data-for="cmitem"]',
    mainActivityNameHolder: "[data-activityname]",
    // ドロワー上部の空白リンク（既定ではサイトホームへの空リンク）。ここにコース名を表示する。
    drawerHomeLink: '[data-region="site-home-link"]',
  };

  // 左右のドロワーはウィンドウ幅によって自動的に閉じることがあるため、常時表示状態に固定する。
  function forceOpenDrawer(drawer) {
    if (!drawer) return;
    drawer.classList.add("rlx-force-open");
    const closeButton = drawer.querySelector('[data-action="closedrawer"]');
    if (closeButton) closeButton.classList.add("rlx-hidden");
  }

  // コース画面の右ドロワーに並ぶ標準ブロックの表示順（ユーザー指定）。
  const BLOCK_ORDER = ["activity_modules", "completion_progress", "course_summary", "messageteacher"];

  function reorderBlocksDrawer(blocksDrawer) {
    if (!blocksDrawer) return;
    const anyBlock = blocksDrawer.querySelector("[data-block]");
    const container = anyBlock && anyBlock.parentElement;
    if (!container) return;

    BLOCK_ORDER.forEach((key) => {
      const block = container.querySelector(`[data-block="${key}"]`);
      if (block) container.appendChild(block);
    });
  }

  // document.titleは "セクション名 | コース名 | moodle+R" のように末尾がサイト名固定のため、
  // 末尾から2番目のセグメントを取ればページ種別に関わらずコース名を得られる。
  // ただしコース閲覧ページ自身では該当セグメントが "コース: {コース名}" になるため、この接頭辞は除去する。
  function getCourseFullnameFromTitle() {
    const parts = document.title.split("|").map((p) => p.trim());
    if (parts.length < 2) return null;
    return parts[parts.length - 2].replace(/^コース[:：]\s*/, "");
  }

  // ドロワー上部の空白部分にコース名を表示し、クリックでコースのトップページに遷移できるようにする。
  function setupDrawerHomeLink(drawer, courseId) {
    const link = drawer.querySelector(SELECTORS.drawerHomeLink);
    if (!link) {
      RLX.log.warn("course-index: ドロワー上部のリンクが見つからないためコース名の表示をスキップします");
      return;
    }
    const courseName = getCourseFullnameFromTitle();
    if (!courseName || !courseId) return;

    link.textContent = courseName;
    link.title = courseName;
    link.href = `/course/view.php?id=${courseId}`;
    link.classList.remove("d-md-none");
  }

  // 「活動」ブロックのリンクは "/mod/{modtype}/index.php" または、
  // 資料系をまとめた "/course/resources.php" の2パターンを確認済み。
  function modtypesFromActivityLinkHref(href) {
    const modMatch = href.match(/\/mod\/([^/]+)\/index\.php/);
    if (modMatch) return [modMatch[1]];
    if (href.includes("/course/resources.php")) {
      return RLX.modtype.CATEGORIES.resource.modtypes;
    }
    return [];
  }

  // コース本文（週次表示）のli.activityから、modtype別の活動一覧（名前とリンク）を集める。
  function collectActivitiesByModtype() {
    const map = {};
    document.querySelectorAll(SELECTORS.mainActivity).forEach((li) => {
      const modtype = RLX.modtype.extractModtype(li);
      const cmid = li.dataset.id;
      const nameHolder = li.querySelector(SELECTORS.mainActivityNameHolder);
      const name = nameHolder && nameHolder.dataset.activityname;
      if (!modtype || !cmid || !name) return;
      (map[modtype] = map[modtype] || []).push({ name, href: `/mod/${modtype}/view.php?id=${cmid}` });
    });
    return map;
  }

  // 「活動」ブロックの各リンクをクリックしたときに、ページ遷移せずプルダウンで活動一覧を表示する。
  function setupActivityModulesDropdown() {
    const block = document.querySelector(SELECTORS.activityModulesBlock);
    if (!block) {
      RLX.log.warn('course-index: 「活動」ブロックが見つからないためプルダウン化をスキップします');
      return;
    }

    const activitiesByModtype = collectActivitiesByModtype();

    block.querySelectorAll(SELECTORS.activityModulesLink).forEach((link) => {
      const modtypes = modtypesFromActivityLinkHref(link.getAttribute("href") || "");
      if (modtypes.length === 0) return; // 未知のパターンは元のページ遷移のままにする

      const items = modtypes.flatMap((modtype) => activitiesByModtype[modtype] || []);

      // 既定ですべて展開しておく（クリックで折りたたみ/再展開はできる）。
      const dropdown = document.createElement("ul");
      dropdown.className = "rlx-activity-dropdown unlist";

      if (items.length === 0) {
        const empty = document.createElement("li");
        empty.className = "text-muted";
        empty.textContent = "該当する活動はありません";
        dropdown.appendChild(empty);
      } else {
        items.forEach(({ name, href }) => {
          const itemLi = document.createElement("li");
          const itemLink = document.createElement("a");
          itemLink.href = href;
          itemLink.textContent = name;
          itemLi.appendChild(itemLink);
          dropdown.appendChild(itemLi);
        });
      }

      link.closest("li").appendChild(dropdown);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        dropdown.classList.toggle("rlx-hidden");
      });
    });
  }

  // F4-8: 完了状態は completion_none / completion_complete / completion_incomplete の3種のみ確認済み。
  function addCompletionDots(drawer) {
    drawer.querySelectorAll(SELECTORS.cmItem).forEach((li) => {
      const info = li.querySelector(SELECTORS.completionInfo);
      if (!info || RLX.wait.isDone(info)) return;
      if (info.classList.contains("completion_incomplete")) {
        const dot = document.createElement("span");
        dot.className = "rlx-ci-dot";
        dot.title = "未完了";
        li.appendChild(dot);
      }
      RLX.wait.markDone(info);
    });
  }

  // F4-5: セクションの折りたたみ状態をコース単位でlocalStorageに永続化する。
  function setupCollapseTracking(drawer, courseId) {
    const storageKey = `rlx_ci_collapse_${courseId || "unknown"}`;
    let savedState = {};
    try {
      savedState = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (e) {
      RLX.log.warn("course-index: 保存済み折りたたみ状態の読み込みに失敗しました", e);
    }

    drawer.querySelectorAll(SELECTORS.section).forEach((section) => {
      const sectionId = section.dataset.id;
      const toggle = section.querySelector(SELECTORS.sectionToggle);
      const collapseId = toggle && toggle.getAttribute("href");
      const collapseDiv = collapseId && drawer.querySelector(collapseId);
      if (!toggle || !collapseDiv) return;

      // Bootstrapの実装差異（jQuery版/独自実装）に依存しないよう、class変化を直接監視する。
      new MutationObserver(() => {
        if (sectionId) {
          savedState[sectionId] = collapseDiv.classList.contains("show");
          try {
            localStorage.setItem(storageKey, JSON.stringify(savedState));
          } catch (e) {
            RLX.log.warn("course-index: 折りたたみ状態の保存に失敗しました", e);
          }
        }
      }).observe(collapseDiv, { attributes: true, attributeFilter: ["class"] });

      // 保存済み状態と実際の状態が違えば、Moodle標準のトグルをクリックして同期させる
      // （直接classを書き換えるとMoodle自身のJS/ARIA管理と食い違うリスクがあるため避ける。
      // 開閉アニメーションはCSS側で無効化しているので、複数セクションを同期しても体感は重くならない）。
      // 保存済み状態が無いセクション（初回訪問時等）は、既定で「すべて展開」にする。
      if (sectionId) {
        const shouldExpand = sectionId in savedState ? savedState[sectionId] : true;
        const isExpanded = collapseDiv.classList.contains("show");
        if (shouldExpand !== isExpanded) {
          toggle.click();
        }
      }
    });
  }

  // F4-6・F4-7: 検索ボックスと展開/折りたたむボタンを1つのツールバーにまとめる。
  // Moodle標準ヘッダ（.drawerheadercontent、⋮メニュー等）は高さが固定で狭いため、
  // そこに追加すると既存要素と衝突して見切れる。セクション一覧の直前に独立した行として挿入する。
  function buildToolbar(drawer) {
    const toolbar = document.createElement("div");
    toolbar.className = "rlx-ci-toolbar";

    const input = document.createElement("input");
    input.type = "search";
    input.className = "rlx-ci-search form-control form-control-sm";
    input.placeholder = "活動を検索...";
    toolbar.appendChild(input);

    const buttonRow = document.createElement("div");
    buttonRow.className = "rlx-ci-buttons";

    const expandAllAction = document.querySelector('[data-action="expandallcourseindexsections"]');
    if (!expandAllAction) {
      RLX.log.warn("course-index: 標準の「すべて展開する」アクションが見つかりません");
    }

    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "btn btn-sm btn-link";
    expandBtn.textContent = "すべて展開";
    expandBtn.addEventListener("click", () => {
      if (expandAllAction) {
        expandAllAction.click();
        return;
      }
      drawer.querySelectorAll(`${SELECTORS.sectionToggle}[aria-expanded="false"]`).forEach((t) => t.click());
    });

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "btn btn-sm btn-link";
    collapseBtn.textContent = "すべて折りたたむ";
    collapseBtn.addEventListener("click", () => {
      drawer.querySelectorAll(`${SELECTORS.sectionToggle}[aria-expanded="true"]`).forEach((t) => t.click());
    });

    buttonRow.appendChild(expandBtn);
    buttonRow.appendChild(collapseBtn);
    toolbar.appendChild(buttonRow);

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      drawer.querySelectorAll(SELECTORS.section).forEach((section) => {
        const title = section.querySelector(SELECTORS.sectionTitle);
        const titleText = (title && title.textContent.trim().toLowerCase()) || "";
        let sectionMatches = query === "" || titleText.includes(query);

        section.querySelectorAll(SELECTORS.cmItem).forEach((li) => {
          const link = li.querySelector(SELECTORS.cmLink);
          const text = (link && link.textContent.trim().toLowerCase()) || "";
          const matches = query === "" || text.includes(query);
          li.classList.toggle("rlx-hidden", !matches);
          if (matches) sectionMatches = true;
        });

        section.classList.toggle("rlx-hidden", !sectionMatches);
      });
    });

    return toolbar;
  }

  RLX.registerFeature({
    name: "courseIndex",
    // コース閲覧ページに限らず、資料・課題等コース内の個別活動ページにも同じドロワーが
    // 表示されるため、body#idではなくドロワー自体の有無で判定する。
    matches() {
      return !!(document.querySelector(SELECTORS.drawer) || document.querySelector(SELECTORS.blocksDrawer));
    },
    async init({ pageInfo }) {
      // 常時表示化は、木構造の拡張が行えない場合でも必ず実行する。
      const drawer = document.querySelector(SELECTORS.drawer);
      const blocksDrawer = document.querySelector(SELECTORS.blocksDrawer);
      forceOpenDrawer(drawer);
      forceOpenDrawer(blocksDrawer);
      reorderBlocksDrawer(blocksDrawer);

      if (!drawer) {
        RLX.log.warn("course-index: コースインデックスドロワーが見つからないため木構造の拡張は行いません");
        return;
      }
      setupDrawerHomeLink(drawer, pageInfo.courseId);

      const firstSection = await RLX.wait.waitForElement(`${SELECTORS.drawer} ${SELECTORS.section}`, {
        timeout: 5000,
      });
      if (!firstSection) {
        RLX.log.warn("course-index: セクション一覧が描画されないため木構造の拡張は行いません");
        return;
      }

      drawer.classList.add("rlx-courseindex-enhanced");
      addCompletionDots(drawer);
      setupCollapseTracking(drawer, pageInfo.courseId);
      // 「活動」ブロックのプルダウン化は、全活動が並ぶコース閲覧ページでのみ意味を持つ
      // （個別の資料・活動ページでは一覧データが存在しないため対象外）。
      if (pageInfo.type === "course") {
        setupActivityModulesDropdown();
      }

      const listContainer = firstSection.parentElement;
      if (listContainer) {
        listContainer.insertBefore(buildToolbar(drawer), firstSection);
      } else {
        RLX.log.warn("course-index: ツールバーの挿入先が見つかりません");
      }
    },
  });
})();
