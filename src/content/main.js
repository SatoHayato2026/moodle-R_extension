(function () {
  const RLX = (window.RLX = window.RLX || {});

  RLX.wait.onceReady(async () => {
    let pageInfo;
    try {
      pageInfo = RLX.page.detect();
    } catch (e) {
      RLX.log.error("ページ種別の判定に失敗しました:", e);
      return;
    }

    // N-5: "other"（ダッシュボード/コース閲覧ページ以外）でも、活動・資料ページ等の
    // コース内ページでドロワーを常時表示する等、動作すべきfeatureがあるため、
    // ここでは処理を打ち切らず、各featureのmatches()に判定を委ねる。
    if (pageInfo.type === "other") {
      RLX.log.debug("ページ種別: other", pageInfo.bodyId);
    }

    let settings;
    try {
      settings = await RLX.settings.getSettings();
    } catch (e) {
      RLX.log.error("設定の読み込みに失敗しました:", e);
      return;
    }

    // N-5: 1つのfeatureの例外が他を止めないよう、個別にtry/catchで隔離する。
    // 各featureは互いのDOM出力に依存しないため、直列awaitではなく並行実行して
    // （例: 課題ブロックのAPI待ちが時間割の表示を遅らせる、といった無駄な待ちを無くす）
    // 体感の読み込み時間を短くする。
    const initPromises = [];
    for (const feature of RLX.features) {
      if (settings.features[feature.name] === false) continue;
      let matched = false;
      try {
        matched = feature.matches(pageInfo);
      } catch (e) {
        RLX.log.error(`feature "${feature.name}" のmatches()でエラー:`, e);
        continue;
      }
      if (!matched) continue;

      const initPromise = Promise.resolve()
        .then(() => feature.init({ pageInfo, settings }))
        .then(() => RLX.log.info(`feature "${feature.name}" を起動しました`))
        .catch((e) => RLX.log.error(`feature "${feature.name}" の初期化に失敗しました:`, e));
      initPromises.push(initPromise);
    }
    await Promise.allSettled(initPromises);
  });
})();
