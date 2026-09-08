(function () {
  const RLX = (window.RLX = window.RLX || {});

  // document_start実行時はまだ<body>が無い場合があるため、featureの起動はこれで揃える。
  function onceReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  // ダッシュボードのタイムライン等はAJAX後描画のため、出現をポーリングではなくMutationObserverで待つ。
  function waitForElement(selector, { root = document, timeout = 8000 } = {}) {
    return new Promise((resolve) => {
      const existing = root.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }
      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      observer.observe(root === document ? document.documentElement : root, {
        childList: true,
        subtree: true,
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // Moodleの部分再描画による無限ループ・多重適用を防ぐための冪等性マーカー（1.5節のリスク5対策）。
  function isDone(el) {
    return el.dataset.rlxDone === "1";
  }

  function markDone(el) {
    el.dataset.rlxDone = "1";
  }

  // 変更が連続するAJAX描画をデバウンスしてまとめて処理するための汎用observer。
  function observeMutations(root, callback, { debounceMs = 200 } = {}) {
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(callback, debounceMs);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  RLX.wait = {
    onceReady,
    waitForElement,
    isDone,
    markDone,
    observeMutations,
  };
})();
