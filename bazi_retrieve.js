/* =====================================================================
 * bazi_retrieve.js —— 八字知识库检索器
 * ---------------------------------------------------------------------
 * 与 kb_retrieve.js（紫微）同构：命盘驱动的**精确召回**，不用向量检索。
 *
 * 理由：八字的检索 key 由排盘结果完全确定——日干、月令、命中十神、
 *       五行分布都是硬事实。精确查表比 embedding 更准，且零依赖。
 *
 * ★ 刻意不以「身强身弱 / 用神」作为检索 key。
 *   那是八字流派分歧最大的判断，无法外部验证，判错会让整条链失效。
 *   本检索器改走《窮通寶鑑》调候路线：key = 日干 + 月令，纯客观。
 * ===================================================================== */
(function (global) {
  "use strict";

  function KB() { return global.BaziKB || []; }

  /* 建索引：key -> [entry] */
  var INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = {};
    KB().forEach(function (e) {
      (e.keys || []).forEach(function (k) {
        (INDEX[k] = INDEX[k] || []).push(e);
      });
    });
    return INDEX;
  }
  function byKey(k) { return (index()[k] || []).slice(); }

  /* ---- 近似去重 ----
   * 《窮通寶鑑》的「季节总论」与该季首月专条常为同一段文字的两种抄录
   * （如「三秋丁火，退气柔弱，耑用甲木…」vs「七月丁火，退气柔弱，端用甲木…」）。
   * 两条都塞进 prompt 纯属浪费预算，故用 bigram Jaccard 做近似判重。 */
  function norm(t) { return String(t || "").replace(/[\s，。、；：！？「」『』（）()]/g, ""); }
  function bigrams(t) {
    var set = {}, i;
    for (i = 0; i + 1 < t.length; i++) set[t.substr(i, 2)] = true;
    return set;
  }
  function similar(a, b) {
    var A = bigrams(norm(a).slice(0, 90)), B = bigrams(norm(b).slice(0, 90));
    var ka = Object.keys(A), kb = Object.keys(B);
    if (!ka.length || !kb.length) return 0;
    var inter = 0;
    ka.forEach(function (k) { if (B[k]) inter++; });
    return inter / (ka.length + kb.length - inter);
  }

  /* ---------------- 问题主题 → 检索 key ---------------- */
  var TOPICS = [
    { re: /(感情|婚姻|结婚|恋爱|伴侣|对象|正缘|复合|分手|离婚|暧昧|喜欢|爱情|另一半|老公|老婆|男友|女友|相亲|催婚)/,
      keys: ["六亲:配偶"], spouse: true },
    { re: /(事业|工作|职业|升职|跳槽|创业|老板|领导|职场|前途|发展)/,
      keys: ["十神:正官", "十神:七杀", "十神:正印"] },
    { re: /(钱|财|收入|工资|投资|理财|买房|房子|存款|富|穷|debt|负债)/,
      keys: ["十神:正财", "十神:偏财"] },
    { re: /(孩子|生育|怀孕|子女|儿子|女儿|备孕)/, keys: ["六亲:子女"] },
    { re: /(父母|爸|妈|家里|原生家庭|长辈)/, keys: ["六亲:父", "六亲:母"] },
    { re: /(兄弟|姐妹|朋友|合伙|同事|人际|社交)/,
      keys: ["六亲:兄弟", "十神:比肩", "十神:劫财"] },
    { re: /(性格|脾气|个性|我是(什么|怎样)|自我|内耗|焦虑|情绪|心态)/,
      keys: ["主题:性情"] },
    { re: /(健康|身体|生病|疾病|睡眠|体质)/, keys: ["主题:疾病"] },
    { re: /(今年|明年|流年|运势|大运|走运|转运|什么时候|几时|时机)/,
      keys: ["主题:流年", "主题:大运"] },
    { re: /(学业|考试|考研|读书|升学|才华|创作|表达|艺术)/,
      keys: ["十神:食神", "十神:伤官"] }
  ];

  /**
   * @param a  BaziAnalyzer.analyze() 的结果
   * @param question 用户问题
   * @param gender "male" | "female"
   */
  function retrieve(a, question, gender) {
    if (!a) return [];
    var q = String(question || "");
    var out = [], seen = {}, notes = [];

    function push(e, why) {
      if (!e || seen[e.id]) return;
      for (var i = 0; i < out.length; i++) {
        if (similar(out[i].entry.text, e.text) > 0.55) { seen[e.id] = true; return; }
      }
      seen[e.id] = true;
      out.push({ entry: e, why: why });
    }

    /* ---- 1. 调候：本库主干，永远优先 ---- */
    var dm = a.dayMasterLabel;                 // 「丁火」
    var exact = byKey("调候:" + dm + "|" + a.monthCN);
    if (exact.length) {
      exact.slice(0, 2).forEach(function (e) { push(e, "调候·" + dm + a.monthCN); });
    } else {
      var fb = byKey("调候月fallback:" + dm + "|" + a.monthCN);
      if (fb.length) {
        notes.push("《窮通寶鑑》本版无「" + a.monthCN + dm + "」专条，下列为" + a.season + dm + "季节总论。");
        fb.slice(0, 2).forEach(function (e) { push(e, "调候·" + a.season + dm + "（季节级）"); });
      } else {
        notes.push("《窮通寶鑑》本版既无「" + a.monthCN + dm + "」专条，亦无" + a.season + dm + "季节总论，下列仅为五行总论，颗粒度较粗。");
        byKey("五行总论:" + a.dayMasterWuxing).slice(0, 1)
          .forEach(function (e) { push(e, "五行总论·" + a.dayMasterWuxing); });
      }
    }
    /* 季节总论作为补充（若与上面不重复） */
    byKey("调候季节:" + a.season + dm).slice(0, 1)
      .forEach(function (e) { push(e, "调候季节·" + a.season + dm); });

    /* ---- 2. 主题命中的 key ---- */
    var topicKeys = [], isSpouseTopic = false;
    TOPICS.forEach(function (t) {
      if (t.re.test(q)) {
        topicKeys = topicKeys.concat(t.keys);
        if (t.spouse) isSpouseTopic = true;
      }
    });
    /* 感情类：补上「配偶星」对应的十神论 */
    if (isSpouseTopic) {
      a.spouseGods.forEach(function (g) { topicKeys.push("十神:" + g); });
      if (gender === "female") topicKeys.push("性别:女命");
    }
    /* 无主题命中 → 用命局里最突出的十神 */
    if (!topicKeys.length) {
      topicKeys = a.tenGods.slice(0, 3).map(function (g) { return "十神:" + g; });
      topicKeys.push("主题:性情");
    }

    topicKeys.forEach(function (k) {
      var pool = byKey(k);
      /* 十神类：只取命局中确实出现的，避免答非所问 */
      if (k.indexOf("十神:") === 0) {
        var g = k.slice(3);
        if (a.tenGods.indexOf(g) < 0) return;
      }
      pool.slice(0, 1).forEach(function (e) { push(e, k); });
    });

    /* ---- 3. 命局确实出现、但主题没覆盖到的十神，补 1-2 条 ---- */
    a.tenGods.forEach(function (g) {
      if (out.length >= 11) return;
      byKey("十神:" + g).slice(0, 1).forEach(function (e) { push(e, "命中十神·" + g); });
    });

    return { hits: out.slice(0, 11), notes: notes };
  }

  /* ---------------- 拼成 prompt 区块 ---------------- */
  function toPromptBlock(res, budget) {
    if (!res) return "";
    var hits = res.hits || [], notes = res.notes || [];
    if (!hits.length) return "";
    budget = budget || 1900;
    var per = 340, lines = [], used = 0;
    for (var i = 0; i < hits.length; i++) {
      var e = hits[i].entry;
      var t = e.text;
      if (t.length > per) {
        var cut = t.slice(0, per);
        var stop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"), cut.lastIndexOf("？"));
        if (stop < per * 0.5) stop = cut.lastIndexOf("，");
        t = (stop > per * 0.4 ? cut.slice(0, stop + 1) : cut) + "…";
      }
      var block = "【" + (i + 1) + "】（" + hits[i].why + "）" + e.source + "\n" + t;
      if (used + block.length > budget) break;
      lines.push(block);
      used += block.length;
    }
    var head = notes.length ? notes.map(function (n) { return "※ " + n; }).join("\n") + "\n\n" : "";
    return head + lines.join("\n\n");
  }

  global.BaziKBRetriever = {
    retrieve: retrieve,
    toPromptBlock: toPromptBlock,
    byKey: byKey,
    get size() { return KB().length; }
  };
})(typeof window !== "undefined" ? window : global);
