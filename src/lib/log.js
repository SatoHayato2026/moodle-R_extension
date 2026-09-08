(function () {
  const RLX = (window.RLX = window.RLX || {});

  const PREFIX = "[moodle+R]";
  let debugEnabled = false;

  // featureはこの配列にセルフ登録する（manifest.jsonのjs読み込み順に依存しないよう、main.jsが最後にまとめて起動する）。
  RLX.features = RLX.features || [];
  RLX.registerFeature = function (def) {
    RLX.features.push(def);
  };

  RLX.log = {
    setDebug(enabled) {
      debugEnabled = !!enabled;
    },
    debug(...args) {
      if (debugEnabled) console.debug(PREFIX, ...args);
    },
    info(...args) {
      console.info(PREFIX, ...args);
    },
    warn(...args) {
      console.warn(PREFIX, ...args);
    },
    error(...args) {
      console.error(PREFIX, ...args);
    },
  };
})();
