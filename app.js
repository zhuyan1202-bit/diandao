// 点到 —— 前端控制器 v2（浅色默认 + 主题切换 + 追问链）
document.addEventListener("DOMContentLoaded", () => {

  const state = {
    userChart: null,
    profiles: [],
    activeProfileId: "",
    chartKey: null,          // 命盘指纹：变了就说明用户改了生辰八字
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

  /* ---------------- localStorage 键名搬迁：starbook_ → diandao_ ----------------
   * 产品早期叫 starbook，改名「点到」之后键名一直没跟上。
   * 这里做一次性搬迁：老键的值原样复制到新键，然后删掉老键。
   * · 只在新键不存在时复制 —— 多标签页同时打开、或搬到一半被关掉，重跑都不会覆盖新数据
   * · 整段包 try —— 无痕模式下 localStorage 可能不可写，搬迁失败不该拦住启动
   * · 必须跑在任何 getItem 之前，所以放在这里而不是 init() 里
   * ------------------------------------------------------------------------- */
  (function migrateStorageKeys() {
    const NAMES = ["theme", "profiles", "sessions_v2", "settings", "kb_mode",
                   "user_profile", "sessions"];
    try {
      NAMES.forEach(name => {
        const oldK = "starbook_" + name, newK = "diandao_" + name;
        const oldV = localStorage.getItem(oldK);
        if (oldV === null) return;
        if (localStorage.getItem(newK) === null) localStorage.setItem(newK, oldV);
        localStorage.removeItem(oldK);
      });
    } catch (e) {}
  })();

  /* ---------------- 主题 ---------------- */
  function initTheme() {
    const saved = localStorage.getItem("diandao_theme") || "light";
    applyTheme(saved);
  }
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("diandao_theme", t);
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

  /* ================= 命盘档案：可以存多个人，各自独立 =================
   * diandao_profiles   → { activeId, list:[{id,name,profile}] }
   * diandao_sessions_v2→ { [profileId]: sessions[] }
   * 更早的 diandao_user_profile / diandao_sessions 会自动迁移成第一个档案，
   * 并且继续同步写入，万一要回退老版本也不会丢数据。
   * ================================================================= */
  const PROFILES_KEY = "diandao_profiles";
  const SESSIONS_KEY = "diandao_sessions_v2";
  const LEGACY_PROFILE_KEY = "diandao_user_profile";
  const LEGACY_SESSIONS_KEY = "diandao_sessions";
  const DEFAULT_PROFILE = {
    year: 1998, month: 8, day: 18, hour: 10, minute: 30,
    city: "默认 (东经120°标准时)", gender: "female", status: "",
    timeMode: "interval", rangeStart: "09:00", rangeEnd: "12:00"
  };

  function activeProfile() {
    return state.profiles.find(x => x.id === state.activeProfileId) || state.profiles[0] || null;
  }

  function loadProfiles() {
    let store = null;
    try { store = JSON.parse(localStorage.getItem(PROFILES_KEY) || "null"); } catch (e) {}
    if (store && Array.isArray(store.list) && store.list.length) {
      state.profiles = store.list.filter(x => x && x.id && x.profile);
    }
    if (state.profiles.length) {
      state.activeProfileId = (store && store.activeId && state.profiles.some(x => x.id === store.activeId))
        ? store.activeId : state.profiles[0].id;
      return;
    }
    // 首次运行：把旧版的单一命盘迁移成「本人」档案
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_PROFILE_KEY) || "null"); } catch (e) {}
    const id = "p" + Date.now();
    state.profiles = [{ id, name: "本人", profile: legacy || Object.assign({}, DEFAULT_PROFILE) }];
    state.activeProfileId = id;
    try {
      const old = localStorage.getItem(LEGACY_SESSIONS_KEY);
      if (old) {
        const box = {};
        box[id] = JSON.parse(old);
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(box));
      }
    } catch (e) {}
    saveProfiles();
  }

  function saveProfiles() {
    try {
      localStorage.setItem(PROFILES_KEY,
        JSON.stringify({ activeId: state.activeProfileId, list: state.profiles }));
      const act = activeProfile();
      if (act) localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(act.profile));
    } catch (e) {}
  }

  // updateChart 每次落盘都会走这里，所以只要排过盘就一定存下来了
  function persistActiveProfile(p) {
    const act = activeProfile();
    if (act) act.profile = p;
    saveProfiles();
  }

  function profileSummary(pr) {
    if (!pr) return "";
    const pad = n => String(n).padStart(2, "0");
    const t = pr.timeMode === "exact"
      ? `${pad(pr.hour)}:${pad(pr.minute || 0)}`
      : `${pr.rangeStart || "?"}–${pr.rangeEnd || "?"}`;
    return `${pr.year}-${pad(pr.month)}-${pad(pr.day)} ${t} · ${pr.gender === "female" ? "坤" : "乾"}`;
  }

  function renderProfileBar() {
    const act = activeProfile();
    if (!act) return;
    const nm = document.getElementById("ps-name");
    const av = document.getElementById("ps-avatar");
    if (nm) nm.textContent = act.name;
    if (av) av.textContent = (act.name || "?").trim().charAt(0);

    const list = document.getElementById("profile-menu-list");
    if (list) {
      list.innerHTML = state.profiles.map(p => `
        <div class="profile-menu-item ${p.id === state.activeProfileId ? "active" : ""}"
             onclick="window.__switchProfile('${p.id}')">
          <div class="pmi-main">
            <div class="pmi-name">${escapeHtml(p.name)}${p.id === state.activeProfileId ? ' <span class="pmi-cur">当前</span>' : ""}</div>
            <div class="pmi-sub">${escapeHtml(profileSummary(p.profile))}</div>
          </div>
          <button class="pmi-btn" title="重命名" onclick="window.__renameProfile(event,'${p.id}')">✎</button>
          <button class="pmi-btn danger" title="删除档案" onclick="window.__deleteProfile(event,'${p.id}')">×</button>
        </div>`).join("");
    }
    const nameInput = document.getElementById("drawer-profile-name");
    if (nameInput) nameInput.value = act.name;
    markSaveClean();
  }

  function closeProfileMenu() {
    document.getElementById("profile-menu")?.classList.remove("open");
  }

  function switchProfile(id) {
    closeProfileMenu();
    if (id === state.activeProfileId) return;
    const target = state.profiles.find(x => x.id === id);
    if (!target) return;
    saveSessions();                 // 先把当前这个人的会话落盘
    state.activeProfileId = id;
    saveProfiles();
    state.chartKey = "";            // 换人不是改盘，别插「命盘已改」分隔线
    updateChart(target.profile, true);
    state.sessions = [];
    initSessions();
    renderProfileBar();
    markSaveClean();
    sound.chime();
  }

  function createProfile() {
    const name = (prompt("这是谁的盘？给个名字：", "新档案") || "").trim();
    if (!name) return;
    closeProfileMenu();
    saveSessions();
    const id = "p" + Date.now();
    state.profiles.push({ id, name, profile: Object.assign({}, DEFAULT_PROFILE) });
    state.activeProfileId = id;
    saveProfiles();
    state.chartKey = "";
    updateChart(Object.assign({}, DEFAULT_PROFILE), true);
    state.sessions = [];
    initSessions();
    renderProfileBar();
    markSaveDirty();                // 默认生辰肯定要改，直接提示他存
    document.getElementById("chart-drawer")?.classList.add("open");
    toggleMobileSidebar(false);
  }

  window.__switchProfile = switchProfile;
  window.__renameProfile = (e, id) => {
    e.stopPropagation();
    const p = state.profiles.find(x => x.id === id);
    if (!p) return;
    const name = (prompt("改个名字：", p.name) || "").trim();
    if (!name) return;
    p.name = name;
    saveProfiles();
    renderProfileBar();
  };
  window.__deleteProfile = (e, id) => {
    e.stopPropagation();
    if (state.profiles.length <= 1) { alert("至少要留一个档案。"); return; }
    const p = state.profiles.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`删除档案「${p.name}」？\n这个人名下的全部对话记录也会一起删掉，无法恢复。`)) return;
    state.profiles = state.profiles.filter(x => x.id !== id);
    try {
      const all = allSessionStore();
      delete all[id];
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
    } catch (err) {}
    if (state.activeProfileId === id) {
      state.activeProfileId = state.profiles[0].id;
      saveProfiles();
      state.chartKey = "";
      updateChart(state.profiles[0].profile, true);
      state.sessions = [];
      initSessions();
    } else {
      saveProfiles();
    }
    renderProfileBar();
  };

  /* ---------- 未保存提示：改了表单没点保存，底部条会变色 ---------- */
  function currentFormProfileKey() {
    const g = id => document.getElementById(id)?.value || "";
    return [g("drawer-profile-name"), g("drawer-birthdate"), g("drawer-time-mode"),
            g("drawer-birthtime"), g("drawer-range-start"), g("drawer-range-end"),
            g("drawer-city"), g("drawer-gender"), g("drawer-status")].join("|");
  }
  let _savedFormKey = "";
  function markSaveClean() {
    _savedFormKey = currentFormProfileKey();
    const bar = document.getElementById("drawer-save-bar");
    const hint = document.getElementById("save-hint");
    bar?.classList.remove("is-dirty");
    if (hint) hint.textContent = "已保存";
  }
  function markSaveDirty() {
    const bar = document.getElementById("drawer-save-bar");
    const hint = document.getElementById("save-hint");
    bar?.classList.add("is-dirty");
    if (hint) hint.textContent = "有改动还没保存";
  }
  function refreshSaveState() {
    if (currentFormProfileKey() === _savedFormKey) markSaveClean();
    else markSaveDirty();
  }

  function loadPersisted() {
    loadProfiles();
    const act = activeProfile();
    updateChart(act ? act.profile : Object.assign({}, DEFAULT_PROFILE), false);
    renderProfileBar();

    try {
      const s = localStorage.getItem("diandao_settings");
      if (s) {
        state.settings = { ...state.settings, ...JSON.parse(s) };
        if (state.settings.apiKey && state.settings.apiKey.trim() && (!state.settings.provider || state.settings.provider === "builtin")) {
          state.settings.provider = "deepseek";
          localStorage.setItem("diandao_settings", JSON.stringify(state.settings));
        }
        const a = document.getElementById("settings-provider");
        const b = document.getElementById("settings-api-key");
        const c = document.getElementById("settings-api-endpoint");
        if (a) a.value = state.settings.provider || "builtin";
        if (b) b.value = state.settings.apiKey || "";
        if (c) c.value = state.settings.apiEndpoint || "";
        const d = document.getElementById("settings-model");
        if (d) d.value = state.settings.modelName || "";
        const dt = document.getElementById("settings-deep-think");
        if (dt) dt.checked = Boolean(state.settings.deepThink);
        const bp = document.getElementById("settings-backup-provider");
        if (bp) bp.value = state.settings.backupProvider || "none";
        const bk = document.getElementById("settings-backup-key");
        if (bk) bk.value = state.settings.backupApiKey || "";
      }
    } catch (e) {}
    const savedKbMode = localStorage.getItem("diandao_kb_mode") || "ziwei";
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
    if (persist) localStorage.setItem("diandao_kb_mode", mode);

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
      // 原始区间留着，以后想重新定盘还能接着用
      rangeStart: document.getElementById("drawer-range-start")?.value || "",
      rangeEnd: document.getElementById("drawer-range-end")?.value || "",
      rectified: true,
      rectifiedShichen: shichenName || "",
      city: city,
      gender: document.getElementById("drawer-gender")?.value || "female",
      status: document.getElementById("drawer-status")?.value || ""
    }, true);
    if (sound && sound.chime) sound.chime();

    // 不再静默关掉——直接把命盘档案开给用户看，并把刚改动的地方高亮
    const drawer = document.getElementById("chart-drawer");
    if (drawer) {
      drawer.classList.add("open");
      if (window.__toggleMobileSidebar) window.__toggleMobileSidebar(false);
      const prev = document.getElementById("drawer-tst-preview");
      if (prev) {
        prev.classList.add("flash-ok");
        setTimeout(() => prev.classList.remove("flash-ok"), 2400);
        setTimeout(() => { try { prev.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }, 60);
      }
    }
  };

  /* ================= 精准定盘 v2 =================
     主证据：你填人生大事的年份（填的时候看不到会算到哪个盘，没法被引导）
     辅助：几句单盘描述，四档作答，不做二选一
     没发生过 / 记不清 一律可以跳过，不存在“答不出还得硬选”
  ================================================= */
  let currentRectifyQuiz = null;
  let rectifyAnswers = { events: {}, traits: {} };
  let rectifyCtx = null;   // 这次定盘是从哪个区间推出来的，渲染时要如实告诉用户

  window.__openRectifyModal = function() {
    if (!window.AstrologyCore || !window.AstrologyCore.buildRectifyQuiz) return;
    const d = document.getElementById("drawer-birthdate")?.value || "1998-08-18";
    const [y, m, dd] = d.split("-").map(Number);
    const city = document.getElementById("drawer-city")?.value || "默认 (东经120°标准时)";
    const gender = document.getElementById("drawer-gender")?.value || "female";
    const status = document.getElementById("drawer-status")?.value || "";
    // 精确时间模式下界面上根本没有区间可读。
    // 直接去拿 drawer-range-start/end 会读到默认的 09:00–12:00，
    // 那跟他的实际生辰毫无关系 —— 定盘会拿一组错的候选去问他。
    // 正确做法：以他填的时间为中心前后各放宽半小时。
    // 时辰本身有两小时宽，半小时的容差意味着「只有真的贴着交界才需要定盘」——
    // 放宽一小时的话，连时辰正中的时间都会被拖出两个候选，那就成了骚扰。
    const tMode = document.getElementById("drawer-time-mode")?.value || "interval";
    let rStart = "", rEnd = "", exactBase = "";
    if (tMode === "exact") {
      const bt = document.getElementById("drawer-birthtime")?.value || "";
      const bp = bt.split(":").map(Number);
      if (bp.length >= 1 && !isNaN(bp[0])) {
        const mins = bp[0] * 60 + (isNaN(bp[1]) ? 0 : bp[1]);
        const pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
        const fmt = function (n) {
          const k = Math.min(23 * 60 + 59, Math.max(0, n));
          return pad2(Math.floor(k / 60)) + ":" + pad2(k % 60);
        };
        exactBase = fmt(mins);
        rStart = fmt(mins - 30);
        rEnd   = fmt(mins + 30);
      }
    }
    if (!rStart) {
      rStart = document.getElementById("drawer-range-start")?.value || "09:00";
      rEnd   = document.getElementById("drawer-range-end")?.value || "12:00";
    }
    const [sh, sm] = rStart.split(":").map(Number);
    const [eh, em] = rEnd.split(":").map(Number);

    const ivRes = window.AstrologyCore.analyzeTimeInterval({
      year: y, month: m, day: dd,
      startHour: isNaN(sh) ? 9 : sh, startMinute: isNaN(sm) ? 0 : sm,
      endHour: isNaN(eh) ? 12 : eh, endMinute: isNaN(em) ? 0 : em,
      city, gender, status
    });

    // buildRectifyQuiz 在只有一个候选时会主动拉「前一时辰」来做对照 ——
    // 那是为「区间模式」设计的（用户自己说了不确定）。
    // 精确时间模式下他已经给了具体时刻，放宽半小时还落在同一个时辰，
    // 就不该无中生有编一个前一时辰让他选，直接告诉他不用定盘。
    const singleInExact = (tMode === "exact" && (ivRes.candidates || []).length === 1);
    currentRectifyQuiz = singleInExact
      ? null
      : window.AstrologyCore.buildRectifyQuiz(ivRes.candidates);
    rectifyAnswers = { events: {}, traits: {} };
    rectifyCtx = {
      mode: tMode, start: rStart, end: rEnd, base: exactBase,
      shichen: (ivRes.candidates || []).map(function (c) { return c.shichenName; })
    };

    const verdictBox = document.getElementById("rectify-verdict-box");
    if (verdictBox) verdictBox.style.display = "none";
    renderRectifyQuiz();
    openModal("modal-rectify");
  };

  // 只在打开时渲染一次 —— 中途重绘会把年份输入框的光标顶掉
  function renderRectifyQuiz() {
    const container = document.getElementById("rectify-quiz-container");
    const q = currentRectifyQuiz;
    if (!container) return;
    if (!q) {
      const only = (rectifyCtx && rectifyCtx.shichen && rectifyCtx.shichen[0]) ? rectifyCtx.shichen[0] : "";
      container.innerHTML = (rectifyCtx && rectifyCtx.mode === "exact")
        ? "<div class=\"rx-head\">你填的是 " + escapeHtml(rectifyCtx.base || "") +
          "，前后各放宽半小时（" + escapeHtml(rectifyCtx.start) + "–" + escapeHtml(rectifyCtx.end) +
          "）之后仍然落在同一个时辰" + (only ? "【" + escapeHtml(only) + "】" : "") +
          "里。<br>也就是说就算记错半小时，这张盘也不会变 —— 不用定盘。" +
          "<br><br>如果你怀疑自己记错的<b>不止半小时</b>，把上面的时间模式切成「时间区间」，" +
          "填一个你有把握的范围，再回来定盘。</div>"
        : "<div class=\"rx-head\">当前区间（" + escapeHtml(rectifyCtx ? rectifyCtx.start : "") + "–" +
          escapeHtml(rectifyCtx ? rectifyCtx.end : "") + "）只对应一个时辰，不需要定盘。</div>";
      return;
    }

    const candLine = q.candidates.map(c => `<b>${escapeHtml(c.shichenName)}</b>`).join(" 还是 ");
    const srcNote = (rectifyCtx && rectifyCtx.mode === "exact")
      ? `<div class="rx-srcnote">你填的是 <b>${escapeHtml(rectifyCtx.base || "")}</b>，正好靠近时辰交界。
         这里按 ${escapeHtml(rectifyCtx.start)}–${escapeHtml(rectifyCtx.end)} 取候选，用下面的问题定一下究竟是哪个时辰。</div>`
      : "";

    const evHtml = q.events.map(ev => `
      <div class="rx-ev" data-ev="${ev.id}">
        <div class="rx-ev-text">
          <div class="rx-ev-label">${escapeHtml(ev.label)}</div>
          ${ev.hint ? `<div class="rx-ev-hint">${escapeHtml(ev.hint)}</div>` : ""}
        </div>
        <div class="rx-ev-ctrl">
          <input type="number" inputmode="numeric" class="rx-year" placeholder="年份"
                 min="${q.minYear}" max="${q.maxYear}"
                 oninput="window.__setRectifyYear('${ev.id}', this.value)">
          <button type="button" class="rx-skip" onclick="window.__skipRectifyEvent('${ev.id}', this)">没有过</button>
        </div>
      </div>`).join("");

    const trHtml = !q.traits.length ? "" : `
      <div class="rx-sec">
        <div class="rx-sec-h">② 再对几句话 <span>对不上就直说「不符合」，不用勉强</span></div>
        ${q.traits.map(t => `
          <div class="rx-tr" data-tr="${t.id}">
            <div class="rx-tr-dim">${escapeHtml(t.dimension)}</div>
            <div class="rx-tr-text">${escapeHtml(t.statement)}</div>
            <div class="rx-tr-opts">
              ${[["yes", "很符合"], ["kinda", "有点像"], ["no", "不符合"], ["unsure", "说不准"]]
                .map(o => `<button type="button" class="rx-tr-btn" onclick="window.__setRectifyTrait('${t.id}','${o[0]}',this)">${o[1]}</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>`;

    container.innerHTML = `
      <div class="rx-head">现在要分的是：${candLine}</div>
      ${srcNote}
      <div class="rx-sec">
        <div class="rx-sec-h">① 你的人生时间点 <span>记得几件填几件，不用全填；只填年份即可</span></div>
        <div class="rx-ev-list">${evHtml}</div>
      </div>
      ${trHtml}`;
  }

  window.__setRectifyYear = function(evId, val) {
    const q = currentRectifyQuiz;
    if (!q) return;
    const row = document.querySelector(`.rx-ev[data-ev="${evId}"]`);
    const y = parseInt(val, 10);
    if (!String(val).trim()) {
      delete rectifyAnswers.events[evId];
      row && row.classList.remove("rx-bad");
    } else if (isNaN(y) || y < q.minYear || y > q.maxYear) {
      delete rectifyAnswers.events[evId];
      row && row.classList.add("rx-bad");
    } else {
      rectifyAnswers.events[evId] = y;
      if (row) {
        row.classList.remove("rx-bad");
        const sk = row.querySelector(".rx-skip");
        if (sk) sk.classList.remove("on");
      }
    }
    evaluateRectifyQuiz();
  };

  window.__skipRectifyEvent = function(evId, btn) {
    const row = document.querySelector(`.rx-ev[data-ev="${evId}"]`);
    const on = btn.classList.toggle("on");
    if (on && row) {
      const inp = row.querySelector(".rx-year");
      if (inp) inp.value = "";
      row.classList.remove("rx-bad");
      delete rectifyAnswers.events[evId];
    }
    evaluateRectifyQuiz();
  };

  window.__setRectifyTrait = function(tId, val, btn) {
    const wrap = btn.closest(".rx-tr-opts");
    if (wrap) wrap.querySelectorAll(".rx-tr-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    rectifyAnswers.traits[tId] = val;
    evaluateRectifyQuiz();
  };

  function evaluateRectifyQuiz() {
    const box = document.getElementById("rectify-verdict-box");
    const q = currentRectifyQuiz;
    if (!box || !q || !window.AstrologyCore.scoreRectify) return;

    const nEv = Object.keys(rectifyAnswers.events).length;
    const nTr = Object.keys(rectifyAnswers.traits).length;
    if (!nEv && !nTr) { box.style.display = "none"; return; }

    const r = window.AstrologyCore.scoreRectify(q, rectifyAnswers);

    const detailHtml = r.evLines.concat(r.trLines)
      .map(l => `<div class="rx-line ${l.ok ? "ok" : "no"}">${l.ok ? "✔" : "—"} ${escapeHtml(l.text)}</div>`).join("");

    const bars = r.ranked.map(x => {
      const pct = r.weight > 0 ? Math.round(x.s / r.weight * 100) : 0;
      return `<div class="rx-bar-row"><span class="rx-bar-name">${escapeHtml(x.c.shichenName)}</span>`
           + `<span class="rx-bar"><i style="width:${pct}%"></i></span><span class="rx-bar-pct">${pct}%</span></div>`;
    }).join("");

    let tone, headline, detail;
    if (r.status === "insufficient") {
      tone = "warn";
      headline = "证据还不够，先不下结论";
      detail = `目前有效证据 ${r.weight} 分，判定线是 ${r.minWeight} 分。`
             + (r.noSignal ? `你填的年份里有 ${r.noSignal} 条在几个盘上都说得通，分不出来。` : "")
             + `再多填几个年份会准得多。`;
    } else if (r.status === "tie") {
      tone = "warn";
      headline = "两个盘咬得太近，现在还分不开";
      detail = `领先幅度只有 ${Math.round(r.leadRatio * 100)}%，没到 ${Math.round(r.minLead * 100)}% 的判定线。`
             + `这种时候硬定一个，后面所有分析都会跟着错。`;
    } else {
      tone = "ok";
      headline = `【${r.top.c.shichenName}】明显对得上`;
      detail = `在 ${r.weight} 分有效证据里领先 ${Math.round(r.leadRatio * 100)}%，超过了 ${Math.round(r.minLead * 100)}% 的判定线。`;
    }
    if (r.unsure) detail += `（${r.unsure} 项你选了“说不准”，没计分）`;

    // 按钮一律走 CSS 类，不再写死颜色 —— 之前的 rgba(255,255,255,.08) 在浅色主题下是白底白字
    const btns = [];
    if (r.status === "confident") {
      btns.push(`<button type="button" class="rx-btn rx-btn-primary" onclick="window.__applyRectifiedChart(${r.top.c.clockHour}, ${r.top.c.clockMinute}, '${r.top.c.shichenName}')">✨ 采纳：锁定【${r.top.c.shichenName}】并更新全盘</button>`);
    } else {
      btns.push(`<button type="button" class="rx-btn rx-btn-ghost" onclick="window.__applyRectifiedChart(${r.top.c.clockHour}, ${r.top.c.clockMinute}, '${r.top.c.shichenName}')">先按目前领先的【${r.top.c.shichenName}】用着（随时可改）</button>`);
    }
    btns.push(`<button type="button" class="rx-btn rx-btn-ghost" onclick="window.__sendRectifyToAI()">💬 把已填的内容交给 AI，让它继续追问</button>`);

    box.style.display = "block";
    box.innerHTML = `
      <div class="rx-verdict-h ${tone}">🎯 ${headline}</div>
      <div class="rx-bars">${bars}</div>
      <div class="rx-lines">${detailHtml}</div>
      <div class="rx-detail">${detail}</div>
      <div class="rx-act">${btns.join("")}</div>`;
  }

  window.__applyRectifiedChart = function(clockH, clockM, shichenName) {
    closeModal("modal-rectify");
    window.__lockCandidateShichen(clockH, clockM, shichenName);
  };

  window.__sendRectifyToAI = function() {
    const q = currentRectifyQuiz;
    if (!q) return;
    closeModal("modal-rectify");
    document.getElementById("chart-drawer")?.classList.remove("open");

    const candDesc = q.candidates.map((c, i) =>
      `候选盘${String.fromCharCode(65 + i)}：【${c.shichenName}】（时柱${c.hourPillar}，紫微命宫${c.mingStars}，夫妻宫${c.spouseStars}）`
    ).join(" vs ");

    const evTxt = q.events
      .filter(ev => rectifyAnswers.events[ev.id])
      .map(ev => `· ${ev.label}：${rectifyAnswers.events[ev.id]} 年`);

    const TR_LABEL = { yes: "很符合", kinda: "有点像", no: "不符合", unsure: "说不准" };
    const trTxt = (q.traits || [])
      .filter(t => rectifyAnswers.traits[t.id])
      .map(t => `· 「${t.statement}」→ 我的回答：${TR_LABEL[rectifyAnswers.traits[t.id]]}`);

    const r = window.AstrologyCore.scoreRectify(q, rectifyAnswers);
    const sysTxt = r.evLines.concat(r.trLines).map(l => `· ${l.text}`);

    const body = [
      evTxt.length ? "【我填的人生时间点】\n" + evTxt.join("\n") : "【我还没填任何年份】",
      trTxt.length ? "\n\n【几句描述的核对结果】\n" + trTxt.join("\n") : "",
      "\n\n【系统自动算出来的初步判断（仅供参考，不要直接附和）】\n" + (sysTxt.join("\n") || "· 暂无")
        + `\n· 当前状态：${r.status === "confident" ? "系统认为可以定下来" : (r.status === "tie" ? "两盘咬得很近，分不开" : "证据不足")}`
    ].filter(Boolean).join("");

    const prompt = `我的出生时间只知道一个大致区间，现在还定不下来：\n${candDesc}\n\n${body}\n\n请严格按下面三步来，不要跳步，也不要直接附和系统的初步判断：\n\n第一步：拿我填的每一个年份，分别在两个候选盘上排一遍流年与大限，看哪个盘对得上。对不上就说对不上，不要强行圆。\n\n第二步：针对我没填、或两盘都说得通的地方，向我提 2–3 个追问。追问必须只能用客观事实回答（哪一年发生了什么、住在哪里、身体哪个部位真的出过问题），不要问“你觉得自己是不是比较内向”这类性格感受题——那种题我会不自觉顺着你的话选。\n\n第三步：等我回答完追问之后再收敛。如果仍然分不开，请明确告诉我分不开，并说明还需要什么信息才能分开。不要为了给个答案而勉强下判断。`;
    send(prompt);
  };

  /**
   * 侧边栏「命盘档案」卡片 —— 全局只能有这一处写它。
   * 之前 updateChart 与 renderDynamicPrompts 各写一遍，后者会把生辰和定盘状态覆盖掉。
   */
  function renderMiniProfile(chart) {
    const mini = document.getElementById("mini-profile-text");
    if (!mini || !chart) return;
    const pad = n => String(n).padStart(2, "0");
    const pr = chart.profile, b = chart.bazi, sp = chart.ziwei.spousePalace;
    const g = pr.gender === "female" ? "\u5764\u9020" : "\u4e7e\u9020";
    const shichen = String(b.hourPillar || "").slice(-1);
    const isInterval = pr.timeMode === "interval";
    const pending = isInterval && Array.isArray(pr.intervalCandidates) && pr.intervalCandidates.length > 1;
    const timeTxt = pending
      ? pr.rangeStart + "\u2013" + pr.rangeEnd + " \u4e4b\u95f4"
      : pad(pr.hour) + ":" + pad(pr.minute || 0) + " \u00b7 " + shichen + "\u65f6";
    const flag = pending
      ? '<span class="mini-flag warn">\u65f6\u8fb0\u5f85\u5b9a</span>'
      : (pr.rectified ? '<span class="mini-flag ok">\u5df2\u5b9a\u76d8</span>' : "");

    const spouse = (sp.mainStarNames && sp.mainStarNames.length)
      ? sp.mainStarNames.join("\u00b7") : "\u7a7a\u5bab\uff08\u501f\u5bf9\u5bab\uff09";
    const starLine = (state.kbMode === "bazi")
      ? "\u56db\u67f1 <b>" + escapeHtml([b.yearPillar, b.monthPillar, b.dayPillar, b.hourPillar].join(" ")) + "</b>"
      : "\u547d\u5bab <b>" + escapeHtml(getPalaceStarLabel(chart, "\u547d\u5bab")) + "</b> \u00b7 \u592b\u59bb\u5bab <b>" + escapeHtml(spouse) + "</b>";

    mini.innerHTML =
        '<div class="mini-line strong">' + pr.year + "-" + pad(pr.month) + "-" + pad(pr.day) + " \u00b7 " + timeTxt + flag + "</div>"
      + '<div class="mini-line">' + escapeHtml(pr.city || "") + " \u00b7 " + g + " \u00b7 \u65e5\u5143 <b>" + escapeHtml(b.dayMaster + b.wuxing) + "</b></div>"
      + '<div class="mini-line">' + starLine + "</div>";
  }

  function chartKeyOf(p) {
    return [p.year, p.month, p.day, p.hour, p.minute || 0, p.city || "", p.gender || ""].join("|");
  }

  /**
   * 改了生辰八字之后，旧对话里的分析全部作废。
   * 不删记录（你可能还想翻），只插一条分隔线，并从此不再把分隔线之前的内容发给模型。
   */
  function markChartChanged(chart) {
    const p = chart.profile;
    const pad = n => String(n).padStart(2, "0");
    const b = chart.bazi;
    const label = `命盘已改为 ${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute || 0)}`
      + (p.city ? ` · ${p.city}` : "")
      + `（${p.gender === "female" ? "坤造" : "乾造"} · ${b.yearPillar} ${b.monthPillar} ${b.dayPillar} ${b.hourPillar}）`
      + `。以上内容算的是旧盘，已不再作为后续分析的依据。`;

    let touched = false;
    (state.sessions || []).forEach(sess => {
      [sess.ziweiMessages, sess.baziMessages].forEach(arr => {
        if (!arr || !arr.length) return;
        const last = arr[arr.length - 1];
        if (last && last.role === "chart-change") {   // 连着改好几次只留一条
          last.content = label; last.ck = state.chartKey;
        } else {
          arr.push({ role: "chart-change", content: label, ck: state.chartKey });
        }
        touched = true;
      });
    });
    if (!touched) return;
    saveSessions();
    const cur = state.sessions.find(x => x.id === state.currentSessionId);
    if (cur) renderMessages(getRoomMessages(cur, state.kbMode));
  }

  // 只把【当前命盘】的对话发给模型，避免它照着旧盘的旧结论继续算
  function historyForLLM(roomMsgs, dropTail) {
    const arr = roomMsgs.slice(0, dropTail);
    let start = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].role === "chart-change" || (arr[i].ck && arr[i].ck !== state.chartKey)) start = i + 1;
    }
    return arr.slice(start).filter(m => m.role === "user" || m.role === "ai");
  }

  function updateChart(p, persist = true) {
    const chart = AstrologyCore.analyzeFullNatalChart(p);
    state.userChart = chart;
    if (persist) persistActiveProfile(p);

    // analyzeFullNatalChart 只返回命理所需字段，会把 timeMode / 区间 / 定盘标记全部丢掉，
    // 导致命盘档案每次都回退到「区间模式」—— 定盘结果因此看不见。这里原样带回去。
    chart.profile.timeMode = p.timeMode || "interval";
    if (p.rangeStart) chart.profile.rangeStart = p.rangeStart;
    if (p.rangeEnd)   chart.profile.rangeEnd   = p.rangeEnd;
    chart.profile.intervalCandidates = p.intervalCandidates || null;
    chart.profile.rectified = Boolean(p.rectified);
    chart.profile.rectifiedShichen = p.rectifiedShichen || "";

    const newKey = chartKeyOf(chart.profile);
    const changed = Boolean(state.chartKey) && state.chartKey !== newKey;
    state.chartKey = newKey;

    const g = chart.profile.gender === "female" ? "坤造" : "乾造";
    const sp = chart.ziwei.spousePalace;
    const b = chart.bazi;

    renderMiniProfile(chart);

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

    if (changed) markChartChanged(chart);
    markSaveClean();
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

  // 第三张卡（「我想问自己的那件事」）点下去不发消息，只把人引到输入框，
  // 并换上一个具体的例子当 placeholder —— 示范这个产品在具体决策题上最有用
  const ASK_EXAMPLES = {
    // 紫微强在「具体到人、具体到事」：宫位对应六亲与场景，飞化能看出这件事被谁牵动
    ziwei: [
      "例如：这个合伙人靠不靠得住？",
      "例如：这件事到底卡在谁身上？",
      "例如：手上这个 offer，老板是什么路数？",
      "例如：和现在这个人还能走多远？",
      "例如：要不要跟他把话挑明？",
      "例如：这次调岗对我是好是坏？"
    ],
    // 八字强在「趋势与取舍」：格局定路子，大运流年流月定节奏
    bazi: [
      "例如：今年该进还是该守？",
      "例如：手里这两条路，该走哪条？",
      "例如：现在辞职去做自己的事，时机对吗？",
      "例如：我适合往哪个方向、哪个行业走？",
      "例如：这笔钱现在投出去合适吗？",
      "例如：想换个城市，什么时候动最好？"
    ]
  };
  function focusAsk() {
    const ta = document.getElementById("chat-input");
    if (!ta) return;
    const pool = ASK_EXAMPLES[state.kbMode === "bazi" ? "bazi" : "ziwei"];
    ta.placeholder = pool[Math.floor(Math.random() * pool.length)];
    const box = document.querySelector(".input-box-container");
    if (box) {
      box.classList.remove("ask-hint");
      void box.offsetWidth;            // 强制重排，让动画能连点两次重播
      box.classList.add("ask-hint");
    }
    try { ta.focus(); } catch (e) {}
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

    renderMiniProfile(chart);

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

    // 从盘里挑真实特征写副标题：让人一眼认出「这是我的盘」，而不是一套模板
    function safeCall(fn, arg) { try { return fn ? fn(arg) : null; } catch (e) { return null; } }
    function palaceOf(name) { return (chart.ziwei.palaces || []).find(x => x.name === name) || null; }
    function huaOf(name) {
      const p = palaceOf(name);
      if (!p) return [];
      const out = [];
      (p.mainStars || []).concat(p.auxStars || []).forEach(s => {
        if (s.sihua && out.indexOf(s.sihua) < 0) out.push("化" + s.sihua);
      });
      return out;
    }
    function noMainStar(name) {
      const p = palaceOf(name);
      return !!p && !(p.mainStars || []).length;
    }

    // 第三张卡点了不发送，只把光标送进输入框。
    // 前两张现在已经是具体问题了，所以这张的任务变成「示范还能问什么」——
    // 两席擅长的题型不同，必须分开写，否则用户不知道该在哪个窗口问什么。
    function askCardFor(m) {
      return {
        icon: "\u270d\ufe0f",
        fill: true,
        title: "都不是 —— 我想问自己的那件事",
        sub: (m === "bazi")
          ? "八字最擅长回答「该不该、什么时候」 —— 比如「现在辞职去做自己的事，时机对吗」「想换个城市，什么时候动」"
          : "紫微最擅长回答「是谁、会怎么发生」 —— 比如「这个合伙人靠不靠得住」「手上这个 offer，老板是什么路数」"
      };
    }

    let cards = [];
    if (mode === "ziwei") {
      if (greetIcon) greetIcon.textContent = "🔮";
      if (greetTitle) greetTitle.textContent = "紫微斗数 · 一语点到";
      if (greetDesc) greetDesc.innerHTML = `<div>🕒 <strong>今日 公历 ${t.solarDateOnly} · ${t.lunarStr} · ${t.yPillar}年 ${t.mPillar}月 ${t.dPillar}日</strong></div><div style="margin-top:4px;">十二宫已按你的出生时刻排定。下面两个入口是按你的盘挑的；心里有具体的事，直接在下面问更有用。</div>`;

      const spHua = huaOf("夫妻宫");
      let subLove;
      if (noMainStar("夫妻宫")) subLove = `你的夫妻宫没有主星，这种盘得借对宫【${careerStar}】来看`;
      else if (spHua.indexOf("化忌") >= 0) subLove = `你的夫妻宫坐【${spouseStar}】且带化忌，感情上有个绕不开的结`;
      else if (spHua.length) subLove = `你的夫妻宫坐【${spouseStar}】，带${spHua.join("、")}`;
      else subLove = `看夫妻宫【${spouseStar}】配对宫【${careerStar}】，连大限流年一起推`;

      // 「卡在谁身上」这张卡：盘上那个「结」（生年忌）落在哪一宫，就是卡点最常在的地方
      function jiSpot() {
        const ps = chart.ziwei.palaces || [];
        for (let i = 0; i < ps.length; i++) {
          const all = (ps[i].mainStars || []).concat(ps[i].auxStars || []);
          for (let j = 0; j < all.length; j++) {
            if (all[j].sihua === "忌") return { pal: ps[i].name, star: all[j].name };
          }
        }
        return null;
      }
      // 直接写「疾厄宫」这种宫名读着莫名其妙，先翻成人话，宫名收进括号当依据
      const PAL_PLAIN = {
        "命宫": "你自己的性子", "兄弟宫": "平辈与合伙那块", "夫妻宫": "亲密关系那块",
        "子女宫": "孩子与下属那块", "财帛宫": "钱这块", "疾厄宫": "身体这块",
        "迁移宫": "往外跑的那块", "交友宫": "朋友与同事那块", "仆役宫": "朋友与同事那块",
        "奴仆宫": "朋友与同事那块", "官禄宫": "工作这块", "田宅宫": "家里与房产那块",
        "福德宫": "你的心气那块", "父母宫": "长辈与上级那块"
      };
      const ji = jiSpot();
      const subStuck = ji
        ? `你盘上那个解不开的结落在${PAL_PLAIN[ji.pal] || ji.pal}〔${ji.pal}坐【${ji.star}】〕`
        : `从本命宫【${mingStar}】起，顺着飞化找出真正在牵制你的那一宫`;

      cards = [
        { icon: "💔", title: "我和现在这个人，还能不能走下去？", sub: subLove,
          prompt: "我和现在这个人，还能不能走下去？" },
        { icon: "🧩", title: "我最近卡住的这件事，到底卡在谁身上？", sub: subStuck,
          prompt: "我最近卡住的这件事，到底卡在谁身上？" },
        askCardFor("ziwei")
      ];
    } else {
      if (greetIcon) greetIcon.textContent = "📜";
      if (greetTitle) greetTitle.textContent = "四柱八字 · 一语点到";
      if (greetDesc) greetDesc.innerHTML = `<div>🕒 <strong>今日 公历 ${t.solarDateOnly} · ${t.lunarStr} · ${t.yPillar}年 ${t.mPillar}月 ${t.dPillar}日</strong></div><div style="margin-top:4px;">四柱已按你的出生时刻定局。下面两个入口是按你的盘挑的；心里有具体的事，直接在下面问更有用。</div>`;

      const st  = safeCall(window.ChatEngine && window.ChatEngine.baziStrength, chart);
      const pat = safeCall(window.ChatEngine && window.ChatEngine.derivePattern, chart);

      // 「走还是留」这张卡最相关的是格局＋眼下这步运，不是旺衰打分
      let subStay = `看日元【${dmLabel}】配眼下这步大运，定这一步该动还是该稳`;
      if (pat && pat.name) subStay = `你这张盘月令取【${pat.name}】，配眼下这步大运看动不动得`;
      else if (st) subStay = `日元【${dmLabel}】${st.verdict}，配眼下这步大运定进退`;

      // 「钱该出手还是收着」看喜忌与调候，落到今年这一段
      let subMoney = `看日元【${dmLabel}】的喜忌，配今年的流年流月定财的进退`;
      if (st && st.favor && st.favor.length) subMoney = `日元【${dmLabel}】${st.verdict}，喜${st.favor.join("")} —— 今年这一段是帮你还是抽你`;
      else if (st) subMoney = `日元【${dmLabel}】${st.verdict} —— 看今年这一段是帮你还是抽你`;

      cards = [
        { icon: "🚪", title: "现在这份工作，我该走还是该留？", sub: subStay,
          prompt: "现在这份工作，我该走还是该留？" },
        { icon: "💰", title: "今年这笔钱，该出手还是该收着？", sub: subMoney,
          prompt: "今年这笔钱，该出手还是该收着？" },
        askCardFor("bazi")
      ];
    }

    const gridEl = document.querySelector(".starter-prompts-grid");
    if (gridEl) {
      gridEl.innerHTML = cards.map(c => `
        <div class="prompt-card${c.fill ? " is-ask" : ""}"${c.fill ? ' data-fill="1"' : ` data-prompt="${escapeHtml(c.prompt)}"`}>
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
  function allSessionStore() {
    try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}") || {}; } catch (e) { return {}; }
  }

  function initSessions() {
    state.sessions = [];
    try {
      const mine = allSessionStore()[state.activeProfileId];
      if (mine && mine.length) {
        state.sessions = mine;
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
    if (!state.activeProfileId) return;
    try {
      const all = allSessionStore();
      all[state.activeProfileId] = state.sessions;
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
    } catch (e) {}
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

  // 排盘引擎能算出唯一正确答案的（干支、四柱、日元、虚岁、大运年龄、应期精度），
  // 在显示之前就地改对。用户要的是一份对的答案，不是一份错答案外加一张勘误表。
  function repairOf(t) {
    try {
      if (!window.ChatEngine || !ChatEngine.repairAnswer || !state.userChart) {
        return { text: t, fixed: [] };
      }
      return ChatEngine.repairAnswer(t, state.userChart, state.kbMode);
    } catch (e) { return { text: t, fixed: [] }; }
  }

  // 把模型的回答和排盘数据对一遍，对不上就挂在答案下面
  function auditOf(t) {
    try {
      if (!window.ChatEngine || !ChatEngine.auditAnswer || !state.userChart) return null;
      const r = ChatEngine.auditAnswer(t, state.userChart, state.kbMode);
      // internal 条目只做内部质量监控，不往界面上放
      const shown = (r || []).filter(function (x) { return !x.internal; });
      return shown.length ? shown : null;
    } catch (e) { return null; }
  }

  // 回答末尾那行追问预判是给按钮用的，不能让它出现在正文里
  function nextSafe(t) {
    return (window.ChatEngine && ChatEngine.stripNextBlock) ? ChatEngine.stripNextBlock(t) : String(t || "");
  }

  /* ---------------- 思考条（DeepSeek 式：折叠一行，点开才看得到推演便签） ---------------- */
  function thinkNotesOf(m) {
    if (m.thinkNotes && m.thinkNotes.length) return m.thinkNotes;
    // 兼容旧消息里存的四步推演
    if (m.reasoningSteps && m.reasoningSteps.length) {
      return m.reasoningSteps.map(function (x) { return x.text; });
    }
    return [];
  }
  function thinkLabelOf(m) {
    // 不报秒数：计时既不准也没意义，只说现在在干什么
    const thinking = m.streaming && !m.content;
    if (m.deep) return thinking ? "正在深度思考…" : "深度思考过程";
    return thinking ? "正在排盘推演…" : "排盘推演过程";
  }
  function thinkBodyHtml(m) {
    // 模型自己的思维链优先，原样呈现（DeepSeek 就是这么做的）
    if (m.deep && m.reasonText) {
      return '<div class="think-reason">' +
        escapeHtml(m.reasonText).replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>") +
        (m.streaming && !m.content ? '<span class="type-caret"></span>' : "") +
        "</div>";
    }
    const notes = thinkNotesOf(m);
    const upto = (m.streaming && !m.content)
      ? Math.min(notes.length, (m.thinkIdx || 0) + 1)
      : notes.length;
    return notes.slice(0, upto).map(function (n) {
      return '<div class="think-line">' + escapeHtml(n) + "</div>";
    }).join("");
  }
  function renderThinkBoxHtml(m) {
    if (!thinkNotesOf(m).length) return "";
    const thinking = m.streaming && !m.content;
    const idAttr = m.streaming ? ' id="active-think-box"' : "";
    return '<details class="think-box' + (thinking ? " is-thinking" : "") + '"' + idAttr +
           (thinking ? " open" : "") + ">" +
      "<summary>" +
        '<span class="think-ico">🧠</span>' +
        '<span class="think-label"' + (m.streaming ? ' id="active-think-label"' : "") + ">" +
          thinkLabelOf(m) + "</span>" +
        '<span class="think-caret">▾</span>' +
      "</summary>" +
      '<div class="think-body"' + (m.streaming ? ' id="active-think-body"' : "") + ">" +
        thinkBodyHtml(m) + "</div>" +
    "</details>";
  }
  // 思考阶段：只改动思考条，不重绘整条消息（重绘会打断滚动与动画）
  function patchThinkBox(m) {
    const body = document.getElementById("active-think-body");
    const lab = document.getElementById("active-think-label");
    if (body) {
      body.innerHTML = thinkBodyHtml(m);
      if (m.deep) body.scrollTop = body.scrollHeight;   // 思维链很长，跟住最新一行
    }
    if (lab) lab.textContent = thinkLabelOf(m);
    scrollBottom(false);
  }
  // 出字阶段：收起思考条，把已收到的内容边下边渲染
  function paintStreaming(m) {
    const box = document.getElementById("active-think-box");
    if (box && box.open) box.open = false;
    const lab = document.getElementById("active-think-label");
    if (lab) lab.textContent = thinkLabelOf(m);
    const ans = document.getElementById("active-answer");
    if (ans) ans.innerHTML = md(nextSafe(m.content)) + '<span class="type-caret"></span>';
    scrollBottom(false);
  }

  function msgHtml(m) {
    if (m.role === "chart-change") {
      return `<div class="chart-change-divider"><span>\u{1F504} ${escapeHtml(m.content)}</span></div>`;
    }
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
    let auditHtml = "";
    if (ai && !m.streaming && m.audit && m.audit.length) {
      // 这条是「点到」在回答生成之后自动拿实盘复核出来的，不是 AI 自己写的。
      // 注意：干支、四柱、日元、虚岁、大运年龄、应期精度这些「算得准」的，
      // 已经在 repairOf 里就地改对了，根本走不到这里 —— 能留到这一步的，
      // 都是改了就会让上下文推理错位的实质问题（编造星曜、星曜落错宫、旺衰讲反）。
      auditHtml = '<div class="audit-strip">' +
        '<div class="audit-head">⚠️ 这 ' + m.audit.length + ' 处请以你的实盘为准</div>' +
        m.audit.map(function (x) {
          return '<div class="audit-item"><s>' + escapeHtml(x.claim) + '</s> 实际是 <b>' +
                 escapeHtml(x.actual) + '</b>' +
                 (x.hint ? '<span class="audit-hint">' + escapeHtml(x.hint) + '</span>' : '') + '</div>';
        }).join("") +
        '<div class="audit-foot">这几条是回答写完后，「点到」拿你的实盘逐条比对出来的，' +
        '不是 AI 自己说的。算得准的（干支、四柱、岁数、时间精度）已经直接改在上面了，' +
        '这里只列改不了的。</div>' + '</div>';
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

    const reasoningHtml = renderThinkBoxHtml(m);
    const bodyHtml = m.streaming
      ? `<div class="ai-final-answer streaming" id="active-answer">${
          m.content
            ? md(nextSafe(m.content)) + '<span class="type-caret"></span>'
            : '<span class="think-dots"><i></i><i></i><i></i></span>'
        }</div>`
      : `<div class="ai-final-answer">${md(m.content)}</div>`;

    return `<div class="message-row ai">
      <div class="message-avatar">✦</div>
      <div class="message-bubble">
        ${reasoningHtml}
        ${bodyHtml}
        ${auditHtml}
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

    roomMsgs.push({ role: "user", content: text, ck: state.chartKey });
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
      localStorage.setItem("diandao_settings", JSON.stringify(state.settings));
      updateEngineBadge();
    }
    state.settings.kbMode = state.kbMode || "ziwei";
    const useLLM = Boolean(state.settings.apiKey && state.settings.apiKey.trim()) && state.settings.provider !== "builtin";

    // 思考便签：只记这次推演真正用到的坐标，几条短句，默认折叠
    const thinkNotes = ChatEngine.buildThinkingNotes
      ? ChatEngine.buildThinkingNotes(text, state.userChart, state.kbMode)
      : [];

    const aiMsg = {
      role: "ai",
      content: "",
      streaming: true,
      ck: state.chartKey,
      kbMode: state.kbMode,
      thinkNotes: thinkNotes,
      thinkIdx: 0
    };
    roomMsgs.push(aiMsg);
    renderMessages(roomMsgs);
    scrollBottom(true);

    const thinkTimer = setInterval(() => {
      if (aiMsg.content || aiMsg.deep) return;         // 出字了、或已有真思维链，就别再放便签
      if (aiMsg.thinkIdx >= thinkNotes.length - 1) return;
      aiMsg.thinkIdx++;
      patchThinkBox(aiMsg);
    }, 420);
    let thinkDone = false;
    const finishThinking = () => {
      if (thinkDone) return;
      thinkDone = true;
      clearInterval(thinkTimer);
      aiMsg.thinkIdx = thinkNotes.length;
    };

    if (useLLM) {
      /* ---------- 大模型：边收边出字 ---------- */
      const history = historyForLLM(roomMsgs, -2); // 已剔除旧命盘时代的对话
      let lastPaint = 0;
      try {
        let lastReasonPaint = 0;
        const full = await ChatEngine.callLiveAPIStream(
          text, state.userChart, history, state.settings,
          (delta, soFar) => {
            if (!aiMsg.content) finishThinking();      // 第一个字落地 = 思考结束
            aiMsg.content = soFar;
            const now = Date.now();
            if (now - lastPaint > 60) { lastPaint = now; paintStreaming(aiMsg); }
          },
          // 模型返回了真正的思维链（deepseek-reasoner 等）
          (rDelta, rSoFar) => {
            if (!aiMsg.deep) {                          // 第一次收到就切成深度思考模式
              aiMsg.deep = true;
              renderMessages(roomMsgs);
            }
            aiMsg.reasonText = rSoFar;
            const now = Date.now();
            if (now - lastReasonPaint > 80) { lastReasonPaint = now; patchThinkBox(aiMsg); }
          }
        );
        finishThinking();
        // 模型把“你接下来最想问什么”写在最后一行，这里拆下来变成按钮
        const sp = ChatEngine.splitFollowups ? ChatEngine.splitFollowups(full) : { text: full, followups: [] };
        // 中途偷偷切过备用厂商的话，要讲清楚 —— 两家模型口径不同，
        // 不说明会让人以为是产品自己变差了
        const foNote = ChatEngine.consumeFailoverNote ? ChatEngine.consumeFailoverNote() : "";
        // 顺序很重要：先按实盘把能算准的地方改对，再拿改过的文本去做出厂检查。
        // 否则会出现「答案里写着错日期、底下再挂一条说这个日期错了」——
        // 用户专门提过这个，说一点都不严谨。
        const rep = repairOf(sp.text);
        aiMsg.repaired = rep.fixed;            // 留档，便于排查模型在哪类数据上老出错
        aiMsg.content = foNote ? ("> \u2139\ufe0f " + foNote + "\n\n" + rep.text) : rep.text;
        aiMsg.streaming = false;
        aiMsg.followups = (sp.followups && sp.followups.length)
          ? sp.followups
          : ChatEngine.followupsFor(text, state.userChart, rep.text, state.kbMode);
        // 出厂检查：只剩下改不了的那些（编造星曜、旺衰讲反等）才会告警
        aiMsg.audit = auditOf(rep.text);
        saveSessions();
        renderMessages(roomMsgs);
        scrollBottom(false);
        sound.chime();
      } catch (err) {
        finishThinking();
        const fb = ChatEngine.composeAnswer(text, state.userChart, history, state.kbMode);
        aiMsg.streaming = false;
        aiMsg.content =
          `> ⚠️ **AI 接口调用失败**：${err.message || "网络或接口异常"}\n` +
          `> 已自动切换为内置推演引擎。点左下角「⚙ 设置 → 测试连接」可以看出到底卡在哪一环。\n\n---\n\n` +
          fb.text;
        aiMsg.tarotWidget = fb.tarotWidget || null;
        aiMsg.followups = (fb.followups && fb.followups.length)
          ? fb.followups
          : ChatEngine.followupsFor(text, state.userChart, fb.text, state.kbMode);
        saveSessions();
        renderMessages(roomMsgs);
        scrollBottom(false);
      }
      return;
    }

    /* ---------- 内置引擎 ---------- */
    try {
      const res = await ChatEngine.generateChatResponse(text, state.userChart, historyForLLM(roomMsgs, -1), state.settings);
      finishThinking();
      aiMsg.content = res.text;
      aiMsg.streaming = false;
      aiMsg.tarotWidget = res.tarotWidget || null;
      aiMsg.followups = (res.followups && res.followups.length)
        ? res.followups
        : ChatEngine.followupsFor(text, state.userChart, res.text, state.kbMode);
      saveSessions();
      renderMessages(roomMsgs);
      scrollBottom(false);
      sound.chime();
    } catch (err) {
      finishThinking();
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
      if (!card) return;
      if (card.dataset.fill) { focusAsk(); return; }
      if (card.dataset.prompt) send(card.dataset.prompt);
    });
    document.querySelector(".quick-tools-row")?.addEventListener("click", e => {
      const chip = e.target.closest(".tool-chip");
      if (chip && chip.dataset.quick) send(chip.dataset.quick);
    });

    const drawer = document.getElementById("chart-drawer");
    // 打开命盘抽屉时，顺手收起手机端的侧边抽屉，避免两层叠在一起
    const open = () => { drawer?.classList.add("open"); toggleMobileSidebar(false); };
    const close = () => {
      if (document.getElementById("drawer-save-bar")?.classList.contains("is-dirty")) {
        if (!confirm("生辰改了还没保存，直接关掉就白改了。\n确定要丢弃这次改动吗？")) return;
        const act = activeProfile();
        if (act) updateChart(act.profile, false);   // 还原成已保存的那份
        renderProfileBar();
      }
      drawer?.classList.remove("open");
    };
    document.getElementById("btn-open-drawer")?.addEventListener("click", open);
    document.getElementById("btn-open-rectify")?.addEventListener("click", () => {
      toggleMobileSidebar(false);
      window.__openRectifyModal();
    });
    document.getElementById("btn-mini-chart-card")?.addEventListener("click", open);

    // 档案切换器
    document.getElementById("btn-profile-switch")?.addEventListener("click", e => {
      e.stopPropagation();
      document.getElementById("profile-menu")?.classList.toggle("open");
    });
    document.getElementById("btn-profile-new")?.addEventListener("click", e => {
      e.stopPropagation();
      createProfile();
    });
    document.getElementById("profile-menu")?.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", closeProfileMenu);
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
    // 只要动过表单就亮起「有改动还没保存」，省得改完日期直接关掉白改
    ["drawer-profile-name", "drawer-birthdate", "drawer-birthtime", "drawer-city",
     "drawer-time-mode", "drawer-range-start", "drawer-range-end", "drawer-gender",
     "drawer-status"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", refreshSaveState);
      document.getElementById(id)?.addEventListener("input", refreshSaveState);
    });

    document.getElementById("btn-save-chart")?.addEventListener("click", () => {
      const d = document.getElementById("drawer-birthdate").value;
      if (!d) { alert("请选择出生日期"); return; }
      const [y, m, dd] = d.split("-").map(Number);
      const tMode = document.getElementById("drawer-time-mode")?.value || "interval";
      const city = document.getElementById("drawer-city")?.value || "默认 (东经120°标准时)";
      const gender = document.getElementById("drawer-gender").value;
      const status = document.getElementById("drawer-status").value;
      const pname = (document.getElementById("drawer-profile-name")?.value || "").trim();
      const act0 = activeProfile();
      if (act0 && pname) act0.name = pname;

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
          rectified: false,
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
          rectified: false,
          city, gender, status
        }, true);
      }
      saveProfiles();
      renderProfileBar();
      markSaveClean();
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
    // 「测试连接」用的是表单里当前填的值，不是已保存的值 —— 这样可以先测再存
    document.getElementById("btn-test-conn")?.addEventListener("click", async () => {
      const box = document.getElementById("settings-test-result");
      const btn = document.getElementById("btn-test-conn");
      if (!box) return;
      const cfg = {
        provider: document.getElementById("settings-provider").value,
        apiKey: document.getElementById("settings-api-key").value.trim(),
        apiEndpoint: document.getElementById("settings-api-endpoint").value.trim(),
        modelName: (document.getElementById("settings-model")?.value || "").trim(),
        deepThink: Boolean(document.getElementById("settings-deep-think")?.checked)
      };
      box.style.display = "block";
      box.textContent = "正在连…";
      if (btn) { btn.disabled = true; btn.textContent = "连接中"; }
      let r;
      try { r = await ChatEngine.testConnection(cfg); }
      catch (e) { r = { ok: false, ms: 0, host: "?", detail: String((e && e.message) || e) }; }
      if (btn) { btn.disabled = false; btn.textContent = "测试连接"; }
      box.innerHTML = r.ok
        ? `✅ <b>${escapeHtml(r.host)}</b> 通了，往返 ${r.ms}ms，模型 <b>${escapeHtml(r.model || "")}</b>。`
        : `❌ <b>${escapeHtml(r.host)}</b> 没通（等了 ${r.ms}ms）<br>${escapeHtml(r.detail || "")}`;
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
      const dtEl = document.getElementById("settings-deep-think");
      state.settings.deepThink = Boolean(dtEl && dtEl.checked);
      const bpEl = document.getElementById("settings-backup-provider");
      const bkEl = document.getElementById("settings-backup-key");
      state.settings.backupProvider = (bpEl && bpEl.value) || "none";
      state.settings.backupApiKey = ((bkEl && bkEl.value) || "").trim();
      localStorage.setItem("diandao_settings", JSON.stringify(state.settings));
      updateEngineBadge();
      closeModal("modal-settings");
      alert("已保存。" + (state.settings.apiKey && state.settings.provider !== "builtin"
        ? `已启用【${state.settings.provider}】大模型实时流式推演！` : "当前使用内置推演引擎。"));
    });

    document.getElementById("btn-clear-history")?.addEventListener("click", () => {
      const who = activeProfile();
      if (confirm(`确定清空「${who ? who.name : "当前档案"}」的全部会话记录？\n（其他档案不受影响）`)) {
        state.sessions = [];
        saveSessions();
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
