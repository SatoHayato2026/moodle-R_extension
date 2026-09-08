(function () {
  const RLX = (window.RLX = window.RLX || {});

  // 上部ナビゲーションバー（Boostテーマの"moremenu"）。全ページ共通のヘッダーに表示される。
  const SELECTORS = {
    navList: 'nav.moremenu ul[role="menubar"]',
  };

  const NOTE_LABEL = "ノート";
  const MORE_LABEL = "その他";
  // ユーザー確認済み: これらは「その他」に集約し、ダッシュボード・ノート・外部リンク以外は隠す。
  const CONSOLIDATE_LABELS = ["Home", "マイコース", "学習機能", "リンク集", "Course search", "Intelliboard"];

  // 「ダッシュボード」「ノート」の直後に並べる外部リンク（新しいタブで開く）。
  const EXTERNAL_LINKS = [
    { label: "Respon", href: "https://ritsumei.respon.jp/attend/ritsumei" },
    { label: "My Library", href: "https://runners.ritsumei.ac.jp/opac/opac_search/?loginMode=disp&lang=0" },
    { label: "Campus Web", href: "https://cw.ritsumei.ac.jp/campusweb/login.html" },
    { label: "シラバス", href: "https://www.ritsumei.ac.jp/pathways-future/syllabus/" },
  ];

  function getTopLevelLabel(li) {
    const link = li.querySelector(":scope > a.nav-link, :scope > a.dropdown-toggle");
    return link ? link.textContent.trim() : "";
  }

  // 「学習機能」ドロップダウンの中から「ノート」だけを抜き出し、独立した項目にする。
  function extractNoteLink(navList, items) {
    const learningToolsLi = items.find((li) => getTopLevelLabel(li) === "学習機能");
    if (!learningToolsLi) {
      RLX.log.warn('nav: 「学習機能」メニューが見つかりませんでした');
      return;
    }

    const noteLink = Array.from(learningToolsLi.querySelectorAll(".dropdown-item")).find(
      (a) => a.textContent.trim() === NOTE_LABEL
    );
    if (!noteLink) {
      RLX.log.warn('nav: 「ノート」リンクが見つかりませんでした');
      return;
    }

    const noteLi = document.createElement("li");
    noteLi.className = "nav-item";
    noteLi.setAttribute("role", "none");
    noteLink.className = "nav-link";
    noteLi.appendChild(noteLink);

    const dashboardLi = items.find((li) => li.dataset.key === "myhome");
    if (dashboardLi) {
      dashboardLi.insertAdjacentElement("afterend", noteLi);
    } else {
      navList.insertBefore(noteLi, navList.firstChild);
    }
    return noteLi;
  }

  // Respon・Campus Web・シラバスへの外部リンクを新しいタブで開く項目として追加する。
  function buildExternalLinkItems() {
    return EXTERNAL_LINKS.map(({ label, href }) => {
      const li = document.createElement("li");
      li.className = "nav-item";
      li.setAttribute("role", "none");

      const a = document.createElement("a");
      a.className = "nav-link";
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = label;

      li.appendChild(a);
      return li;
    });
  }

  // Home・マイコース・学習機能(残り)・リンク集・Course search・Intelliboardを「その他」ドロップダウンにまとめる。
  function buildMoreMenu(navList, items) {
    const moreLi = document.createElement("li");
    moreLi.className = "dropdown nav-item";
    moreLi.setAttribute("role", "none");

    const toggle = document.createElement("a");
    toggle.className = "dropdown-toggle nav-link";
    toggle.href = "#";
    toggle.setAttribute("role", "menuitem");
    toggle.setAttribute("data-toggle", "dropdown");
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = MORE_LABEL;

    const menu = document.createElement("div");
    menu.className = "dropdown-menu";
    menu.setAttribute("role", "menu");

    moreLi.appendChild(toggle);
    moreLi.appendChild(menu);

    let moved = 0;
    items.forEach((li) => {
      const label = getTopLevelLabel(li);
      if (!CONSOLIDATE_LABELS.includes(label)) return;

      const existingDropdown = li.querySelector(":scope > .dropdown-menu");
      if (existingDropdown) {
        // 「学習機能」の残り（ノート抽出後のブックマーク等）や、他のドロップダウン項目をそのまま移す。
        Array.from(existingDropdown.children).forEach((child) => menu.appendChild(child));
      } else {
        const link = li.querySelector(":scope > a");
        if (link) {
          link.className = "dropdown-item";
          menu.appendChild(link);
        }
      }
      li.remove();
      moved += 1;
    });

    if (moved > 0) {
      navList.appendChild(moreLi);
    }
  }

  RLX.registerFeature({
    name: "navMenu",
    matches() {
      return !!document.querySelector(SELECTORS.navList);
    },
    async init() {
      const navList = document.querySelector(SELECTORS.navList);
      if (!navList) {
        RLX.log.warn("nav: 上部ナビゲーションが見つからないため整理をスキップします");
        return;
      }
      if (navList.dataset.rlxNavDone === "1") return; // 別ページ遷移後の多重適用防止
      navList.dataset.rlxNavDone = "1";

      const items = Array.from(navList.children).filter((el) => el.tagName === "LI");
      const noteLi = extractNoteLink(navList, items);

      // 「ダッシュボード」→「ノート」→外部リンク3つ、の順に並べる。
      let insertionPoint = noteLi || items.find((li) => li.dataset.key === "myhome");
      if (insertionPoint) {
        buildExternalLinkItems().forEach((li) => {
          insertionPoint.insertAdjacentElement("afterend", li);
          insertionPoint = li;
        });
      } else {
        RLX.log.warn("nav: 外部リンクの挿入位置が見つからないため先頭に挿入します");
        buildExternalLinkItems()
          .reverse()
          .forEach((li) => navList.insertBefore(li, navList.firstChild));
      }

      buildMoreMenu(navList, items);
    },
  });
})();
