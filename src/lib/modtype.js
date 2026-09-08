(function () {
  const RLX = (window.RLX = window.RLX || {});

  // Phase 0でコース画面から実在を確認したmodtype: forum, resource, url, questionnaire, assign, quiz
  // （questionnaireはどのカテゴリにも属さないため"other"に落ちる想定どおりの挙動）
  const CATEGORIES = {
    resource: { label: "授業資料", modtypes: ["resource", "folder", "url", "page", "book", "label"] },
    assessment: { label: "課題・テスト", modtypes: ["assign", "quiz", "workshop"] },
    forum: { label: "アナウンス・フォーラム", modtypes: ["forum"] },
    other: { label: "その他", modtypes: [] },
  };

  const MODTYPE_TO_CATEGORY = {};
  for (const [key, def] of Object.entries(CATEGORIES)) {
    for (const modtype of def.modtypes) {
      MODTYPE_TO_CATEGORY[modtype] = key;
    }
  }

  function categoryOf(modtype) {
    return MODTYPE_TO_CATEGORY[modtype] || "other";
  }

  // li.activity等の要素から"modtype_xxx"クラスを見つけてxxxを返す。
  function extractModtype(el) {
    for (const cls of el.classList) {
      if (cls.startsWith("modtype_")) {
        return cls.slice("modtype_".length);
      }
    }
    return null;
  }

  RLX.modtype = {
    CATEGORIES,
    // F2の締切フィルタ（modulenameがこれに含まれるイベントのみ表示）にも流用する。
    ASSESSMENT_MODTYPES: CATEGORIES.assessment.modtypes,
    categoryOf,
    extractModtype,
  };
})();
