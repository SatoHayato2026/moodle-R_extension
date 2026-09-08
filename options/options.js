(function () {
  const RLX = window.RLX;

  const featureCheckboxes = {
    timetable: document.getElementById("feature-timetable"),
    deadlines: document.getElementById("feature-deadlines"),
    courseTabs: document.getElementById("feature-courseTabs"),
    courseIndex: document.getElementById("feature-courseIndex"),
    navMenu: document.getElementById("feature-navMenu"),
  };

  const hideBlockCheckboxes = {
    courseOverview: document.getElementById("hide-courseOverview"),
  };

  const periodsBody = document.getElementById("periods-body");
  const saveButton = document.getElementById("save");
  const statusEl = document.getElementById("status");

  function renderPeriods(periods) {
    periodsBody.textContent = "";
    periods.forEach((period) => {
      const tr = document.createElement("tr");
      tr.dataset.index = period.index;

      const indexTd = document.createElement("td");
      indexTd.textContent = `${period.index}限`;
      tr.appendChild(indexTd);

      const startTd = document.createElement("td");
      const startInput = document.createElement("input");
      startInput.type = "time";
      startInput.className = "period-start";
      startInput.value = period.start;
      startTd.appendChild(startInput);
      tr.appendChild(startTd);

      const endTd = document.createElement("td");
      const endInput = document.createElement("input");
      endInput.type = "time";
      endInput.className = "period-end";
      endInput.value = period.end;
      endTd.appendChild(endInput);
      tr.appendChild(endTd);

      periodsBody.appendChild(tr);
    });
  }

  function readPeriodsFromForm() {
    return Array.from(periodsBody.querySelectorAll("tr")).map((tr) => ({
      index: Number(tr.dataset.index),
      start: tr.querySelector(".period-start").value,
      end: tr.querySelector(".period-end").value,
    }));
  }

  async function load() {
    const settings = await RLX.settings.getSettings();
    Object.entries(featureCheckboxes).forEach(([key, el]) => {
      el.checked = settings.features[key] !== false;
    });
    Object.entries(hideBlockCheckboxes).forEach(([key, el]) => {
      el.checked = !!settings.hideStandardBlocks[key];
    });
    renderPeriods(settings.periods);
  }

  async function save() {
    const features = {};
    Object.entries(featureCheckboxes).forEach(([key, el]) => {
      features[key] = el.checked;
    });

    const hideStandardBlocks = {};
    Object.entries(hideBlockCheckboxes).forEach(([key, el]) => {
      hideStandardBlocks[key] = el.checked;
    });

    const periods = readPeriodsFromForm();

    await RLX.settings.saveSettings({ features, hideStandardBlocks, periods });
    statusEl.textContent = "保存しました";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 2000);
  }

  saveButton.addEventListener("click", save);
  load();
})();
