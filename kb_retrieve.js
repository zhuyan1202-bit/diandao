/* ============================================================================
 * kb_retrieve.js —— 典籍知识库检索器（命盘驱动的精确召回）
 *
 * 设计要点：
 *   命理检索的 key 是**确定**的——命盘已算出「夫妻宫坐破军(庙)、对宫廉贞天相」，
 *   因此用精确查表即可，无需向量相似度检索。
 *   这比 embedding 检索更准、零依赖、纯前端可跑。
 *
 * 依赖：knowledge_base.js (global.ZiweiKB)
 * ========================================================================== */
(function (global) {
  "use strict";

  const KB = global.ZiweiKB || [];

  // 按 id / keys 建索引
  const byId = {};
  const byKey = {};
  KB.forEach(function (e) {
    byId[e.id] = e;
    (e.keys || []).forEach(function (k) {
      (byKey[k] = byKey[k] || []).push(e);
    });
  });

  /** 取指定 id 的条目 */
  function get(id) { return byId[id] || null; }

  /** 同时命中多个 key 的条目 */
  function findAll(keys) {
    if (!keys.length) return [];
    let pool = byKey[keys[0]] || [];
    for (let i = 1; i < keys.length; i++) {
      pool = pool.filter(function (e) { return e.keys.indexOf(keys[i]) >= 0; });
    }
    return pool;
  }

  /* ---- 问题主题 → 额外相关宫位 ---- */
  const TOPIC_PALACE = [
    { re: /事业|工作|职业|升职|老板|同事|跳槽/, pal: "官禄宫" },
    { re: /父母|家里|长辈|爸妈|家人反对|催婚/,  pal: "父母宫" },
    { re: /钱|财|收入|经济|买房|彩礼|房子/,     pal: "田宅宫" },
    { re: /朋友|闺蜜|兄弟|同学|third|第三者|小三/, pal: "交友宫" },
    { re: /孩子|生育|怀孕|要不要孩子/,           pal: "子女宫" },
    { re: /心情|焦虑|内耗|抑郁|情绪|开心/,       pal: "福德宫" },
    { re: /异地|出国|搬家|远distance|距离/,      pal: "迁移宫" },
    { re: /身体|健康|生病|失眠/,                 pal: "疾厄宫" }
  ];

  /* 三方四正：本宫 + 对宫 + 两个三合宫（按地支序数算） */
  const BRANCH_ORDER = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  function sanfangPalaces(palaces, pal) {
    if (!pal || !pal.branch || !palaces || !palaces.length) return [];
    const i = BRANCH_ORDER.indexOf(pal.branch);
    if (i < 0) return [];
    const want = [(i + 6) % 12, (i + 4) % 12, (i + 8) % 12];   // 对宫、三合两宫
    const out = [];
    want.forEach(function (k) {
      const p = palaces.filter(function (x) { return x.branch === BRANCH_ORDER[k]; })[0];
      if (p) out.push(p);
    });
    return out;
  }

  /**
   * 根据命盘 + 问题检索典籍原文
   * @param {Object} chart    完整命盘
   * @param {String} question 用户问题
   * @param {Number} budget   字符预算
   * @param {String} focus    本题锁定的宫位名（由 resolveDomainAndPalace 算出）。
   *                          不传则退回关键词匹配。
   * @returns {Array<{id,source,text,why}>}
   *
   * ⚠️ 顺序就是优先级：预算用完就截断，所以**本题宫位必须排在最前**。
   *    老版本无论问什么都先塞夫妻宫，问事业也先读一堆婚恋断语，
   *    而真正相关的宫位被追加在末尾、最先被砍掉。
   */
  function retrieve(chart, question, budget, focus) {
    budget = budget || 3200;               // 字符预算，控制 token
    const picked = [], seen = {};
    const zw = chart.ziwei;
    const palaces = (zw && zw.palaces) || [];
    const q = String(question || "");

    function push(entry, why) {
      if (!entry || seen[entry.id]) return;
      seen[entry.id] = 1;
      picked.push({ id: entry.id, source: entry.source, text: entry.text, why: why });
    }
    function pushAll(list, why, max) {
      (list || []).slice(0, max || 2).forEach(function (e) { push(e, why); });
    }
    function palByName(n) {
      return palaces.filter(function (p) { return p.name === n; })[0] || null;
    }
    function starsOf(p) {
      return ((p && p.mainStars) || []).map(function (s) { return s.name; });
    }

    // 本题宫位：优先用调用方算好的，其次关键词，最后才默认夫妻宫
    let focusName = focus || "";
    if (!focusName) {
      for (let i = 0; i < TOPIC_PALACE.length; i++) {
        if (TOPIC_PALACE[i].re.test(q)) { focusName = TOPIC_PALACE[i].pal; break; }
      }
    }
    if (!focusName) focusName = "夫妻宫";
    const focusPal = palByName(focusName);

    /* 1) 本题宫位主星：断语 + 星总论（最高优先级） */
    if (focusPal) {
      starsOf(focusPal).forEach(function (st) {
        pushAll(findAll([focusName, st]), `本题【${focusName}】坐${st}`, 2);
        push(get(`star.${st}.general`), `${st}星总论（本题宫主星）`);
      });

      /* 2) 本题宫位空宫 → 借对宫 */
      if (focusPal.borrowed || !starsOf(focusPal).length) {
        const opp = sanfangPalaces(palaces, focusPal)[0];
        if (opp) {
          starsOf(opp).forEach(function (st) {
            pushAll(findAll([opp.name, st]), `${focusName}空宫，借对宫【${opp.name}】${st}`, 1);
            push(get(`star.${st}.general`), `${st}星总论（借星）`);
          });
        }
      }

      /* 3) 本题宫位的吉煞星 */
      (focusPal.assistantStars || []).forEach(function (a) {
        pushAll(findAll([focusName, a.name]), `${focusName}会${a.name}`, 1);
        push(get(`star.${a.name}.general`), `${a.name}星总论`);
      });

      /* 4) 三方四正（对宫 + 三合）的主星总论 */
      sanfangPalaces(palaces, focusPal).forEach(function (p) {
        starsOf(p).slice(0, 2).forEach(function (st) {
          push(get(`star.${st}.general`), `三方四正【${p.name}】坐${st}`);
        });
      });
    }

    /* 5) 命宫主星总论（性格底色，任何问题都用得上） */
    const mingStars = (zw.mingPalace && zw.mingPalace.stars || []).map(function (s) { return s.name; });
    mingStars.forEach(function (st) {
      push(get(`star.${st}.general`), `命宫坐${st}`);
      pushAll(findAll(["命宫", st]), `命宫坐${st}`, 1);
    });

    /* 6) 生年四化 */
    const sy = zw.sihuaYear || {};
    ["禄", "权", "科", "忌"].forEach(function (tt) {
      if (sy[tt]) push(get(`star.化${tt}.general`), `生年${sy[tt]}化${tt}`);
    });

    /* 7) 问题里额外点到的宫位（例如问事业时提到了家里） */
    TOPIC_PALACE.forEach(function (tp) {
      if (!tp.re.test(q) || tp.pal === focusName) return;
      const pal = palByName(tp.pal);
      if (!pal) return;
      (pal.mainStars || []).forEach(function (s) {
        pushAll(findAll([tp.pal, s.name]), `问题还涉及${tp.pal}（坐${s.name}）`, 1);
      });
    });

    /* 8) 夫妻宫兜底：本题不是夫妻宫时，只在问题确实涉及感情才补 */
    if (focusName !== "夫妻宫" && /感情|恋爱|对象|结婚|伴侣|另一半|喜欢|暧昧|分手|复合|婚/.test(q)) {
      const fq = zw.spousePalace;
      ((fq && fq.mainStarNames) || []).forEach(function (st) {
        pushAll(findAll(["夫妻宫", st]), `问题涉及感情，补夫妻宫坐${st}`, 1);
      });
    }

    /* 9) 裁剪到预算内 */
    const out = [];
    let used = 0;
    for (const e of picked) {
      let txt = e.text;
      if (txt.length > 420) txt = txt.slice(0, 420) + "…";
      if (used + txt.length > budget) continue;
      used += txt.length;
      out.push({ id: e.id, source: e.source, text: txt, why: e.why });
      if (out.length >= 14) break;
    }
    return out;
  }

  /** 渲染成可直接塞进 prompt 的文本块 */
  function toPromptBlock(items) {
    if (!items || !items.length) return "";
    return items.map(function (e, i) {
      return `【${i + 1}】（${e.why}）${e.source}\n${e.text}`;
    }).join("\n\n");
  }

  global.ZiweiKBRetriever = {
    retrieve, toPromptBlock, get, findAll,
    size: KB.length
  };
})(typeof window !== "undefined" ? window : this);
