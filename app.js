// 点到 —— 前端控制器 v2（浅色默认 + 主题切换 + 追问链）
document.addEventListener("DOMContentLoaded", () => {

  const state = {
    userChart: null,
    sessions: [],
    currentSessionId: null,
    soundEnabled: true,
    theme: "light",
    kbMode: "ziwei",
    settings: { provider: "builtin", apiKey: "", apiEndpoint: "", kbMode: "ziwei" }
  };

  // 紫微十二宫盘方位：巳午未申 / 辰□□酉 / 卯□□戌 / 寅丑子亥
  const GRID_LAYOUT = [
    [5,1,1], [6,1,2], [7,1,3], [8,1,4],
    [4,2,1],                   [9,2,4],
    [3,3,1],                   [10,3,4],
    [2,4,1], [1,4,2], [0,4,3], [11,4,4]
  ];
  const HUA_CLASS = { "禄": "lu", "权": "quan", "科": "ke", "忌": "ji" };

  let sound = null;

  /* ---------------- 主题 ---------------- */
  function initTheme() {
    const saved = localStorage.getItem("starbook_theme") || "light";
    applyTheme(saved);
  }
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("starbook_theme", t);
    const icon = document.getElementById("theme-icon");
    const label = document.getElementById("theme-label");
    if (icon) icon.textContent = t === "light" ? "🌙" : "☀️";
    if (label) label.textContent = t === "light" ? "夜间" : "浅色";
  }

  /* ---------------- 星点背景 ---------------- */
  function initStarCanvas() {
    const c = document.getElementById("space-canvas");
    if (!c) return;
    const ctx = c.getContext("2d");
    let w = (c.width = innerWidth), h = (c.height = innerHeight);
    addEventListener("resize", () => { w = c.width = innerWidth; h = c.height = innerHeight; });

    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.3 + 0.3,
      a: Math.random() * .6 + .2,
      s: Math.random() * .012 + .004,
      d: Math.random() > .5 ? 1 : -1
    }));

    function loop() {
      const color = getComputedStyle(document.documentElement).getPropertyValue("--star-color").trim() || "rgba(154,107,63,.2)";
      ctx.clearRect(0, 0, w, h);
      stars.forEach(s => {
        s.a += s.s * s.d;
        if (s.a > .85) s.d = -1;
        if (s.a < .15) s.d = 1;
        ctx.globalAlpha = s.a;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------------- 音效 ---------------- */
  function initSound() {
    let actx = null;
    const get = () => {
      if (!actx && (window.AudioContext || window.webkitAudioContext))
        actx = new (window.AudioContext || window.webkitAudioContext)();
      return actx;
    };
    const tone = (f1, f2, dur, vol, type) => {
      if (!state.soundEnabled) return;
      try {
        const a = get(); if (!a) return;
        if (a.state === "suspended") a.resume();
        const o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f1, a.currentTime);
        o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + dur * .7);
        g.gain.setValueAtTime(vol, a.currentTime);
        g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur);
        o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
      } catch (e) {}
    };
    return {
      chime: () => tone(528, 740, .8, .12, "sine"),
      send: () => tone(330, 620, .14, .08, "triangle")
    };
  }

  /* ---------------- 持久化 ---------------- */
  function updateEngineBadge() {
    const btn = document.getElementById("btn-open-settings");
    if (!btn) return;
    const hasKey = Boolean(state.settings.apiKey && state.settings.apiKey.trim());
    const prov = (state.settings.provider && state.settings.provider !== "builtin") ? state.settings.provider : (hasKey ? "deepseek" : "builtin");
    const names = {
      deepseek: "DeepSeek",
      qwen: "千问 Qwen",
      zhipu: "智谱 GLM",
      moonshot: "Kimi",
      doubao: "豆包",
      openai: "OpenAI"
    };
    if (hasKey && prov !== "builtin") {
      btn.innerHTML = `<span style="color:#34d399;">●</span> AI 已连接 (${names[prov] || prov}) ⚙`;
      btn.style.borderColor = "rgba(52, 211, 153, 0.45)";
    } else {
      btn.innerHTML = `<span>⚙</span> 引擎设置 (离线)`;
      btn.style.borderColor = "";
    }
  }

  function loadPersisted() {
    let profile = { year: 1998, month: 8, day: 18, hour: 10, minute: 30, city: "默认 (东经120°标准时)", gender: "female", status: "single" };
    try {
      const p = localStorage.getItem("starbook_user_profile");
      if (p) profile = JSON.parse(p);
    } catch (e) {}
    updateChart(profile, false);

    try {
      const s = localStorage.getItem("starbook_settings");
      if (s) {
        state.settings = { ...state.settings, ...JSON.parse(s) };
        if (state.settings.apiKey && state.settings.apiKey.trim() && (!state.settings.provider || state.settings.provider === "builtin")) {
          state.settings.provider = "deepseek";
          localStorage.setItem("starbook_settings", JSON.stringify(state.settings));
        }
        const a = document.getElementById("settings-provider");
        const b = document.getElementById("settings-api-key");
        const c = document.getElementById("settings-api-endpoint");
        if (a) a.value = state.settings.provider || "builtin";
        if (b) b.value = state.settings.apiKey || "";
        if (c) c.value = state.settings.apiEndpoint || "";
        const d = document.getElementById("settings-model");
        if (d) d.value = state.settings.modelName || "";
      }
    } catch (e) {}
    const savedKbMode = localStorage.getItem("starbook_kb_mode") || "ziwei";
    setKbMode(savedKbMode, false);
    updateEngineBadge();
  }

  function getRoomMessages(s, mode) {
    if (!s) return [];
    const m = mode || state.kbMode || "ziwei";
    if (!s.ziweiMessages) s.ziweiMessages = Array.isArray(s.messages) ? [...s.messages] : [];
    if (!s.baziMessages) s.baziMessages = [];
    return m === "bazi" ? s.baziMessages : s.ziweiMessages;
  }

  function setKbMode(mode, persist = true) {
    if (mode !== "bazi") mode = "ziwei";
    state.kbMode = mode;
    state.settings.kbMode = mode;
    if (persist) localStorage.setItem("starbook_kb_mode", mode);

    document.querySelectorAll(".kb-tab").forEach(btn => {
      const isAct = btn.dataset.kbMode === mode;
      btn.classList.toggle("active", isAct);
      const badge = btn.querySelector(".room-enter-badge");
      if (badge) badge.textContent = isAct ? "当前窗口" : "点击切换";
    });

    if (state.userChart) renderDynamicPrompts(state.userChart);
    const curSess = state.sessions.find(x => x.id === state.currentSessionId);
    if (curSess) {
      renderMessages(getRoomMessages(curSess, mode));
    }
  }

  function updateTstPreview(p) {
    const el = document.getElementById("drawer-tst-preview");
    if (!el || !window.AstrologyCore || !window.AstrologyCore.computeTrueSolarTime) return;
    const city = p.city || "默认 (东经120°标准时)";
    const lon = window.AstrologyCore.CITY_LONGITUDES[city] !== undefined
      ? window.AstrologyCore.CITY_LONGITUDES[city]
      : 120.0;
    const mode = p.timeMode || document.getElementById("drawer-time-mode")?.value || "interval";

    if (mode === "interval" && window.AstrologyCore.analyzeTimeInterval) {
      const rStart = p.rangeStart || document.getElementById("drawer-range-start")?.value || "09:00";
      const rEnd   = p.rangeEnd   || document.getElementById("drawer-range-end")?.value   || "12:00";
      const [sh, sm] = rStart.split(":").map(Number);
      const [eh, em] = rEnd.split(":").map(Number);
      const res = window.AstrologyCore.analyzeTimeInterval({
        year: p.year, month: p.month, day: p.day,
        startHour: isNaN(sh) ? 9 : sh, startMinute: isNaN(sm) ? 0 : sm,
        endHour: isNaN(eh) ? 12 : eh, endMinute: isNaN(em) ? 0 : em,
        city, gender: p.gender || "female", status: p.status || "single"
      });

      if (res.isSingleShichen && res.candidates.length === 1) {
        const c = res.candidates[0];
        el.className = "tst-preview-box";
        el.innerHTML = `✅ <strong>无需知道具体几分！命盘 100% 唯一确定！</strong><br>📍 您的出生区间（钟表 ${rStart}–${rEnd}）经【${city}】真太阳时校准后（${res.tstStart.trueTimeStr}–${res.tstEnd.trueTimeStr}），<strong>全部落在同一个时辰【${c.shichenName}（八字时柱：${c.hourPillar} · 紫微命宫：${c.mingStars}）】内</strong>！<br>💡 八字与紫微均以两小时为一个时辰，同一时辰内任何分钟排出的命盘完全一致！`;
      } else {
        el.className = "tst-preview-box shifted";
        const names = res.candidates.map(c => `【${c.shichenName}】`).join(" 或 ");
        el.innerHTML = `⚠️ <strong>这个区间跨了 ${res.candidates.length} 个时辰，命盘还不唯一</strong><br>`
          + `你填的区间（${rStart}–${rEnd}）经【${city}】真太阳时校准后是 <strong>${res.tstStart.trueTimeStr}–${res.tstEnd.trueTimeStr}</strong>，可能落在 ${names}。`
          + `<span class="tst-note">时辰不同，命宫主星与八字时柱完全不同，结论会差很远。用几道客观题就能定到唯一一盘。</span>`
          + `<button type="button" class="drawer-open-rectify-btn" onclick="window.__openRectifyModal()">🧭 开始精准定盘</button>`;
      }
      return;
    }

    // 精确时间模式
    const tst = window.AstrologyCore.computeTrueSolarTime(p.year, p.month, p.day, p.hour, p.minute || 0, lon, city);
    const rawBz = window.AstrologyCore.computeBazi(p.year, p.month, p.day, p.hour, p.minute || 0);
    const calBz = window.AstrologyCore.computeBazi(tst.year, tst.month, tst.day, tst.hour, tst.minute);
    const DZ = window.AstrologyCore.DIZHI;

    if (!tst.isCalibrated) {
      el.className = "tst-preview-box";
      el.innerHTML = `⏱ <strong>当前按东经120°北京时间排盘</strong>（钟表时间 ${tst.clockTimeStr} · ${DZ[rawBz.hZhiIdx]}时）。<br>💡 若出生在成都/重庆/西安/广州/深圳/新疆等地，请在上方选择您的<strong>出生城市</strong>校准真太阳时。`;
    } else if (rawBz.hZhiIdx !== calBz.hZhiIdx) {
      el.className = "tst-preview-box shifted";
      el.innerHTML = `🚨 <strong>真太阳时跨时辰关键修正！</strong><br>📍 出生地【${city}（东经${lon}°）】真太阳时比北京时间${tst.totalDeltaMin >= 0 ? "快" : "慢"} <strong>${Math.abs(tst.totalDeltaMin)} 分钟</strong>。<br>⏰ 钟表时间 ${tst.clockTimeStr}（原${DZ[rawBz.hZhiIdx]}时）→ <strong>当地真太阳时 ${tst.trueTimeStr}，排盘时辰已精准修正为【${DZ[calBz.hZhiIdx]}时】！</strong>`;
    } else {
      el.className = "tst-preview-box";
      const sign = tst.totalDeltaMin >= 0 ? "+" : "";
      el.innerHTML = `✅ <strong>当地真太阳时已校准</strong>：出生地【${city}（东经${lon}°）】<br>⏰ 钟表时间 ${tst.clockTimeStr} → <strong>真太阳时 ${tst.trueTimeStr}</strong>（差值 ${sign}${tst.totalDeltaMin} 分钟，仍属<strong>【${DZ[calBz.hZhiIdx]}时】</strong>）。`;
    }
  }

  window.__lockCandidateShichen = function(clockH, clockM, shichenName) {
    const modeSel = document.getElementById("drawer-time-mode");
    const exactWrap = document.getElementById("drawer-exact-wrap");
    const intervalWrap = document.getElementById("drawer-interval-wrap");
    const bt = document.getElementById("drawer-birthtime");
    if (modeSel) modeSel.value = "exact";
    if (exactWrap) exactWrap.style.display = "block";
    if (intervalWrap) intervalWrap.style.display = "none";
    const pad = n => String(n).padStart(2, "0");
    if (bt) bt.value = `${pad(clockH)}:${pad(clockM)}`;

    const d = document.getElementById("drawer-birthdate")?.value || "1998-08-18";
    const [y, m, dd] = d.split("-").map(Number);
    const city = document.getElementById("drawer-city")?.value || "默认 (东经120°标准时)";
    updateChart({
      year: y, month: m, day: dd,
      hour: clockH, minute: clockM,
      timeMode: "exact",
      city: city,
      gender: document.getElementById("drawer-gender")?.value || "female",
      status: document.getElementById("drawer-status")?.value || ""
    }, true);
    sound.chime();
    document.getElementById("chart-drawer")?.classList.remove("open");
  };

  let currentRectifyQuiz = null;
  let rectifyAnswers = {};

  window.__openRectifyModal = function() {
    if (!window.AstrologyCore || !window.AstrologyCore.buildRectifyQuiz) return;
    const d = document.getElementById("drawer-birthdate")?.value || "1998-08-18";
    const [y, m, dd] = d.split("-").map(Number);
    const city = document.getElementById("drawer-city")?.value || "默认 (东经120°标准时)";
    const gender = document.getElementById("drawer-gender")?.value || "female";
    const status = document.getElementById("drawer-status")?.value || "";
    const rStart = document.getElementById("drawer-range-start")?.value || "09:00";
    const rEnd   = document.getElementById("drawer-range-end")?.value || "12:00";
    const [sh, sm] = rStart.split(":").map(Number);
    const [eh, em] = rEnd.split(":").map(Number);

    const ivRes = window.AstrologyCore.analyzeTimeInterval({
      year: y, month: m, day: dd,
      startHour: isNaN(sh) ? 9 : sh, startMinute: isNaN(sm) ? 0 : sm,
      endHour: isNaN(eh) ? 12 : eh, endMinute: isNaN(em) ? 0 : em,
      city, gender, status
    });

    currentRectifyQuiz = window.AstrologyCore.buildRectifyQuiz(ivRes.candidates);
    rectifyAnswers = {};

    const container = document.getElementById("rectify-quiz-container");
    const verdictBox = document.getElementById("rectify-verdict-box");
    if (verdictBox) verdictBox.style.display = "none";

    if (container && currentRectifyQuiz) {
      rectifyVisibleRounds = 1;
      flattenRectifyQuiz();
      renderRectifyQuiz();
    }

    openModal("modal-rectify");
  };

  /* ================= 定盘：多轮渐进式出题 + 置信度判定 ================= */
  let rectifyVisibleRounds = 1;
  let rectifyFlat = [];   // [{ q, round }]，把所有轮次的题拍平，索引即全局题号

  function flattenRectifyQuiz() {
    rectifyFlat = [];
    if (!currentRectifyQuiz) return;
    const rounds = currentRectifyQuiz.rounds || [currentRectifyQuiz.questions || []];
    rounds.forEach((r, ri) => r.forEach(q => rectifyFlat.push({ q: q, round: ri })));
  }

  function renderRectifyQuiz() {
    const container = document.getElementById("rectify-quiz-container");
    if (!container || !currentRectifyQuiz) return;
    let html = "";
    rectifyFlat.forEach((item, gIdx) => {
      if (item.round >= rectifyVisibleRounds) return;
      const q = item.q;
      const picked = rectifyAnswers[gIdx];
      html += `
        <div class="rectify-quiz-q" data-q-id="${q.id}">
          <div class="rectify-quiz-dim">${escapeHtml(q.dimension)}</div>
          <div class="rectify-quiz-title">${gIdx + 1}. ${escapeHtml(q.question)}</div>
          <div class="rectify-opts-list">
            ${q.options.map((opt, oIdx) => `
              <button type="button" class="rectify-opt-btn${picked === opt.candIdx ? " selected" : ""}" onclick="window.__selectRectifyOpt(${gIdx}, ${opt.candIdx}, this)">
                <strong>选项 ${String.fromCharCode(65 + oIdx)}：</strong>${escapeHtml(opt.label)}
              </button>
            `).join("")}
            <button type="button" class="rectify-opt-btn is-unsure${picked === -1 ? " selected" : ""}" onclick="window.__selectRectifyOpt(${gIdx}, -1, this)">
              🤷 <strong>说不准</strong> —— 两边都像，或这段时间我没什么印象（此题不计分）
            </button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  }

  window.__selectRectifyOpt = function(qIdx, candIdx, btnEl) {
    if (!currentRectifyQuiz) return;
    const parent = btnEl.closest(".rectify-opts-list");
    if (parent) parent.querySelectorAll(".rectify-opt-btn").forEach(b => b.classList.remove("selected"));
    btnEl.classList.add("selected");
    rectifyAnswers[qIdx] = candIdx;
    evaluateRectifyQuiz();
  };

  window.__revealNextRectifyRound = function() {
    const total = (currentRectifyQuiz && currentRectifyQuiz.rounds) ? currentRectifyQuiz.rounds.length : 1;
    if (rectifyVisibleRounds >= total) return;
    rectifyVisibleRounds++;
    renderRectifyQuiz();
    evaluateRectifyQuiz();
    let firstNew = 0;
    for (let i = 0; i < rectifyFlat.length; i++) {
      if (rectifyFlat[i].round === rectifyVisibleRounds - 1) { firstNew = i; break; }
    }
    const qs = document.querySelectorAll("#rectify-quiz-container .rectify-quiz-q");
    if (qs[firstNew]) qs[firstNew].scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 判定门槛：权重不够或领先不够，一律不给结论，避免"答一题就 100% 吻合"的假精确
  const RECTIFY_MIN_WEIGHT = 60;   // 已计分权重下限
  const RECTIFY_MIN_LEAD   = 0.34; // 领先幅度须占已计分权重的 1/3 以上

  function evaluateRectifyQuiz() {
    if (!currentRectifyQuiz) return;
    const verdictBox = document.getElementById("rectify-verdict-box");
    if (!verdictBox) return;

    const cands = currentRectifyQuiz.candidates;
    const scores = {};
    cands.forEach((c, i) => { scores[i] = 0; });

    let answeredWeight = 0, unsureCount = 0, answeredCount = 0;
    Object.keys(rectifyAnswers).forEach(k => {
      const gi = parseInt(k, 10);
      const item = rectifyFlat[gi];
      if (!item) return;
      answeredCount++;
      const cIdx = rectifyAnswers[gi];
      if (cIdx < 0) { unsureCount++; return; }   // "说不准" 不计分
      const w = item.q.weight || 25;
      scores[cIdx] = (scores[cIdx] || 0) + w;
      answeredWeight += w;
    });

    if (answeredCount === 0) { verdictBox.style.display = "none"; return; }

    const ranked = cands.map((c, i) => ({ i: i, c: c, s: scores[i] || 0 })).sort((a, b) => b.s - a.s);
    const top = ranked[0];
    const second = ranked[1] || { s: 0 };
    const lead = top.s - second.s;
    const leadRatio = answeredWeight > 0 ? lead / answeredWeight : 0;

    let status = "confident";
    if (answeredWeight < RECTIFY_MIN_WEIGHT) status = "insufficient";
    else if (leadRatio < RECTIFY_MIN_LEAD) status = "tie";

    const totalRounds = (currentRectifyQuiz.rounds || [currentRectifyQuiz.questions]).length;
    const hasMore = rectifyVisibleRounds < totalRounds;
    const visibleCount = rectifyFlat.filter(x => x.round < rectifyVisibleRounds).length;

    const breakdown = ranked.map(r => {
      const pct = answeredWeight > 0 ? Math.round((r.s / answeredWeight) * 100) : 0;
      const crown = (r.i === top.i && status === "confident") ? "🏆 " : "";
      return `<span style="margin-right:14px;">${crown}<strong>${r.c.shichenName}盘（命宫${r.c.mingStars}）</strong>：${pct}%</span>`;
    }).join("");

    let tone, headline, detail;
    if (status === "insufficient") {
      tone = "#f59e0b";
      headline = "证据还不够，暂不下结论";
      detail = `已计分权重 ${answeredWeight}（判定线 ${RECTIFY_MIN_WEIGHT}）`
             + (unsureCount ? `，其中 ${unsureCount} 题选了「说不准」不计分` : "")
             + `。再多答几题才谈得上定盘。`;
    } else if (status === "tie") {
      tone = "#f59e0b";
      headline = "两盘咬得很近，现在还分不开";
      detail = `领先幅度只有 ${Math.round(leadRatio * 100)}%，没到 ${Math.round(RECTIFY_MIN_LEAD * 100)}% 的判定线`
             + (unsureCount ? `；另有 ${unsureCount} 题你选了「说不准」` : "")
             + `。这种情况下硬定一个盘，后面所有分析都会跟着错。`;
    } else {
      tone = "#10b981";
      headline = `【${top.c.shichenName}盘】明显领先`;
      detail = `在已计分的 ${answeredWeight} 点权重里领先 ${Math.round(leadRatio * 100)}%，超过了 ${Math.round(RECTIFY_MIN_LEAD * 100)}% 的判定线`
             + (unsureCount ? `（${unsureCount} 题「说不准」未计入）` : "")
             + `。`;
    }

    const btns = [];
    if (status === "confident") {
      btns.push(`<button type="button" class="save-chart-btn" style="background:linear-gradient(135deg,#10b981,#059669); font-size:13px;" onclick="window.__applyRectifiedChart(${top.c.clockHour}, ${top.c.clockMinute}, '${top.c.shichenName}')">✨ 采纳：锁定【${top.c.shichenName}盘】并更新全盘</button>`);
      if (hasMore) {
        btns.push(`<button type="button" class="save-chart-btn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); font-size:12.2px;" onclick="window.__revealNextRectifyRound()">➕ 再验证一组题（更稳妥）</button>`);
      }
    } else if (hasMore) {
      btns.push(`<button type="button" class="save-chart-btn" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9); font-size:13px;" onclick="window.__revealNextRectifyRound()">➕ 展开下一组题，继续缩小范围</button>`);
    } else {
      btns.push(`<button type="button" class="save-chart-btn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); font-size:12.2px;" onclick="window.__applyRectifiedChart(${top.c.clockHour}, ${top.c.clockMinute}, '${top.c.shichenName}')">按目前领先的【${top.c.shichenName}盘】先用着（随时可改）</button>`);
    }
    btns.push(`<button type="button" class="save-chart-btn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); font-size:12.2px;" onclick="window.__sendRectifyToAI()">💬 把已答内容交给 AI，让它继续追问</button>`);

    verdictBox.style.display = "block";
    verdictBox.innerHTML = `
      <div style="font-size:14px; font-weight:700; color:${tone}; margin-bottom:6px;">
        🎯 ${headline}（已答 ${answeredCount}/${visibleCount} 题）
      </div>
      <div style="margin-bottom:8px; padding:7px 10px; background:rgba(255,255,255,0.05); border-radius:6px;">
        ${breakdown}
      </div>
      <div style="color:#e2e8f0; margin-bottom:10px; font-size:12.5px; line-height:1.6;">${detail}</div>
      <div style="display:flex; flex-direction:column; gap:8px;">${btns.join("")}</div>
    `;
  }

  window.__applyRectifiedChart = function(clockH, clockM, shichenName) {
    closeModal("modal-rectify");
    window.__lockCandidateShichen(clockH, clockM, shichenName);
  };

  window.__sendRectifyToAI = function() {
    if (!currentRectifyQuiz) return;
    closeModal("modal-rectify");
    document.getElementById("chart-drawer")?.classList.remove("open");

    const candDesc = currentRectifyQuiz.candidates.map((c, i) =>
      `候选盘${String.fromCharCode(65 + i)}：【${c.shichenName}】（时柱${c.hourPillar}，紫微命宫${c.mingStars}，夫妻宫${c.spouseStars}）`
    ).join(" vs ");

    const answered = [], unsure = [], skipped = [];
    rectifyFlat.forEach((item, gIdx) => {
      if (item.round >= rectifyVisibleRounds) return;
      const q = item.q;
      const cIdx = rectifyAnswers[gIdx];
      if (cIdx === undefined) { skipped.push(`· ${q.dimension}：未作答`); return; }
      if (cIdx < 0) { unsure.push(`· ${q.dimension}：我分辨不出来，两边都像`); return; }
      const opt = q.options.find(o => o.candIdx === cIdx);
      answered.push(`· ${q.dimension}：我选了「${opt ? opt.label : "（选项缺失）"}」`);
    });

    const userChoices = [
      answered.length ? "【我能确定的部分】\n" + answered.join("\n") : "",
      unsure.length   ? "\n\n【我分辨不出来的部分 —— 这些正是需要你追问的地方】\n" + unsure.join("\n") : "",
      skipped.length  ? "\n\n【我还没答的部分】\n" + skipped.join("\n") : ""
    ].filter(Boolean).join("");

    const prompt = `我的出生时间只知道一个大致区间，现在在这几个时辰盘之间还没定下来：\n${candDesc}\n\n以下是我在【精准定盘】问卷里的真实回答：\n${userChoices}\n\n请严格按下面三步来，不要跳步，也不要直接附和问卷的打分结果：\n\n第一步：先判断现有信息够不够定盘。如果不够，就直接说不够，不要硬给结论。\n\n第二步：针对我「分辨不出来」的维度，以及这几个候选盘差异最大的地方，向我提 2–3 个追问。追问必须满足：只能用客观事实回答（某年具体发生过什么事、身体某个部位是否真的出过问题、某段时间住在哪里），不要问"你觉得自己是不是比较内向"这类性格感受题——那种题我会不自觉顺着你的话选。\n\n第三步：等我回答完你的追问之后，再收敛结论。如果到那时仍然分不开，请明确告诉我分不开，并说明还需要什么信息才能分开。不要为了给个答案而勉强下判断。`;
    send(prompt);
  };

  function updateChart(p, persist = true) {
    const chart = AstrologyCore.analyzeFullNatalChart(p);
    state.userChart = chart;
    if (persist) localStorage.setItem("starbook_user_profile", JSON.stringify(p));

    const g = chart.profile.gender === "female" ? "坤造" : "乾造";
    const sp = chart.ziwei.spousePalace;
    const b = chart.bazi;

    const mini = document.getElementById("mini-profile-text");
    if (mini) mini.innerHTML = `${g} · 日元 <b>${b.dayMaster}${b.wuxing}</b><br>夫妻宫 <b>${b.marriageBranch}</b> 坐 <b>${sp.primaryStar}</b>`;

    const tag = document.getElementById("chart-context-tag");
    if (tag) tag.textContent = `✦ ${g} · 日元${b.dayMaster}${b.wuxing} · 夫妻宫${b.marriageBranch}坐${sp.primaryStar}（${sp.sihua}）`;

    const gs = document.getElementById("drawer-gender");
    const dd = document.getElementById("drawer-birthdate");
    const hh = document.getElementById("drawer-hour");
    const bt = document.getElementById("drawer-birthtime");
    const ct = document.getElementById("drawer-city");
    const st = document.getElementById("drawer-status");
    if (gs) gs.value = chart.profile.gender;
    if (dd) dd.value = `${chart.profile.year}-${String(chart.profile.month).padStart(2, "0")}-${String(chart.profile.day).padStart(2, "0")}`;
    if (hh) hh.value = chart.profile.hour;
    const tm = document.getElementById("drawer-time-mode");
    const rs = document.getElementById("drawer-range-start");
    const re = document.getElementById("drawer-range-end");
    const exactWrap = document.getElementById("drawer-exact-wrap");
    const intervalWrap = document.getElementById("drawer-interval-wrap");
    const tMode = chart.profile.timeMode || "interval";
    if (tm) tm.value = tMode;
    if (exactWrap) exactWrap.style.display = tMode === "exact" ? "block" : "none";
    if (intervalWrap) intervalWrap.style.display = tMode === "interval" ? "block" : "none";
    if (rs && chart.profile.rangeStart) rs.value = chart.profile.rangeStart;
    if (re && chart.profile.rangeEnd) re.value = chart.profile.rangeEnd;
    if (bt) bt.value = `${String(chart.profile.hour).padStart(2, "0")}:${String(chart.profile.minute || 0).padStart(2, "0")}`;
    if (ct) ct.value = chart.profile.city || "默认 (东经120°标准时)";
    if (st) st.value = chart.profile.status;
    updateTstPreview(chart.profile);

    const zw = document.getElementById("drawer-ziwei-info");
    if (zw) zw.innerHTML = `
      <p><b>主星：</b><span style="color:var(--accent);font-weight:700;">${sp.primaryStar}</span>（${sp.nature}）</p>
      <p><b>四化：</b><span style="color:var(--rose);">${sp.sihua}</span> — ${sp.sihuaDesc}</p>
      <p><b>伴侣特征：</b>${sp.detail.mateTrait}</p>
      <p><b>相处优势：</b>${sp.detail.pros}</p>
      <p><b>需留意：</b>${sp.detail.cons}</p>`;

    const bz = document.getElementById("drawer-bazi-info");
    if (bz) bz.innerHTML = `
      <p><b>四柱：</b>${b.yearPillar} · ${b.monthPillar} · <span style="color:var(--accent);font-weight:700;">${b.dayPillar}</span> · ${b.hourPillar}</p>
      <p><b>农历：</b>${chart.lunar.lYear}年${chart.lunar.lMonthLabel}${chart.lunar.lDayLabel}（节气月：${b.solarTerm}）</p>
      <p><b>日元：</b>${b.dayMaster}（${b.wuxing}），婚姻宫【${b.marriageBranch}】</p>
      <p><b>配偶星：</b>${b.tenGodSpouse}</p>
      <p><b>神煞：</b>${b.shensha.join("、")}</p>`;

    renderZiweiGrid(chart);
    renderDynamicPrompts(chart);
  }

  function getPalaceStarLabel(chart, palaceName) {
    if (!chart || !chart.ziwei || !chart.ziwei.palaces) return "主星";
    const p = chart.ziwei.palaces.find(x => x.name === palaceName);
    if (!p) return "主星";
    let stars = (p.mainStars || []).map(s => s.name).join("·");
    if (!stars) {
      const opp = chart.ziwei.palaces[(p.index + 6) % 12];
      stars = opp ? "借" + (opp.mainStars || []).map(s => s.name).join("·") : "主星";
    }
    return stars || "主星";
  }

  function renderDynamicPrompts(chart) {
    if (!chart) return;
    const g = chart.profile.gender === "female" ? "坤造" : "乾造";
    const b = chart.bazi;
    const sp = chart.ziwei.spousePalace;
    const mingStar = getPalaceStarLabel(chart, "命宫");
    const spouseStar = getPalaceStarLabel(chart, "夫妻宫");
    const careerStar = getPalaceStarLabel(chart, "官禄宫");
    const wealthStar = getPalaceStarLabel(chart, "财帛宫");
    const fudeStar = getPalaceStarLabel(chart, "福德宫");
    const dmLabel = `${b.dayMaster}${b.wuxing}`;
    const marriageBranch = b.marriageBranch;
    const mode = state.kbMode === "bazi" ? "bazi" : "ziwei";

    const mini = document.getElementById("mini-profile-text");
    if (mini) mini.innerHTML = `${g} · 日元 <b>${dmLabel}</b> · 命宫 <b>${mingStar}</b><br>夫妻宫 <b>${sp.primaryStar}</b> · 官禄宫 <b>${careerStar}</b>`;

    const tag = document.getElementById("chart-context-tag");
    if (tag) {
      tag.textContent = mode === "ziwei"
        ? `🔮 你的紫微盘：${g} · 命宫【${mingStar}】 · 夫妻宫【${sp.primaryStar}(${sp.sihua || "无四化"})】 · 福德宫【${fudeStar}】`
        : `📜 你的八字盘：${g} · 四柱【${b.yearPillar} ${b.monthPillar} ${b.dayPillar} ${b.hourPillar}】 · 日元【${dmLabel}】 · 婚姻宫【${marriageBranch}】`;
    }

    // 获取当前真实天文历法与四柱干支时间基准
    const t = (window.ChatEngine && window.ChatEngine.getCurrentTimeAnchor)
      ? window.ChatEngine.getCurrentTimeAnchor()
      : { solarDateOnly: "2026年9月17日", lunarStr: "农历八月初七", yPillar: "丙午", mPillar: "丁酉", dPillar: "甲午", termName: "白露" };
    const timeBadgeStr = `🕒 当前历法：<strong>${t.solarDateOnly}（${t.lunarStr} · ${t.yPillar}年${t.mPillar}月${t.dPillar}日）</strong>`;

    // 更新顶部知识库与本人实盘锁定状态栏
    const lockBadge = document.getElementById("kb-lock-badge");
    const lockSummary = document.getElementById("kb-lock-chart-summary");
    const tst = chart.profile.trueSolarTime || {};
    const cityTag = tst.isCalibrated ? `📍 ${tst.city}(真太阳时${tst.trueTimeStr})` : `📍 东经120°标准时`;
    if (mode === "ziwei") {
      if (lockBadge) lockBadge.innerHTML = `🔮 <strong>紫微斗数</strong> · 十二宫已排定`;
      if (lockSummary) lockSummary.innerHTML = `${timeBadgeStr} ｜ ${cityTag} · ${g} · 命宫【${mingStar}】 · 夫妻【${spouseStar}】`;
    } else {
      if (lockBadge) lockBadge.innerHTML = `📜 <strong>四柱八字</strong> · 四柱已定局`;
      if (lockSummary) lockSummary.innerHTML = `${timeBadgeStr} ｜ ${cityTag} · ${g} · 四柱【${b.yearPillar} ${b.monthPillar} ${b.dayPillar} ${b.hourPillar}】`;
    }

    // 更新当前聊天窗口欢迎语与本人专属三张卡片
    const greetIcon = document.getElementById("greeting-icon");
    const greetTitle = document.getElementById("greeting-title");
    const greetDesc = document.getElementById("greeting-desc");

    let cards = [];
    if (mode === "ziwei") {
      if (greetIcon) greetIcon.textContent = "🔮";
      if (greetTitle) greetTitle.textContent = "紫微斗数 · 一语点到";
      if (greetDesc) greetDesc.innerHTML = `<div>🕒 <strong>今日 公历 ${t.solarDateOnly} · ${t.lunarStr} · ${t.yPillar}年 ${t.mPillar}月 ${t.dPillar}日</strong></div><div style="margin-top:4px;">已按你的出生时刻排定十二宫。下面三个是从你盘里挑出来的切入点，也可以直接问。</div>`;

      cards = [
        {
          icon: "💫",
          title: `本人夫妻宫详批：坐【${spouseStar}】（对宫【${careerStar}】）`,
          sub: `紫微星曜与四化推演 · 直接分析正缘画像、相处核心矛盾与动婚时间`,
          prompt: `结合我本人紫微命盘中夫妻宫坐【${spouseStar}】及对宫【${careerStar}】，请用大白话直接分析：我的正缘伴侣是什么性格画像？两人相处最大的雷区在哪？哪一年流年动婚最稳？`
        },
        {
          icon: "🪞",
          title: `本人命宫与福德宫：命宫【${mingStar}】× 福德【${fudeStar}】`,
          sub: `内在心性与情绪能量剖析 · 拆解情感依恋模式与精神内耗根源`,
          prompt: `结合我本人紫微命宫坐【${mingStar}】与福德宫【${fudeStar}】，请用大白话直接分析：我在感情和人际里为什么容易陷入精神内耗？我性格里的最大优势与弱点是什么？`
        },
        {
          icon: "🏛️",
          title: `本人官禄与财帛宫：官禄【${careerStar}】× 财帛【${wealthStar}】`,
          sub: `三方四正事业格局 · 紫微视角断职场角色定位与搞钱天赋`,
          prompt: `结合我本人紫微官禄宫【${careerStar}】与财帛宫【${wealthStar}】，请用大白话直接分析：我最适合靠什么角色和模式发展事业财运？结合当前时间（${t.solarDateOnly}），今年接下来和明年职场要注意什么？`
        }
      ];
    } else {
      if (greetIcon) greetIcon.textContent = "📜";
      if (greetTitle) greetTitle.textContent = "四柱八字 · 一语点到";
      if (greetDesc) greetDesc.innerHTML = `<div>🕒 <strong>今日 公历 ${t.solarDateOnly} · ${t.lunarStr} · ${t.yPillar}年 ${t.mPillar}月 ${t.dPillar}日</strong></div><div style="margin-top:4px;">已按你的出生时刻排定四柱。下面三个是从你盘里挑出来的切入点，也可以直接问。</div>`;

      cards = [
        {
          icon: "🔥",
          title: `本人流年与近期运势总断：四柱【${b.yearPillar} ${b.monthPillar} ${b.dayPillar} ${b.hourPillar}】`,
          sub: `子平岁运生克推演 · 直接分析日元【${dmLabel}】当下月份与今年秋冬、明年的吉凶起伏`,
          prompt: `基于我本人的八字四柱【${b.yearPillar} ${b.monthPillar} ${b.dayPillar} ${b.hourPillar}】（日元${dmLabel}），结合当前时间（${t.solarDateOnly} · ${t.lunarStr} · ${t.yPillar}年${t.mPillar}月），请用大白话直接分析：今年接下来秋冬几个月以及明年对我到底是吉是凶？哪几个月进财、哪几个月要防风险？`
        },
        {
          icon: "⚖️",
          title: `本人命局五行喜忌与用神：【${dmLabel}】生于【${b.monthPillar}】月（${b.solarTerm}后）`,
          sub: `寒暖燥湿与五行平衡 · 查明最喜用神五行与日常事业生活发力方向`,
          prompt: `基于我本人八字【日元${dmLabel}生于${b.solarTerm}后（${b.monthPillar}月）】，请用大白话直接分析：我命局里最喜的“用神”是什么五行？最忌什么五行？平时工作方位、行业选择与处事习惯该怎么配合喜用神？`
        },
        {
          icon: "💍",
          title: `本人八字婚姻宫与财官格局：日支【${marriageBranch}】× 配偶星【${b.tenGodSpouse}】`,
          sub: `六亲十神与大运走势 · 子平法断婚姻相处模式与人生财富上升期`,
          prompt: `基于我本人八字日支婚姻宫【${marriageBranch}】与配偶星【${b.tenGodSpouse}】，请用大白话直接分析：从八字子平法看，我的婚姻互动模式与伴侣助力如何？人生哪一步大运是我财富上升的黄金期？`
        }
      ];
    }

    const gridEl = document.querySelector(".starter-prompts-grid");
    if (gridEl) {
      gridEl.innerHTML = cards.map(c => `
        <div class="prompt-card" data-prompt="${escapeHtml(c.prompt)}">
          <div class="prompt-card-icon">${c.icon}</div>
          <div class="prompt-card-title">${escapeHtml(c.title)}</div>
          <div class="prompt-card-sub">${escapeHtml(c.sub)}</div>
        </div>
      `).join("");
    }
  }

  /* ---------------- 紫微十二宫盘渲染（P0 新增） ---------------- */


  function renderZiweiGrid(chart) {
    const box = document.getElementById("ziwei-grid");
    if (!box || !chart.ziwei || !chart.ziwei.palaces) return;
    const palaces = chart.ziwei.palaces;

    function cell(spec) {
      const [zhiIdx, row, col] = spec;
      const p = palaces[zhiIdx];
      const cls = ["zw-cell"];
      if (p.name === "命宫") cls.push("is-ming");
      if (p.name === "夫妻宫") cls.push("is-spouse");

      const mains = p.mainStars.length
        ? p.mainStars.map(s =>
            `${escapeHtml(s.name)}<span class="zw-bright">${escapeHtml(s.brightness)}</span>` +
            (s.sihua ? `<span class="zw-hua ${HUA_CLASS[s.sihua]}">${escapeHtml(s.sihua)}</span>` : "")
          ).join(" ")
        : `<span style="opacity:.4;font-weight:400;">空宫</span>`;

      const auxes = p.auxStars.map(s =>
        escapeHtml(s.name) + (s.sihua ? `<span class="zw-hua ${HUA_CLASS[s.sihua]}">${escapeHtml(s.sihua)}</span>` : "")
      ).join(" ");
      const peaches = p.peachStars.map(s => escapeHtml(s.name)).join(" ");

      const badges = (p.isMing ? '<span class="zw-badge">命</span>' : "") +
                     (p.isShen ? '<span class="zw-badge">身</span>' : "");

      return `<div class="${cls.join(" ")}" style="grid-row:${row};grid-column:${col};">
        <div class="zw-main">${mains}</div>
        ${auxes ? `<div class="zw-aux">${auxes}</div>` : ""}
        ${peaches ? `<div class="zw-peach">${peaches}</div>` : ""}
        <div class="zw-foot">
          <span class="zw-name">${escapeHtml(p.name)}${badges}</span>
          <span class="zw-gz">${escapeHtml(p.gan + p.branch)}<br><span class="zw-dx">${p.daxian ? p.daxian.start + "-" + p.daxian.end : ""}</span></span>
        </div>
      </div>`;
    }

    const sy = chart.ziwei.sihuaYear || {};
    const center = `<div class="zw-center">
      <div class="zw-c-title">${chart.profile.gender === "female" ? "坤造" : "乾造"} · ${escapeHtml(chart.ziwei.juName || "")}</div>
      <div>公历 ${chart.profile.year}-${String(chart.profile.month).padStart(2,"0")}-${String(chart.profile.day).padStart(2,"0")} ${String(chart.profile.hour).padStart(2,"0")}:00</div>
      <div>农历 ${escapeHtml(chart.lunar.lMonthLabel + chart.lunar.lDayLabel)}</div>
      <div>四柱 <b>${escapeHtml(chart.bazi.yearPillar + " " + chart.bazi.monthPillar + " " + chart.bazi.dayPillar + " " + chart.bazi.hourPillar)}</b></div>
      <div>纳音 ${escapeHtml(chart.ziwei.nayin || "")}</div>
      <div>生年四化（${escapeHtml(sy.gan || "")}）<br>
        <b>${escapeHtml(sy["禄"] || "")}</b>禄 · <b>${escapeHtml(sy["权"] || "")}</b>权 ·
        <b>${escapeHtml(sy["科"] || "")}</b>科 · <b>${escapeHtml(sy["忌"] || "")}</b>忌</div>
    </div>`;

    box.innerHTML = GRID_LAYOUT.map(cell).join("") + center;

    const wbox = document.getElementById("ziwei-warnings");
    if (wbox) {
      wbox.innerHTML = (chart.warnings || []).map(w => `<div>⚠️ ${escapeHtml(w)}</div>`).join("");
    }
  }

  /* ---------------- 会话 ---------------- */
  function initSessions() {
    try {
      const s = localStorage.getItem("starbook_sessions");
      if (s) {
        state.sessions = JSON.parse(s);
        state.sessions.forEach(sess => {
          if (!sess.ziweiMessages) sess.ziweiMessages = Array.isArray(sess.messages) ? [...sess.messages] : [];
          if (!sess.baziMessages) sess.baziMessages = [];
          sess.ziweiMessages.forEach(m => { if (m.streaming) m.streaming = false; });
          sess.baziMessages.forEach(m => { if (m.streaming) m.streaming = false; });
        });
        saveSessions();
      }
    } catch (e) { state.sessions = []; }

    if (!state.sessions.length) newSession("命理推演档案", false);
    switchSession(state.sessions[0].id);
    renderSessions();
  }

  function newSession(title = "命理推演档案", go = true) {
    const s = { id: "s" + Date.now(), title, ziweiMessages: [], baziMessages: [] };
    state.sessions.unshift(s);
    saveSessions(); renderSessions();
    if (go) switchSession(s.id);
  }

  function switchSession(id) {
    state.currentSessionId = id;
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    document.getElementById("chat-title-text").textContent = s.title;
    renderSessions();
    renderMessages(getRoomMessages(s, state.kbMode));
    toggleMobileSidebar(false);
  }

  function saveSessions() {
    try { localStorage.setItem("starbook_sessions", JSON.stringify(state.sessions)); } catch (e) {}
  }

  function renderSessions() {
    const el = document.getElementById("session-items-list");
    if (!el) return;
    el.innerHTML = state.sessions.map(s => `
      <div class="session-item ${s.id === state.currentSessionId ? "active" : ""}" onclick="window.__switchSession('${s.id}')">
        <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.title)}</span>
        <button class="session-delete-btn" onclick="window.__delSession(event,'${s.id}')">×</button>
      </div>`).join("");
  }

  window.__switchSession = switchSession;
  window.__delSession = (e, id) => {
    e.stopPropagation();
    state.sessions = state.sessions.filter(s => s.id !== id);
    saveSessions();
    if (!state.sessions.length) newSession("新的推演", true);
    else if (state.currentSessionId === id) switchSession(state.sessions[0].id);
    else renderSessions();
  };

  /* ---------------- 消息渲染 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function renderMessages(msgs) {
    const list = document.getElementById("messages-list");
    const greet = document.getElementById("greeting-card");
    if (!list) return;
    if (!msgs.length) { greet.style.display = "block"; list.innerHTML = ""; }
    else { greet.style.display = "none"; list.innerHTML = msgs.map(msgHtml).join(""); }
    scrollBottom();
  }

  function renderReasoningBoxHtml(m) {
    const steps = m.reasoningSteps || [];
    if (!steps.length && !m.streaming) return "";
    const mode = m.kbMode || state.kbMode || "ziwei";
    const kbName = mode === "bazi"
      ? "《穷通宝鉴》《渊海子平》"
      : (mode === "ziwei" ? "《紫微斗数全书》" : "《紫微斗数全书》与《穷通宝鉴》");

    const activeIdx = m.activeStepIdx !== undefined ? m.activeStepIdx : (m.streaming ? 0 : steps.length);
    const stepsHtml = steps.map((st, idx) => {
      const stateCls = m.streaming
        ? (idx < activeIdx ? "done" : (idx === activeIdx ? "active" : ""))
        : "done";
      return `<div class="reasoning-step ${stateCls}">
        <span class="reasoning-step-badge">${escapeHtml(st.badge)}</span>
        <div style="flex:1;">
          <div>${escapeHtml(st.text)}</div>
          ${st.quote ? `<span class="reasoning-step-quote">${escapeHtml(st.quote)}</span>` : ""}
        </div>
      </div>`;
    }).join("");

    const curBadge = steps[Math.min(activeIdx, Math.max(0, steps.length - 1))]?.badge || "准备中";
    const summaryTitle = m.streaming
      ? `<span id="active-reasoning-title">⏳ 正在执行命理推演与古籍检索（${curBadge}）…</span>`
      : `<span>🧭 命理推演与典籍检索过程（已调取 ${kbName} 原典依据）</span>`;

    return `<details class="reasoning-box" ${m.streaming ? 'open id="active-reasoning-box"' : 'open'}>
      <summary>
        ${summaryTitle}
        <span style="font-size:11px;opacity:0.75;">${m.streaming ? "推演中…" : "点击收起/展开 ▾"}</span>
      </summary>
      <div class="reasoning-steps-list" ${m.streaming ? 'id="active-reasoning-list"' : ""}>
        ${stepsHtml}
      </div>
    </details>`;
  }

  function msgHtml(m) {
    const ai = m.role === "ai";
    let tarot = "";
    if (m.tarotWidget) {
      const { card, isReversed } = m.tarotWidget;
      tarot = `<div class="chat-tarot-card-widget">
        <div class="chat-tarot-icon">${card.icon || "🎴"}</div>
        <div class="chat-tarot-info">
          <h4>${card.name} · ${isReversed ? "逆位" : "正位"}</h4>
          <p>${(isReversed ? card.keywords.reversed : card.keywords.upright).join(" · ")}</p>
        </div></div>`;
    }
    let follow = "";
    if (ai && !m.streaming && m.followups && m.followups.length) {
      follow = `<div class="followup-row">` +
        m.followups.map(f => `<button class="followup-chip" onclick="window.__ask(this.dataset.q)" data-q="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join("") +
        `</div>`;
    }

    if (!ai) {
      return `<div class="message-row user">
        <div class="message-avatar">✦</div>
        <div class="message-bubble">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div>
      </div>`;
    }

    const reasoningHtml = renderReasoningBoxHtml(m);
    const bodyHtml = m.streaming
      ? `<div class="ai-thinking-placeholder" style="padding:12px 6px; color:var(--text-dim); font-size:13px; display:flex; align-items:center; gap:10px;">
           <span class="dot-pulse"></span><span class="dot-pulse"></span><span class="dot-pulse"></span>
           <span id="active-progress-text">正在结合排盘干支与古籍原典凝练完整断语，请稍候…</span>
         </div>`
      : `<div class="ai-final-answer">${md(m.content)}</div>`;

    return `<div class="message-row ai">
      <div class="message-avatar">✦</div>
      <div class="message-bubble">
        ${reasoningHtml}
        ${bodyHtml}
        ${tarot}
        ${!m.streaming ? `<div class="message-actions">
            <button class="msg-action-btn" onclick="window.__copy(this)">复制</button>
          </div>` : ""}
        ${follow}
      </div></div>`;
  }

  // 轻量 markdown
  function md(t) {
    if (!t) return "";
    let h = escapeHtml(t);
    h = h.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    h = h.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
    h = h.replace(/^---$/gm, "<hr>");
    h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\*(.+?)\*/g, "<em>$1</em>");
    h = h.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
    h = h.replace(/<br>(<h3>|<blockquote>|<hr>)/g, "$1");
    h = h.replace(/(<\/h3>|<\/blockquote>|<hr>)<br>/g, "$1");
    return h;
  }

  function scrollBottom(force = false) {
    const el = document.getElementById("chat-scroll-area");
    if (!el) return;
    const isNearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 160;
    if (force || isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  /* ---------------- 发送（思考匣逐步推演 + 整段答案优雅浮现） ---------------- */
  window.__ask = (q) => send(q);

  async function send(raw) {
    const input = document.getElementById("chat-input");
    const text = (raw !== undefined && raw !== null ? raw : input.value).trim();
    if (!text) return;

    sound.send();
    if (raw === undefined || raw === null) { input.value = ""; input.style.height = "auto"; }

    const s = state.sessions.find(x => x.id === state.currentSessionId);
    if (!s) return;
    const roomMsgs = getRoomMessages(s, state.kbMode);

    roomMsgs.push({ role: "user", content: text });
    if (roomMsgs.length === 1 && s.title === "命理推演档案") {
      s.title = (state.kbMode === "bazi" ? "[八字] " : "[紫微] ") + text.slice(0, 12) + (text.length > 12 ? "…" : "");
      document.getElementById("chat-title-text").textContent = s.title;
      renderSessions();
    }

    const ind = document.getElementById("ai-thinking-indicator");
    if (ind) ind.style.display = "none";

    if (state.settings.apiKey && state.settings.apiKey.trim() && (!state.settings.provider || state.settings.provider === "builtin")) {
      state.settings.provider = "deepseek";
      const provSel = document.getElementById("settings-provider");
      if (provSel) provSel.value = "deepseek";
      localStorage.setItem("starbook_settings", JSON.stringify(state.settings));
      updateEngineBadge();
    }
    state.settings.kbMode = state.kbMode || "ziwei";
    const useLLM = Boolean(state.settings.apiKey && state.settings.apiKey.trim()) && state.settings.provider !== "builtin";

    // 生成四步命理思考过程
    const reasoningSteps = ChatEngine.buildReasoningSteps
      ? ChatEngine.buildReasoningSteps(text, state.userChart, state.kbMode)
      : [];

    const aiMsg = {
      role: "ai",
      content: "",
      streaming: true,
      kbMode: state.kbMode,
      activeStepIdx: 0,
      reasoningSteps
    };
    roomMsgs.push(aiMsg);
    renderMessages(roomMsgs);
    scrollBottom(true);

    const startTime = Date.now();
    // 定时器：每 550ms 点亮下一步思考过程，呈现严谨的推演仪式感
    const stepTimer = setInterval(() => {
      if (aiMsg.activeStepIdx < 3) {
        aiMsg.activeStepIdx++;
        const listEl = document.getElementById("active-reasoning-list");
        const titleEl = document.getElementById("active-reasoning-title");
        if (listEl) {
          const stepEls = listEl.querySelectorAll(".reasoning-step");
          stepEls.forEach((el, idx) => {
            el.classList.remove("active", "done");
            if (idx < aiMsg.activeStepIdx) el.classList.add("done");
            else if (idx === aiMsg.activeStepIdx) el.classList.add("active");
          });
        }
        if (titleEl && reasoningSteps[aiMsg.activeStepIdx]) {
          titleEl.textContent = `⏳ 正在执行命理推演与古籍检索（${reasoningSteps[aiMsg.activeStepIdx].badge}）…`;
        }
        scrollBottom(false);
      }
    }, 550);

    if (useLLM) {
      /* ---------- 大模型：后台静默收集 + 思考匣进度更新 + 整段一次性优雅浮现 ---------- */
      const history = roomMsgs.slice(0, -2); // 不含刚push的用户消息和ai占位消息
      try {
        const full = await ChatEngine.callLiveAPIStream(
          text, state.userChart, history, state.settings,
          (delta, soFar) => {
            const progEl = document.getElementById("active-progress-text");
            if (progEl) {
              progEl.textContent = `正在结合排盘干支与古籍原典凝练完整断语（已推演 ${soFar.length} 字），即将整段呈现…`;
            }
          }
        );
        clearInterval(stepTimer);
        // 确保思考过程至少展示满 1.6 秒，让推演步骤完整呈现
        const elapsed = Date.now() - startTime;
        if (elapsed < 1600) {
          await new Promise(r => setTimeout(r, 1600 - elapsed));
        }
        aiMsg.content = full;
        aiMsg.streaming = false;
        aiMsg.activeStepIdx = 4;
        aiMsg.followups = ChatEngine.followupsFor ? ChatEngine.followupsFor(text) : null;
        saveSessions();
        renderMessages(roomMsgs);
        scrollBottom(false);
        sound.chime();
      } catch (err) {
        clearInterval(stepTimer);
        const fb = ChatEngine.composeAnswer(text, state.userChart, history, state.kbMode);
        aiMsg.streaming = false;
        aiMsg.activeStepIdx = 4;
        aiMsg.content =
          `> ⚠️ **AI 接口调用失败**：${err.message || "网络或接口异常"}\n` +
          `> 已自动切换为内置推演引擎。请检查右上角「设置」中的 API Key 与余额。\n\n---\n\n` +
          fb.text;
        aiMsg.tarotWidget = fb.tarotWidget || null;
        aiMsg.followups = fb.followups || null;
        saveSessions();
        renderMessages(roomMsgs);
        scrollBottom(false);
      }
      return;
    }

    /* ---------- 内置引擎：思考匣推演 + 整段一次性呈现 ---------- */
    try {
      const res = await ChatEngine.generateChatResponse(text, state.userChart, roomMsgs.slice(0, -1), state.settings);
      clearInterval(stepTimer);
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        await new Promise(r => setTimeout(r, 1500 - elapsed));
      }
      aiMsg.content = res.text;
      aiMsg.streaming = false;
      aiMsg.activeStepIdx = 4;
      aiMsg.tarotWidget = res.tarotWidget || null;
      aiMsg.followups = res.followups || null;
      if (res.reasoningSteps) aiMsg.reasoningSteps = res.reasoningSteps;
      saveSessions();
      renderMessages(roomMsgs);
      scrollBottom(false);
      sound.chime();
    } catch (err) {
      clearInterval(stepTimer);
      aiMsg.streaming = false;
      aiMsg.content = "推演过程出现异常，请稍后重试。";
      renderMessages(roomMsgs);
    }
  }

  /* ---------------- 事件 ---------------- */
  function bindEvents() {
    document.getElementById("kb-entrance-bar")?.addEventListener("click", e => {
      const btn = e.target.closest(".kb-tab");
      if (btn && btn.dataset.kbMode) {
        setKbMode(btn.dataset.kbMode, true);
        sound.chime();
      }
    });
    const input = document.getElementById("chat-input");
    document.getElementById("btn-send-msg")?.addEventListener("click", () => send());
    input?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input?.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 160) + "px";
    });

    document.getElementById("btn-new-chat")?.addEventListener("click", () => newSession());
    document.querySelector(".starter-prompts-grid")?.addEventListener("click", e => {
      const card = e.target.closest(".prompt-card");
      if (card && card.dataset.prompt) send(card.dataset.prompt);
    });
    document.querySelector(".quick-tools-row")?.addEventListener("click", e => {
      const chip = e.target.closest(".tool-chip");
      if (chip && chip.dataset.quick) send(chip.dataset.quick);
    });

    const drawer = document.getElementById("chart-drawer");
    // 打开命盘抽屉时，顺手收起手机端的侧边抽屉，避免两层叠在一起
    const open = () => { drawer?.classList.add("open"); toggleMobileSidebar(false); };
    const close = () => drawer?.classList.remove("open");
    document.getElementById("btn-open-drawer")?.addEventListener("click", open);
    document.getElementById("btn-open-rectify")?.addEventListener("click", () => {
      toggleMobileSidebar(false);
      window.__openRectifyModal();
    });
    document.getElementById("btn-mini-chart-card")?.addEventListener("click", open);
    document.getElementById("btn-modify-chart-trigger")?.addEventListener("click", open);
    document.getElementById("btn-close-drawer")?.addEventListener("click", close);

    const triggerLiveTst = () => {
      const d = document.getElementById("drawer-birthdate")?.value;
      if (!d) return;
      const [y, m, dd] = d.split("-").map(Number);
      const tMode = document.getElementById("drawer-time-mode")?.value || "interval";
      const exactWrap = document.getElementById("drawer-exact-wrap");
      const intervalWrap = document.getElementById("drawer-interval-wrap");
      if (exactWrap) exactWrap.style.display = tMode === "exact" ? "block" : "none";
      if (intervalWrap) intervalWrap.style.display = tMode === "interval" ? "block" : "none";

      const bt = document.getElementById("drawer-birthtime")?.value || "10:30";
      const [h, min] = bt.split(":").map(Number);
      const rStart = document.getElementById("drawer-range-start")?.value || "09:00";
      const rEnd   = document.getElementById("drawer-range-end")?.value || "12:00";
      const city = document.getElementById("drawer-city")?.value || "默认 (东经120°标准时)";
      updateTstPreview({
        year: y, month: m, day: dd,
        hour: isNaN(h) ? 10 : h, minute: isNaN(min) ? 30 : min,
        timeMode: tMode, rangeStart: rStart, rangeEnd: rEnd, city
      });
    };

    ["drawer-birthdate", "drawer-birthtime", "drawer-city", "drawer-time-mode", "drawer-range-start", "drawer-range-end"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", triggerLiveTst);
      document.getElementById(id)?.addEventListener("input", triggerLiveTst);
    });

    document.getElementById("btn-save-chart")?.addEventListener("click", () => {
      const d = document.getElementById("drawer-birthdate").value;
      if (!d) { alert("请选择出生日期"); return; }
      const [y, m, dd] = d.split("-").map(Number);
      const tMode = document.getElementById("drawer-time-mode")?.value || "interval";
      const city = document.getElementById("drawer-city")?.value || "默认 (东经120°标准时)";
      const gender = document.getElementById("drawer-gender").value;
      const status = document.getElementById("drawer-status").value;

      if (tMode === "interval" && window.AstrologyCore && window.AstrologyCore.analyzeTimeInterval) {
        const rStart = document.getElementById("drawer-range-start")?.value || "09:00";
        const rEnd   = document.getElementById("drawer-range-end")?.value || "12:00";
        const [sh, sm] = rStart.split(":").map(Number);
        const [eh, em] = rEnd.split(":").map(Number);
        const res = window.AstrologyCore.analyzeTimeInterval({
          year: y, month: m, day: dd,
          startHour: isNaN(sh) ? 9 : sh, startMinute: isNaN(sm) ? 0 : sm,
          endHour: isNaN(eh) ? 12 : eh, endMinute: isNaN(em) ? 0 : em,
          city, gender, status
        });
        const best = res.candidates[0] || { clockHour: 10, clockMinute: 30 };
        updateChart({
          year: y, month: m, day: dd,
          hour: best.clockHour,
          minute: best.clockMinute,
          timeMode: "interval",
          rangeStart: rStart,
          rangeEnd: rEnd,
          intervalCandidates: res.candidates.map(c => ({
            shichenName: c.shichenName, prob: c.prob, hourPillar: c.hourPillar,
            mingStars: c.mingStars, spouseStars: c.spouseStars, traitText: c.traitText
          })),
          city, gender, status
        }, true);
      } else {
        const bt = document.getElementById("drawer-birthtime")?.value || "10:30";
        const [h, min] = bt.split(":").map(Number);
        updateChart({
          year: y, month: m, day: dd,
          hour: isNaN(h) ? 10 : h,
          minute: isNaN(min) ? 30 : min,
          timeMode: "exact",
          intervalCandidates: null,
          city, gender, status
        }, true);
      }
      sound.chime();
      close();
    });

    document.getElementById("btn-quick-tarot")?.addEventListener("click", () =>
      send("帮我抽一张塔罗牌，看看我当下这段感情的处境和该注意什么。"));

    document.getElementById("btn-export-chat")?.addEventListener("click", exportPoster);
    document.getElementById("btn-mobile-menu")?.addEventListener("click", () => toggleMobileSidebar());
    document.getElementById("sidebar-backdrop")?.addEventListener("click", () => toggleMobileSidebar(false));

    document.getElementById("btn-theme-toggle")?.addEventListener("click", () =>
      applyTheme(state.theme === "light" ? "dark" : "light"));

    document.getElementById("btn-sound-toggle")?.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      document.getElementById("sound-icon").textContent = state.soundEnabled ? "🔔" : "🔕";
      if (state.soundEnabled) sound.chime();
    });

    document.getElementById("btn-open-settings")?.addEventListener("click", () => openModal("modal-settings"));
    document.getElementById("btn-mobile-access")?.addEventListener("click", () => openMobileAccessModal());
    document.getElementById("settings-api-key")?.addEventListener("input", e => {
      const provEl = document.getElementById("settings-provider");
      if (e.target.value.trim() && provEl && provEl.value === "builtin") {
        provEl.value = "deepseek";
      }
    });
    document.getElementById("btn-save-settings")?.addEventListener("click", () => {
      let prov = document.getElementById("settings-provider").value;
      const key = document.getElementById("settings-api-key").value.trim();
      if (key && (!prov || prov === "builtin")) {
        prov = "deepseek";
        const provEl = document.getElementById("settings-provider");
        if (provEl) provEl.value = "deepseek";
      }
      state.settings.provider = prov;
      state.settings.apiKey = key;
      state.settings.apiEndpoint = document.getElementById("settings-api-endpoint").value.trim();
      const mEl = document.getElementById("settings-model");
      if (mEl) state.settings.modelName = mEl.value.trim();
      localStorage.setItem("starbook_settings", JSON.stringify(state.settings));
      updateEngineBadge();
      closeModal("modal-settings");
      alert("已保存。" + (state.settings.apiKey && state.settings.provider !== "builtin"
        ? `已启用【${state.settings.provider}】大模型实时流式推演！` : "当前使用内置推演引擎。"));
    });

    document.getElementById("btn-clear-history")?.addEventListener("click", () => {
      if (confirm("确定清空全部会话记录？")) {
        localStorage.removeItem("starbook_sessions");
        state.sessions = [];
        newSession("新的推演", true);
      }
    });

    document.getElementById("btn-download-poster")?.addEventListener("click", () => {
      const c = document.getElementById("poster-canvas");
      const a = document.createElement("a");
      a.download = `点到命盘_${Date.now()}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    });
  }

  /* ---------------- 复制 / 长图 ---------------- */
  window.__copy = btn => {
    const b = btn.closest(".message-bubble");
    const t = b ? b.innerText.replace(/复制/g, "").trim() : "";
    navigator.clipboard.writeText(t).then(() => {
      btn.textContent = "已复制";
      setTimeout(() => btn.textContent = "复制", 1400);
    });
  };

  /* ---------------- 导出命盘图 ---------------- */

  const HUA_COLOR = { "禄": "#3f8f5c", "权": "#b4743a", "科": "#4a7fae", "忌": "#b5544b" };
  const PF_SERIF = "'Noto Serif SC','Songti SC','STSong',serif";
  const PF_SANS  = "'PingFang SC','Heiti SC','Hiragino Sans GB',sans-serif";

  function exportPoster() {
    const chart = state.userChart;
    if (!chart || !chart.ziwei || !chart.ziwei.palaces) {
      alert("还没有排盘。请先在左侧「命盘设置」里填写出生时间。");
      return;
    }
    drawChartImage(chart);
  }

  function ciRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 四化色块，返回占宽
  function ciHua(ctx, hua, x, baseY, size) {
    const s = size || 11;
    const box = s + 4;
    const prevAlign = ctx.textAlign;
    ctx.fillStyle = HUA_COLOR[hua] || "#8a5e33";
    ciRoundRect(ctx, x, baseY - box + 3, box, box, 3);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + (s - 1) + "px " + PF_SANS;
    ctx.textAlign = "center";
    ctx.fillText(hua, x + box / 2, baseY);
    ctx.textAlign = prevAlign;
    return box;
  }

  // 命 / 身 徽章，返回占宽
  function ciBadge(ctx, txt, x, baseY) {
    const box = 15;
    const prevAlign = ctx.textAlign;
    ctx.fillStyle = "rgba(154,107,63,.16)";
    ciRoundRect(ctx, x, baseY - box + 3, box, box, 3);
    ctx.fill();
    ctx.fillStyle = "#8a5e33";
    ctx.font = "bold 10.5px " + PF_SANS;
    ctx.textAlign = "center";
    ctx.fillText(txt, x + box / 2, baseY);
    ctx.textAlign = prevAlign;
    return box + 3;
  }

  // 辅星 / 桃花星流式排版，返回新的基线 y
  function ciStarRun(ctx, stars, x, y, maxW, color, size, withHua) {
    let cx = x, cy = y;
    for (const s of stars) {
      const nm = (s && s.name) ? s.name : String(s);
      ctx.font = size + "px " + PF_SANS;
      const wNm = ctx.measureText(nm).width;
      const wHua = (withHua && s && s.sihua) ? (size + 3) : 0;
      if (cx > x && cx + wNm + wHua > x + maxW) { cx = x; cy += size + 5; }
      ctx.fillStyle = color;
      ctx.font = size + "px " + PF_SANS;
      ctx.fillText(nm, cx, cy);
      cx += wNm + 1;
      if (withHua && s && s.sihua) cx += ciHua(ctx, s.sihua, cx, cy, size - 1.5);
      cx += 5;
    }
    return cy + size + 4;
  }

  function ciPalaceCell(ctx, pal, x, y, w, h) {
    if (!pal) return;
    ctx.fillStyle = pal.name === "命宫"   ? "rgba(181,84,75,.09)"
                  : pal.name === "夫妻宫" ? "rgba(154,107,63,.12)"
                  : "rgba(255,255,255,.55)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(154,107,63,.38)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);

    const px = x + 10;
    const innerW = w - 20;
    let cy = y + 26;
    ctx.textAlign = "left";

    const mains = pal.mainStars || [];
    if (mains.length) {
      for (const s of mains.slice(0, 4)) {
        let tx = px;
        ctx.fillStyle = "#3a2f24";
        ctx.font = "bold 15px " + PF_SANS;
        ctx.fillText(s.name, tx, cy);
        tx += ctx.measureText(s.name).width + 2;
        if (s.brightness) {
          ctx.fillStyle = "#a08a6c";
          ctx.font = "10px " + PF_SANS;
          ctx.fillText(s.brightness, tx, cy - 5);
          tx += ctx.measureText(s.brightness).width + 3;
        }
        if (s.sihua) ciHua(ctx, s.sihua, tx, cy, 11.5);
        cy += 21;
      }
    } else {
      ctx.fillStyle = "rgba(58,47,36,.35)";
      ctx.font = "14px " + PF_SANS;
      ctx.fillText("空宫", px, cy);
      cy += 21;
    }

    const auxes = pal.auxStars || [];
    if (auxes.length) cy = ciStarRun(ctx, auxes, px, cy + 3, innerW, "#6f5c45", 11.5, true);
    const peaches = pal.peachStars || [];
    if (peaches.length) ciStarRun(ctx, peaches, px, cy + 1, innerW, "#a8749b", 11, false);

    const fy = y + h - 13;
    ctx.textAlign = "left";
    ctx.fillStyle = "#8a5e33";
    ctx.font = "bold 13px " + PF_SANS;
    ctx.fillText(pal.name || "", px, fy);
    let bx = px + ctx.measureText(pal.name || "").width + 5;
    if (pal.isMing) bx += ciBadge(ctx, "命", bx, fy);
    if (pal.isShen) bx += ciBadge(ctx, "身", bx, fy);

    ctx.textAlign = "right";
    ctx.fillStyle = "#6f5c45";
    ctx.font = "12px " + PF_SANS;
    ctx.fillText((pal.gan || "") + (pal.branch || ""), x + w - 10, fy - 14);
    if (pal.daxian) {
      ctx.fillStyle = "#a08a6c";
      ctx.font = "11px " + PF_SANS;
      ctx.fillText(pal.daxian.start + "-" + pal.daxian.end, x + w - 10, fy);
    }
    ctx.textAlign = "left";
  }

  function ciCenterBox(ctx, chart, x, y, w, h) {
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(154,107,63,.38)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);

    const p  = chart.profile || {};
    const zw = chart.ziwei || {};
    const bz = chart.bazi || {};
    const sy = zw.sihuaYear || {};
    const p2 = n => String(n).padStart(2, "0");
    const cx = x + w / 2;
    ctx.textAlign = "center";

    let cy = y + 74;
    ctx.fillStyle = "#8a5e33";
    ctx.font = "bold 20px " + PF_SERIF;
    ctx.fillText((p.gender === "female" ? "坤造" : "乾造") + " · " + (zw.juName || ""), cx, cy);

    cy += 17;
    ctx.strokeStyle = "rgba(154,107,63,.3)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 72, cy); ctx.lineTo(cx + 72, cy); ctx.stroke();

    cy += 36;
    ctx.fillStyle = "#4a3d30";
    ctx.font = "14px " + PF_SANS;
    ctx.fillText("公历 " + p.year + "-" + p2(p.month) + "-" + p2(p.day) + " " + p2(p.hour) + ":" + p2(p.minute || 0), cx, cy);

    cy += 26;
    ctx.fillText("农历 " + ((chart.lunar ? (chart.lunar.lMonthLabel + chart.lunar.lDayLabel) : "") || ""), cx, cy);

    if (p.city) {
      cy += 25;
      ctx.fillStyle = "#6f5c45";
      ctx.font = "13px " + PF_SANS;
      ctx.fillText("出生地 " + p.city, cx, cy);
    }

    cy += 32;
    ctx.fillStyle = "#3a2f24";
    ctx.font = "bold 16px " + PF_SANS;
    ctx.fillText([bz.yearPillar, bz.monthPillar, bz.dayPillar, bz.hourPillar].join("  "), cx, cy);

    cy += 26;
    ctx.fillStyle = "#6f5c45";
    ctx.font = "13px " + PF_SANS;
    ctx.fillText("纳音 " + (zw.nayin || ""), cx, cy);

    cy += 32;
    ctx.fillStyle = "#8a5e33";
    ctx.font = "13px " + PF_SANS;
    ctx.fillText("生年四化（" + (sy.gan || "") + "）", cx, cy);

    cy += 25;
    const items = ["禄", "权", "科", "忌"].map(k => ({ k: k, v: sy[k] || "" })).filter(o => o.v);
    if (items.length) {
      ctx.font = "bold 13.5px " + PF_SANS;
      const gap = 10;
      let total = 0;
      const ws = items.map(o => { const d = ctx.measureText(o.v + o.k).width; total += d; return d; });
      total += gap * (items.length - 1);
      let ix = cx - total / 2;
      ctx.textAlign = "left";
      items.forEach((o, i) => {
        ctx.fillStyle = HUA_COLOR[o.k] || "#8a5e33";
        ctx.fillText(o.v + o.k, ix, cy);
        ix += ws[i] + gap;
      });
      ctx.textAlign = "center";
    }
  }

  function drawChartImage(chart) {
    const c = document.getElementById("poster-canvas");
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = 900, H = 1080, R = 2;
    c.width = W * R;
    c.height = H * R;
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.textBaseline = "alphabetic";

    // 背景与双层边框
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#fdfbf6");
    bg.addColorStop(.5, "#f6f1e8");
    bg.addColorStop(1, "#efe8dc");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(154,107,63,.45)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(16, 16, W - 32, H - 32);
    ctx.strokeStyle = "rgba(154,107,63,.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // 标题
    const p = chart.profile || {};
    const p2 = n => String(n).padStart(2, "0");
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a5e33";
    ctx.font = "bold 30px " + PF_SERIF;
    ctx.fillText("点 到 · 紫 微 命 盘", W / 2, 70);
    ctx.fillStyle = "#a08a6c";
    ctx.font = "13.5px " + PF_SANS;
    ctx.fillText(
      (p.gender === "female" ? "坤造" : "乾造") + " · " +
      p.year + "年" + p.month + "月" + p.day + "日 " + p2(p.hour) + ":" + p2(p.minute || 0) +
      (p.city ? " · " + p.city : ""),
      W / 2, 96
    );

    // 十二宫网格
    const M = 40, GT = 122, GS = W - M * 2, CS = GS / 4;
    const palaces = chart.ziwei.palaces;
    GRID_LAYOUT.forEach(spec => {
      ciPalaceCell(ctx, palaces[spec[0]], M + (spec[2] - 1) * CS, GT + (spec[1] - 1) * CS, CS, CS);
    });
    ciCenterBox(ctx, chart, M + CS, GT + CS, CS * 2, CS * 2);

    // 页脚
    const fy = GT + GS + 46;
    ctx.textAlign = "center";
    ctx.strokeStyle = "#b5443f";
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 44, fy - 26, 88, 36);
    ctx.fillStyle = "#b5443f";
    ctx.font = "bold 18px " + PF_SERIF;
    ctx.fillText("点到", W / 2, fy);
    ctx.fillStyle = "#a08a6c";
    ctx.font = "13px " + PF_SANS;
    ctx.fillText("一语点到，心中有数", W / 2, fy + 36);
    ctx.fillStyle = "#b8ab98";
    ctx.font = "11.5px " + PF_SANS;
    let dstr = "";
    try { dstr = new Date().toLocaleDateString("zh-CN"); } catch (e) { dstr = ""; }
    ctx.fillText("生成于 " + dstr + " · 仅供参考，不作决策依据", W / 2, fy + 58);

    openModal("modal-poster");
  }

  /* ---------------- 手机端：侧边栏抽屉与遮罩 ---------------- */
  function toggleMobileSidebar(force) {
    const sb = document.getElementById("sidebar");
    const bd = document.getElementById("sidebar-backdrop");
    if (!sb) return;
    const willOpen = (force === undefined) ? !sb.classList.contains("mobile-open") : !!force;
    sb.classList.toggle("mobile-open", willOpen);
    bd?.classList.toggle("show", willOpen);
  }
  window.__toggleMobileSidebar = toggleMobileSidebar;

  /* ---------------- 手机扫码访问 ---------------- */
  async function openMobileAccessModal() {
    openModal("modal-mobile");
    const qrWrap = document.getElementById("mobile-qr-wrap");
    const urlBox = document.getElementById("mobile-url-box");
    let url = "";
    try {
      const r = await fetch("/api/lan-info");
      const j = await r.json();
      url = j.url || "";
    } catch (e) {}
    if (!url) {
      // 回退：使用当前地址（若已通过局域网 IP 访问则直接可用）
      url = window.location.origin + "/index.html";
    }
    if (urlBox) urlBox.textContent = url;
    if (qrWrap) {
      if (/localhost|127\.0\.0\.1/.test(url)) {
        qrWrap.innerHTML = `<div style="font-size:12.5px; color:#c2764f; line-height:1.6;">
          ⚠️ 未检测到局域网 IP（可能未连接 Wi-Fi）。<br>请连上与手机相同的 Wi-Fi 后重新启动 <code>server.py</code>。</div>`;
      } else {
        const qrSrc = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" + encodeURIComponent(url);
        qrWrap.innerHTML = `<img src="${qrSrc}" alt="扫码在手机打开" width="200" height="200"
            style="border-radius:12px; background:#fff; padding:6px;"
            onerror="this.parentNode.innerHTML='<div style=\'font-size:12.5px;color:var(--text-muted);\'>二维码需联网生成，请直接在手机浏览器输入下方网址 👇</div>'">`;
      }
    }
  }
  window.__openMobileAccessModal = openMobileAccessModal;

  window.openModal = id => document.getElementById(id)?.classList.add("show");
  window.closeModal = id => document.getElementById(id)?.classList.remove("show");

  /* ---------------- 统一启动入口（确保所有常量、函数、window挂载已就绪） ---------------- */
  initTheme();
  initStarCanvas();
  sound = initSound();
  loadPersisted();
  initSessions();
  bindEvents();
});
