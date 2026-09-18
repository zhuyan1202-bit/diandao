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

  /**
   * 根据命盘 + 问题检索典籍原文
   * @returns {Array<{id,source,text,why}>}
   */
  function retrieve(chart, question, budget) {
    budget = budget || 3200;               // 字符预算，控制 token
    const picked = [], seen = {};
    const zw = chart.ziwei;

    function push(entry, why) {
      if (!entry || seen[entry.id]) return;
      seen[entry.id] = 1;
      picked.push({ id: entry.id, source: entry.source, text: entry.text, why: why });
    }
    function pushAll(list, why, max) {
      (list || []).slice(0, max || 2).forEach(function (e) { push(e, why); });
    }

    const fq = zw.spousePalace;
    const spouseStars = fq.mainStarNames || [];
    const mingStars = (zw.mingPalace && zw.mingPalace.stars || []).map(function (s) { return s.name; });

    /* 1) 夫妻宫主星：总论 + 妻妾宫断语（最高优先级） */
    spouseStars.forEach(function (st) {
      pushAll(findAll(["夫妻宫", st]), `夫妻宫坐${st}`, 2);
      push(get(`star.${st}.general`), `${st}星总论`);
    });

    /* 2) 夫妻宫空宫 → 借对宫（官禄宫）主星 */
    if (fq.borrowed) {
      spouseStars.forEach(function (st) {
        pushAll(findAll(["官禄宫", st]), `夫妻宫空宫，借对宫${st}`, 1);
      });
    }

    /* 3) 命宫主星总论 */
    mingStars.forEach(function (st) {
      push(get(`star.${st}.general`), `命宫坐${st}`);
      pushAll(findAll(["命宫", st]), `命宫坐${st}`, 1);
    });

    /* 4) 夫妻宫的吉煞星 */
    (fq.assistantStars || []).forEach(function (a) {
      pushAll(findAll(["夫妻宫", a.name]), `夫妻宫会${a.name}`, 1);
      push(get(`star.${a.name}.general`), `${a.name}星总论`);
    });

    /* 5) 生年四化 */
    const sy = zw.sihuaYear || {};
    ["禄", "权", "科", "忌"].forEach(function (t) {
      if (sy[t]) push(get(`star.化${t}.general`), `生年${sy[t]}化${t}`);
    });

    /* 6) 依问题主题追加宫位断语 */
    const q = String(question || "");
    TOPIC_PALACE.forEach(function (tp) {
      if (!tp.re.test(q)) return;
      const pal = zw.palaces && zw.palaces.filter(function (p) { return p.name === tp.pal; })[0];
      if (!pal) return;
      pal.mainStars.forEach(function (s) {
        pushAll(findAll([tp.pal, s.name]), `问题涉及${tp.pal}（坐${s.name}）`, 1);
      });
    });

    /* 7) 裁剪到预算内 */
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
