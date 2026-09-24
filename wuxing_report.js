/* ============================================================
 * 五行报告 + 今日建议
 * ------------------------------------------------------------
 * 用户原话：「五行强弱可以基于大家填完的八字生成一个报告，
 *           给大家点日常建议，比如每日穿搭」。
 *
 * 全部是纯计算，不调大模型 —— 所以不会 failed、不会编、每次打开都一样。
 * 「今日」部分用的是当天真实的日柱（getCurrentTimeAnchor），每天会变。
 *
 * 依赖：ChatEngine.baziStrength（旺衰 + 喜忌）、ChatEngine.getCurrentTimeAnchor
 * ============================================================ */
(function (global) {
  "use strict";

  const WX = ["木", "火", "土", "金", "水"];
  const GANWX = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
  const YANG = { 甲: 1, 丙: 1, 戊: 1, 庚: 1, 壬: 1 };
  const ZHIWX = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
  const SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };   // A 生 SHENG[A]
  const KE    = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };   // A 克 KE[A]

  /* ---------- 五行 → 人话 ---------- */
  const TRAIT = {
    木: { core: "有想法、有韧劲，喜欢往上长、往外扩",
          over: "容易固执、心急，想做的事太多，一下铺太开",
          lack: "起步慢，缺一点规划感和「先干起来」的冲劲" },
    火: { core: "热情、会表达、有感染力，情绪来得快",
          over: "容易急躁上头，话说快了收不回来，热度来得快去得也快",
          lack: "表达偏收着，缺一点动力和被人看见的主动" },
    土: { core: "稳、靠谱、能扛事，别人愿意把事交给你",
          over: "容易保守、想太多、慢半拍，心里憋事不说",
          lack: "安全感偏弱，缺定性，容易被外界带着走" },
    金: { core: "果断、讲原则、执行力强，说到做到",
          over: "容易强硬较真、嘴上不饶人，对自己和别人都狠",
          lack: "做决定容易犹豫，心软，不太会拒绝人" },
    水: { core: "聪明、灵活、会变通，脑子转得快",
          over: "容易想太多、定不下来，夜里睡不着那种",
          lack: "弹性不够，遇事容易钻牛角尖、转不过弯" }
  };
  const COLOR = { 木: ["绿", "青", "草木色"], 火: ["红", "橙", "紫", "粉"], 土: ["米", "卡其", "咖", "黄"],
                  金: ["白", "银灰", "香槟金"], 水: ["黑", "深蓝", "藏青", "深灰"] };
  const DIR   = { 木: "东边", 火: "南边", 土: "居中", 金: "西边", 水: "北边" };
  const BOOST = {   // 日常怎么补这个五行 —— 只写普通人今天就能做到的
    木: ["多走路、去有树的地方", "早点起，上午做最重要的事", "看书、学点新东西"],
    火: ["晒太阳、做点出汗的运动", "主动找人聊天、表达想法", "屋里灯开亮一点"],
    土: ["按时吃饭、作息规律", "整理房间和桌面", "做一件需要耐心的小事，做完它"],
    金: ["把待办清单列出来，一条条勾掉", "断舍离，扔掉用不上的东西", "做决定前给自己定个截止时间"],
    水: ["多喝水、泡澡、游泳", "留一段独处放空的时间", "睡够，别熬夜"]
  };

  /* ---------- 十神（今天的日干对你的日元是什么关系）→ 今天宜做什么 ---------- */
  function tenGod(dm, g) {
    const a = GANWX[dm], b = GANWX[g], same = (!!YANG[dm]) === (!!YANG[g]);
    if (a === b)          return same ? "比肩" : "劫财";
    if (SHENG[a] === b)   return same ? "食神" : "伤官";
    if (KE[a] === b)      return same ? "偏财" : "正财";
    if (KE[b] === a)      return same ? "七杀" : "正官";
    if (SHENG[b] === a)   return same ? "偏印" : "正印";
    return "";
  }
  const DAY_THEME = {
    比肩: { tag: "同伴日",   yi: ["找朋友或同事一起推进一件事", "运动"],               ji: ["跟人较劲争输赢", "冲动消费"] },
    劫财: { tag: "同伴日",   yi: ["和人合作分工", "运动出汗"],                         ji: ["借钱给人或替人担保", "冲动消费"] },
    食神: { tag: "放松日",   yi: ["吃顿好的", "做自己喜欢的事", "写点东西、做点作品"], ji: ["硬逼自己加班", "开会吵架"] },
    伤官: { tag: "表达日",   yi: ["提想法、做方案", "做创作类的事"],                   ji: ["顶撞领导或长辈", "在群里说气话"] },
    正财: { tag: "理财日",   yi: ["处理账单、记账", "谈价格、签小额合同"],             ji: ["大额冲动购物"] },
    偏财: { tag: "机会日",   yi: ["见客户、社交", "留意新机会和信息"],                 ji: ["赌一把的投资"] },
    正官: { tag: "正事日",   yi: ["按流程办手续", "向领导汇报"],                       ji: ["迟到、违规、抄近路"] },
    七杀: { tag: "攻坚日",   yi: ["啃最难的那块任务", "做需要魄力的决定"],             ji: ["跟人硬碰硬", "情绪化回复消息"] },
    正印: { tag: "充电日",   yi: ["学习、看书、上课", "请教长辈或前辈"],               ji: ["把自己日程排太满"] },
    偏印: { tag: "独处日",   yi: ["独处想清楚一件事", "研究冷门的东西"],               ji: ["勉强自己去热闹的社交"] }
  };

  /* ---------- 喜忌：扶抑判不出（中和）时退回调候，再退回补最弱、泄最旺 ---------- */
  function favorAvoid(st, cnt) {
    let favor = (st && st.favor) ? st.favor.slice() : [];
    let avoid = (st && st.avoid) ? st.avoid.slice() : [];
    const sorted = WX.slice().sort(function (a, b) { return (cnt[b] || 0) - (cnt[a] || 0); });
    const strongest = sorted[0], weakest = sorted[4];
    // 调候优先：夏生缺水、冬生缺火，这条压过扶抑
    const th = st && st.tiaohou ? (/【(.)】/.exec(st.tiaohou) || [])[1] : "";
    if (th) {
      favor = [th].concat(favor.filter(function (w) { return w !== th; }));
      avoid = avoid.filter(function (w) { return w !== th; });
    }
    // 中和盘扶抑给不出喜忌：取最弱的两行来补。只给一行的话，
    // 「今日穿搭」永远是同一个颜色 —— 等于假装每天在变。
    if (!favor.length) favor = sorted.slice(3).reverse();
    if (favor.length < 2) {
      const more = sorted.slice().reverse().filter(function (w) { return favor.indexOf(w) < 0 && w !== strongest; });
      if (more.length) favor.push(more[0]);
    }
    if (!avoid.length) avoid = [strongest].filter(function (w) { return favor.indexOf(w) < 0; });
    return { favor: favor, avoid: avoid, strongest: strongest, weakest: weakest, tiaohou: th };
  }

  /* ---------- 今日打分用 ---------- */
  const LUCKY_NUM = { 水: [1, 6], 火: [2, 7], 木: [3, 8], 金: [4, 9], 土: [5, 0] };   // 河图数
  const LIUHE = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
  const CHONG = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };

  /* ---------- 旺衰 → 人话 ---------- */
  const VERDICT_PLAIN = {
    身强: "你底气足，自己就能扛事 —— 需要的是把力气用出去，而不是再给自己加码",
    偏强: "你底气偏足，大多数事自己能扛 —— 适合主动出击，别闷着",
    中和: "你整体比较平衡，没有特别缺的 —— 关键是哪头偏了及时补哪头",
    偏弱: "你底气偏薄，容易被外界消耗 —— 先把自己照顾好，再去对外",
    身弱: "你比较容易累、容易被带着走 —— 身边的支持和规律的节奏对你特别重要"
  };

  /* ============================================================
   * 主函数
   * chart   : analyzeFullNatalChart 的结果
   * anchor  : 可选，默认取当前真实时间（测试时可传固定值）
   * ============================================================ */
  function build(chart, anchor) {
    const CE = global.ChatEngine;
    if (!chart || !chart.bazi || !chart.bazi.dayMaster || !CE) return null;
    const b = chart.bazi;
    const dm = b.dayMaster, dmWx = GANWX[dm];
    const cnt = (b.detail && b.detail.wuxingCount) || {};
    const st = CE.baziStrength ? CE.baziStrength(chart) : null;
    const fa = favorAvoid(st, cnt);

    const total = WX.reduce(function (s, w) { return s + (+cnt[w] || 0); }, 0) || 1;
    const bars = WX.map(function (w) {
      const v = +cnt[w] || 0;
      return { wx: w, value: Math.round(v * 10) / 10, pct: Math.round(v / total * 100),
               level: v === 0 ? "缺" : (w === fa.strongest ? "最旺" : (w === fa.weakest ? "最弱" : "")) };
    });

    /* ---------- 固定的五行报告 ---------- */
    const report = {
      dayMaster: dm + dmWx,
      verdict: st ? st.verdict : "中和",
      verdictPlain: VERDICT_PLAIN[st ? st.verdict : "中和"],
      bars: bars,
      core: TRAIT[dmWx].core,                       // 你本人（日元）是哪个五行
      over: TRAIT[fa.strongest].over,               // 最旺那一行多了会怎样
      lack: (+cnt[fa.weakest] || 0) < 0.5 ? TRAIT[fa.weakest].lack : "",
      strongest: fa.strongest, weakest: fa.weakest,
      favor: fa.favor, avoid: fa.avoid,
      boost: fa.favor.slice(0, 2).map(function (w) { return { wx: w, how: BOOST[w] }; }),
      colors: { good: fa.favor.slice(0, 2).map(function (w) { return { wx: w, c: COLOR[w] }; }),
                bad:  fa.avoid.slice(0, 1).map(function (w) { return { wx: w, c: COLOR[w] }; }) },
      dir: fa.favor.length ? DIR[fa.favor[0]] : ""
    };

    /* ---------- 今日建议：拿今天的日柱对照你的喜忌 ---------- */
    const t = anchor || (CE.getCurrentTimeAnchor ? CE.getCurrentTimeAnchor() : null);
    let today = null;
    if (t && t.dPillar) {
      const dg = t.dPillar.charAt(0), dz = t.dPillar.charAt(1);
      const dWx = [GANWX[dg], ZHIWX[dz]];
      // 今日分数：每一分都能说出来源，不加随机数。
      //   日干（天上的气）±9，日支（脚下的气）±11 —— 地支是当天真正落地的那股力量，权重略高；
      //   日支和你本命日支（亲密关系、身体那一柱）六合 +5、相冲 −8。
      let score = 68;
      const why = [];
      const gw = dWx[0], zw = dWx[1];
      if (fa.favor.indexOf(gw) >= 0)      { score += 9;  why.push("今天上层的气是" + gw + "，正好是你需要的"); }
      else if (fa.avoid.indexOf(gw) >= 0) { score -= 9;  why.push("今天上层的气是" + gw + "，偏耗你"); }
      if (fa.favor.indexOf(zw) >= 0)      { score += 11; why.push("今天落地的气是" + zw + "，给你撑腰"); }
      else if (fa.avoid.indexOf(zw) >= 0) { score -= 11; why.push("今天落地的气是" + zw + "，拖你后腿"); }
      const myZhi = String(b.dayPillar || "").charAt(1);
      if (myZhi && LIUHE[dz] === myZhi)      { score += 5; why.push("今天和你合得来，人缘顺、事好谈"); }
      else if (myZhi && CHONG[dz] === myZhi) { score -= 8; why.push("今天冲你，容易临时变卦、和亲近的人磕碰"); }
      if (!why.length) why.push("今天的气跟你不帮也不耗");
      score = Math.max(35, Math.min(95, score));
      const mood = score >= 78 ? "顺" : (score <= 60 ? "耗" : "平");
      const god = tenGod(dm, dg);
      const theme = DAY_THEME[god] || { tag: "", yi: [], ji: [] };

      // 今天的重点色：如果今天的气偏向你忌的五行，挑一个能「克住」或「泄掉」它的喜用色；
      // 否则就用你的第一喜用色。这样穿搭建议每天真的会跟着变，而不是一张固定色卡。
      //   ① 今天带着你忌的五行 → 挑一个能克住或泄掉它的喜用色
      //   ② 今天本身已经带着你的第一喜用 → 天时已经给了，穿搭去补第二喜用
      //   ③ 否则 → 第一喜用
      const badToday = dWx.filter(function (w) { return fa.avoid.indexOf(w) >= 0; });
      let key = fa.favor[0];
      let counter = [];
      if (badToday.length) {
        const bw = badToday[0];
        counter = fa.favor.filter(function (w) { return KE[w] === bw || SHENG[bw] === w; });
      }
      if (counter.length) key = counter[0];
      else if (dWx.indexOf(fa.favor[0]) >= 0 && fa.favor[1]) key = fa.favor[1];
      const accent = fa.favor.filter(function (w) { return w !== key; })[0] || "";
      today = {
        date: t.solarDateOnly || "", pillar: t.dPillar, wx: dWx,
        mood: mood,
        moodPlain: mood === "顺" ? "今天的气偏向帮你，适合推进要紧的事"
                 : mood === "耗" ? "今天的气偏向耗你，节奏放慢，重要决定能拖就拖一天"
                 : "今天不帮也不耗，按自己的节奏来就好",
        tag: theme.tag, yi: theme.yi, ji: theme.ji,
        wear: { main: { wx: key, c: COLOR[key] },
                accent: accent ? { wx: accent, c: COLOR[accent] } : null,
                avoid: fa.avoid.length ? { wx: fa.avoid[0], c: COLOR[fa.avoid[0]] } : null },
        dir: DIR[key],
        score: score, why: why,
        lucky: { color: COLOR[key][0], num: LUCKY_NUM[key], dir: DIR[key] }
      };
    }
    return { report: report, today: today };
  }

  global.WuxingReport = { build: build, tenGod: tenGod, _favorAvoid: favorAvoid };
})(typeof window !== "undefined" ? window : this);
