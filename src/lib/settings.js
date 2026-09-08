(function () {
  const RLX = (window.RLX = window.RLX || {});

  const STORAGE_KEY = "rlx_settings";

  // Phase 0調査時点では時限↔時刻の対応が未確認のため仮値。設定画面で必ず修正できるようにする。
  const DEFAULT_PERIODS = [
    { index: 1, start: "08:50", end: "10:30" },
    { index: 2, start: "10:40", end: "12:20" },
    { index: 3, start: "13:00", end: "14:40" },
    { index: 4, start: "14:50", end: "16:30" },
    { index: 5, start: "16:40", end: "18:20" },
    { index: 6, start: "18:30", end: "20:10" },
  ];

  const DEFAULT_SETTINGS = {
    features: {
      timetable: true,
      deadlines: true,
      // ユーザー確認の結果、コース画面中央の見た目は標準のままにしたいとのことなので既定OFF（設定でON可能）。
      courseTabs: false,
      courseIndex: true,
      navMenu: true,
    },
    // タイムラインは非表示ではなく時間割の下に再配置、最近アクセスは課題ブロックへの置き換えに統一したため、
    // このON/OFFはcourseOverviewのみ意味を持つ（timeline/recentlyAccessedは常時再配置・置換の対象）。
    hideStandardBlocks: {
      courseOverview: false,
    },
    deadlines: {
      defaultRangeDays: 30,
    },
    periods: DEFAULT_PERIODS,
  };

  function deepMerge(base, override) {
    if (typeof override !== "object" || override === null || Array.isArray(override)) {
      return override === undefined ? base : override;
    }
    const result = { ...base };
    for (const key of Object.keys(override)) {
      result[key] = deepMerge(base ? base[key] : undefined, override[key]);
    }
    return result;
  }

  async function getSettings() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return deepMerge(DEFAULT_SETTINGS, stored[STORAGE_KEY] || {});
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = deepMerge(current, partial);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        callback(deepMerge(DEFAULT_SETTINGS, changes[STORAGE_KEY].newValue || {}));
      }
    });
  }

  RLX.settings = {
    DEFAULT_SETTINGS,
    DEFAULT_PERIODS,
    getSettings,
    saveSettings,
    onChange,
  };
})();
