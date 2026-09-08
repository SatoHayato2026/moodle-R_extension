(function () {
  const RLX = (window.RLX = window.RLX || {});

  const CACHE_PREFIX = "rlx_cache_";

  async function getCache(key) {
    const storageKey = CACHE_PREFIX + key;
    const stored = await chrome.storage.local.get(storageKey);
    return stored[storageKey] || null;
  }

  async function setCache(key, value) {
    const storageKey = CACHE_PREFIX + key;
    await chrome.storage.local.set({
      [storageKey]: { value, timestamp: Date.now() },
    });
  }

  // fetchFn失敗時はキャッシュを更新せず例外を上位に伝播する（F2-7: 呼び出し側でエラー表示させるため）。
  async function getCachedOrFetch(key, ttlMs, fetchFn) {
    const cached = await getCache(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.value;
    }
    const fresh = await fetchFn();
    await setCache(key, fresh);
    return fresh;
  }

  RLX.storage = {
    getCache,
    setCache,
    getCachedOrFetch,
  };
})();
