(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var birthInput = $("birthdate");
  var expectancyInput = $("expectancy");
  var timeEl = $("time");
  var ageEl = $("age-readout");
  var phraseEl = $("phrase");
  var detailEl = $("detail");
  var toggleBtn = $("toggle-btn");
  var panel = $("expectancy-panel");
  var summary = $("expectancy-summary");
  var advanceBtn = $("advance-btn");
  var returnBtn = $("return-btn");
  var simulationActions = $("simulation-actions");
  var rememberInput = $("remember");
  var progressWrap = $("progress-wrap");
  var progress = $("life-progress");
  var progressFill = $("progress-fill");
  var birthError = $("birth-error");
  var expectancyError = $("expectancy-error");
  var root = document.documentElement;
  var skyA = $("sky-a");
  var skyB = $("sky-b");
  var starsEl = $("stars");
  var celestialEl = $("celestial");
  var scrimLight = $("scrim-light");
  var scrimDark = $("scrim-dark");
  var currentSky = "a";
  var steppedHour = null;
  var birthTimer = null;
  var expectancyTimer = null;
  var STORAGE_KEY = "relogio-da-vida-preferences";

  function pad(value) { return String(value).padStart(2, "0"); }
  function localISO(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  birthInput.max = localISO(new Date());
  birthInput.min = "1900-01-01";

  function loadPreferences() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data || !data.remember) return;
      rememberInput.checked = true;
      if (data.birthdate) birthInput.value = data.birthdate;
      if (data.expectancy) expectancyInput.value = data.expectancy;
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function savePreferences() {
    if (!rememberInput.checked) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ remember: true, birthdate: birthInput.value, expectancy: expectancyInput.value }));
  }

  function setPanel(open) {
    panel.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
    if (open) expectancyInput.focus();
  }

  toggleBtn.addEventListener("click", function () { setPanel(panel.hidden); });
  rememberInput.addEventListener("change", savePreferences);
  $("reset-expectancy").addEventListener("click", function () {
    expectancyInput.value = "80";
    validateAndUpdate();
  });

  function hexToRgb(hex) {
    var clean = hex.replace("#", "");
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function lerpRgb(a, b, amount) { return a.map(function (value, index) { return Math.round(lerp(value, b[index], amount)); }); }
  function rgbCss(rgb) { return "rgb(" + rgb.join(",") + ")"; }
  function brightness(rgb) { return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000; }

  var rawStops = [
    [0, "#0a0f1e", "#06091a", "#030408"], [5, "#2a2144", "#1c1a3a", "#0a0b1c"],
    [6.5, "#7a5470", "#4a4470", "#202c52"], [7.5, "#f2a765", "#a488a8", "#34558c"],
    [9, "#cfe6f0", "#8fc4e6", "#3f76b0"], [12, "#eef6fb", "#a9d6f2", "#4a8dc8"],
    [15, "#e9dcb0", "#9fc0dd", "#4a7cae"], [17.5, "#e8935a", "#8a86a8", "#2f4a78"],
    [19, "#a8506a", "#5a3f68", "#161638"], [21, "#241f3d", "#161430", "#07070f"],
    [24, "#0a0f1e", "#06091a", "#030408"]
  ];
  var stops = rawStops.map(function (row) { return { h: row[0], horizon: hexToRgb(row[1]), mid: hexToRgb(row[2]), zenith: hexToRgb(row[3]) }; });
  var idleSky = { horizon: hexToRgb("#dfe3e6"), mid: hexToRgb("#cdd6de"), zenith: hexToRgb("#b9c6d1") };

  function skyAt(hour) {
    for (var i = 0; i < stops.length - 1; i += 1) {
      var start = stops[i], end = stops[i + 1];
      if (hour >= start.h && hour <= end.h) {
        var amount = (hour - start.h) / (end.h - start.h);
        return { horizon: lerpRgb(start.horizon, end.horizon, amount), mid: lerpRgb(start.mid, end.mid, amount), zenith: lerpRgb(start.zenith, end.zenith, amount) };
      }
    }
    return stops[stops.length - 1];
  }

  function setSky(sky) {
    var css = "linear-gradient(to top," + rgbCss(sky.horizon) + " 0%," + rgbCss(sky.mid) + " 28%," + rgbCss(sky.zenith) + " 100%)";
    var incoming = currentSky === "a" ? skyB : skyA;
    var outgoing = currentSky === "a" ? skyA : skyB;
    incoming.style.backgroundImage = css;
    incoming.style.opacity = "1";
    outgoing.style.opacity = "0";
    currentSky = currentSky === "a" ? "b" : "a";
  }

  function applyReading(mid) {
    var darkText = brightness(mid) > 150;
    root.style.setProperty("--text", darkText ? "#1c1712" : "#f8f4ec");
    root.style.setProperty("--muted", darkText ? "#5f574c" : "#ddd6c8");
    root.style.setProperty("--line", darkText ? "rgba(28,23,18,.30)" : "rgba(248,244,236,.35)");
    root.style.setProperty("--surface", darkText ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)");
    root.style.setProperty("--error", darkText ? "#8b1e1e" : "#ffd1d1");
    root.style.setProperty("--picker-invert", darkText ? "0" : "1");
    scrimLight.style.opacity = darkText ? "1" : "0";
    scrimDark.style.opacity = darkText ? "0" : "1";
    document.querySelector('meta[name="theme-color"]').content = rgbCss(mid);
  }

  function applyCelestial(hour) {
    var sun = hour >= 6.5 && hour <= 19;
    var adjusted = hour < 6.5 ? hour + 24 : hour;
    var amount = sun ? (hour - 6.5) / 12.5 : (adjusted - 19) / 11.5;
    var arc = Math.sin(Math.PI * Math.max(0, Math.min(1, amount)));
    var color = lerpRgb(sun ? [255, 138, 74] : [150, 160, 190], sun ? [255, 246, 214] : [232, 236, 248], arc);
    celestialEl.className = "celestial-body " + (sun ? "sun" : "moon");
    celestialEl.style.top = (84 - arc * 68) + "%";
    celestialEl.style.left = (16 + amount * 68) + "%";
    celestialEl.style.opacity = Math.min(1, arc * 3.2).toFixed(2);
    celestialEl.style.backgroundColor = rgbCss(color);
    celestialEl.style.boxShadow = "0 0 36px 10px rgba(" + color.join(",") + ",.4)";
  }

  function buildStars() {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < 70; i += 1) {
      var star = document.createElement("span");
      var size = (Math.random() * 1.6 + .6).toFixed(2);
      star.className = "star";
      star.style.cssText = "top:" + (Math.pow(Math.random(), 1.3) * 82) + "%;left:" + (Math.random() * 100) + "%;width:" + size + "px;height:" + size + "px;--base-opacity:" + (Math.random() * .5 + .5).toFixed(2) + ";animation-delay:" + (Math.random() * 6).toFixed(2) + "s";
      fragment.appendChild(star);
    }
    starsEl.appendChild(fragment);
  }

  function phraseFor(hour) {
    if (hour < 5) return "Grande parte de quem você é ainda está sendo descoberta.";
    if (hour < 7) return "As escolhas começam a ganhar contornos próprios.";
    if (hour < 12) return "Ainda há muitas manhãs dentro desta manhã.";
    if (hour < 14) return "O sol está a pino: um bom instante para olhar ao redor.";
    if (hour < 18) return "A tarde convida a escolher o que merece permanecer.";
    if (hour < 20) return "A luz muda, mas ainda há caminhos a percorrer.";
    if (hour < 23) return "A memória ilumina lugares que o tempo transformou.";
    return "Cada instante continua inteiro enquanto acontece.";
  }

  function formatNumber(number, digits) { return number.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function validExpectancy() {
    var value = Number(expectancyInput.value.replace(",", "."));
    var valid = Number.isFinite(value) && value >= 1 && value <= 130;
    expectancyInput.setAttribute("aria-invalid", String(!valid));
    expectancyError.textContent = valid ? "" : "Informe um valor entre 1 e 130 anos.";
    return valid ? value : null;
  }

  function readState() {
    birthError.textContent = "";
    birthInput.setAttribute("aria-invalid", "false");
    if (!birthInput.value) return { valid: false, empty: true };
    var birth = LifeClock.parseLocalDate(birthInput.value);
    var now = new Date();
    if (!birth || birth > now) {
      birthInput.setAttribute("aria-invalid", "true");
      birthError.textContent = "Informe uma data que já tenha ocorrido.";
      return { valid: false };
    }
    var expectancy = validExpectancy();
    if (expectancy === null) return { valid: false, invalidExpectancy: true };
    return { valid: true, expectancy: expectancy, result: LifeClock.calculate(birth, expectancy, now) };
  }

  function showIdle(message) {
    timeEl.textContent = "––:––";
    timeEl.setAttribute("aria-label", "Horário ainda não calculado");
    ageEl.textContent = "";
    detailEl.textContent = "";
    phraseEl.textContent = message;
    progressWrap.hidden = true;
    setSky(idleSky);
    applyReading(idleSky.mid);
    starsEl.style.opacity = "0";
    celestialEl.style.opacity = "0";
  }

  function render(hourDecimal, state, simulated) {
    var result = state.result;
    var overflow = !simulated && result.overflow;
    var effectiveHour = overflow ? 23.99 : hourDecimal;
    var clock = overflow ? "24:00+" : LifeClock.formatClock(effectiveHour);
    var percentage = overflow ? 100 : Math.min(100, effectiveHour / 24 * 100);
    timeEl.textContent = clock;
    timeEl.setAttribute("aria-label", "Horário da vida: " + clock.replace(":", " horas e ") + " minutos");
    ageEl.textContent = formatNumber(simulated ? effectiveHour / 24 * state.expectancy : result.age, 1) + " anos · " + formatNumber(percentage, 1) + "% do dia";
    phraseEl.textContent = overflow ? "Você ultrapassou a expectativa usada nesta representação." : phraseFor(effectiveHour);
    var yearsPerHour = state.expectancy / 24;
    detailEl.textContent = simulated
      ? "Exploração: esta hora equivale a aproximadamente " + formatNumber(effectiveHour / 24 * state.expectancy, 1) + " anos."
      : "Referência de " + formatNumber(state.expectancy, state.expectancy % 1 ? 1 : 0) + " anos · cada hora representa cerca de " + formatNumber(yearsPerHour, 1) + " anos.";
    progressWrap.hidden = false;
    progress.setAttribute("aria-valuenow", String(Math.round(percentage)));
    progressFill.style.width = percentage + "%";
    var sky = skyAt(effectiveHour);
    setSky(sky);
    applyReading(sky.mid);
    applyCelestial(effectiveHour);
    starsEl.style.opacity = Math.pow(1 - Math.max(0, Math.min(1, (brightness(sky.zenith) - 6) / 144)), 1.7).toFixed(3);
  }

  function validateAndUpdate() {
    steppedHour = null;
    simulationActions.hidden = true;
    var expectancy = validExpectancy();
    if (expectancy !== null) summary.textContent = formatNumber(expectancy, expectancy % 1 ? 1 : 0) + " anos";
    var state = readState();
    advanceBtn.disabled = !state.valid || state.result.overflow;
    if (!state.valid) {
      showIdle(state.empty ? "Primeiro, informe sua data de nascimento." : state.invalidExpectancy ? "Revise a expectativa de vida." : "Revise a data informada.");
      return;
    }
    render(state.result.hourDecimal, state, false);
    savePreferences();
  }

  function advanceHour() {
    var state = readState();
    if (!state.valid) return;
    if (steppedHour === null) steppedHour = Math.floor(state.result.hourDecimal) + 1;
    else steppedHour += 1;
    steppedHour = Math.min(24, steppedHour);
    render(Math.min(23.99, steppedHour), state, true);
    simulationActions.hidden = false;
    advanceBtn.disabled = steppedHour >= 24;
  }

  function debounceUpdate(timerName) {
    clearTimeout(timerName === "birth" ? birthTimer : expectancyTimer);
    var timer = setTimeout(validateAndUpdate, 300);
    if (timerName === "birth") birthTimer = timer;
    else expectancyTimer = timer;
  }

  birthInput.addEventListener("input", function () { debounceUpdate("birth"); });
  birthInput.addEventListener("change", validateAndUpdate);
  expectancyInput.addEventListener("input", function () { debounceUpdate("expectancy"); });
  expectancyInput.addEventListener("change", validateAndUpdate);
  advanceBtn.addEventListener("click", advanceHour);
  returnBtn.addEventListener("click", validateAndUpdate);

  buildStars();
  loadPreferences();
  validateAndUpdate();
})();
