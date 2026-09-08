(function () {
  const RLX = (window.RLX = window.RLX || {});

  // 「ノート」一覧ページ（local_learningtools）。実DOM調査で確認した構造:
  // #accordion 配下の各カードが <button data-toggle="collapse" data-target="#collapse-N-block" aria-expanded="true">
  // を持つが、aria-expandedは常に"true"固定で実際の開閉には使われていない。
  // 実際の開閉は対象要素（data-targetが指す<div>）の.showクラスの有無で決まり、
  // かつ各対象に data-parent="#accordion" が付いているため、Bootstrap標準の
  // 「1つ開くと他が閉じる」アコーディオン動作になっている（最新の1件だけ開いて見える原因）。
  const SELECTORS = {
    accordion: "#accordion",
    toggle: '[data-toggle="collapse"][data-target]',
  };

  RLX.registerFeature({
    name: "noteList",
    matches() {
      return document.body.id === "page-local-learningtools-ltool-note-list";
    },
    async init() {
      const accordion = await RLX.wait.waitForElement(SELECTORS.accordion, { timeout: 5000 });
      if (!accordion) {
        RLX.log.warn("note-list: #accordion が見つからないため何もしません");
        return;
      }

      const toggles = accordion.querySelectorAll(SELECTORS.toggle);
      if (toggles.length === 0) {
        RLX.log.warn("note-list: 折りたたみ要素が見つかりませんでした（想定と異なる構造の可能性）");
        return;
      }

      toggles.forEach((toggle) => {
        const target = document.querySelector(toggle.getAttribute("data-target"));
        if (!target) return;
        // data-parentがあると「1つ開くと他を閉じる」動作になるため、すべて同時展開するために外す。
        target.removeAttribute("data-parent");
        target.classList.add("show");
        toggle.setAttribute("aria-expanded", "true");
      });
    },
  });
})();
