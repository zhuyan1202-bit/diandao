/* =====================================================================
 * bazi_analyze.js —— 八字分析层
 * ---------------------------------------------------------------------
 * 职责：把已排定的四柱（干支索引）展开成「确定性检索 key」，供 RAG 使用。
 *
 * ★ 设计原则（重要，勿改）：
 *   本模块只计算**无争议的硬事实**：藏干、十神、五行分布、月令、调候坐标。
 *   它**刻意不做**旺衰判断、不取用神、不定格局——那些是八字流派分歧最大
 *   的环节，不同门派结论不同，无法外部验证。一旦判错，下游检索全错。
 *
 *   《窮通寶鑑》按「日干 + 月令」组织（正月甲木 / 二月甲木 …），
 *   这两个值由四柱直接确定，因此走调候这条路可以完全绕开上述争议。
 * ===================================================================== */
(function (global) {
  "use strict";

  var TIANGAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  var DIZHI   = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

  var GAN_WX = { 甲:"木",乙:"木",丙:"火",丁:"火",戊:"土",己:"土",庚:"金",辛:"金",壬:"水",癸:"水" };

  /* 地支藏干（人元司事，通行本）：首位为本气，其后为中气、余气 */
  var HIDDEN = {
    子:["癸"],
    丑:["己","癸","辛"],
    寅:["甲","丙","戊"],
    卯:["乙"],
    辰:["戊","乙","癸"],
    巳:["丙","庚","戊"],
    午:["丁","己"],
    未:["己","丁","乙"],
    申:["庚","壬","戊"],
    酉:["辛"],
    戌:["戊","辛","丁"],
    亥:["壬","甲"]
  };

  /* 五行生克 */
  var WX_REL = {
    木:{ 木:"比", 火:"生", 土:"克", 金:"被克", 水:"被生" },
    火:{ 火:"比", 土:"生", 金:"克", 水:"被克", 木:"被生" },
    土:{ 土:"比", 金:"生", 水:"克", 木:"被克", 火:"被生" },
    金:{ 金:"比", 水:"生", 木:"克", 火:"被克", 土:"被生" },
    水:{ 水:"比", 木:"生", 火:"克", 土:"被克", 金:"被生" }
  };

  function tenGod(dayGan, target) {
    var di = TIANGAN.indexOf(dayGan), ti = TIANGAN.indexOf(target);
    if (di < 0 || ti < 0) return "";
    var same = (di % 2) === (ti % 2);
    var rel = WX_REL[GAN_WX[dayGan]][GAN_WX[target]];
    if (rel === "比")   return same ? "比肩" : "劫财";
    if (rel === "生")   return same ? "食神" : "伤官";
    if (rel === "克")   return same ? "偏财" : "正财";
    if (rel === "被克") return same ? "七杀" : "正官";
    if (rel === "被生") return same ? "偏印" : "正印";
    return "";
  }

  /* 月令：寅=正月 … 丑=十二月 */
  var MONTH_CN = ["正月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
  function monthNumOf(zhiIdx) { return (((zhiIdx - 2) % 12) + 12) % 12 + 1; }  // 1..12
  function seasonOf(monthNum) {
    if (monthNum <= 3) return "三春";
    if (monthNum <= 6) return "三夏";
    if (monthNum <= 9) return "三秋";
    return "三冬";
  }

  /* 十神归类，便于主题检索 */
  var GOD_GROUP = {
    比肩:"比劫", 劫财:"比劫",
    食神:"食伤", 伤官:"食伤",
    正财:"财星", 偏财:"财星",
    正官:"官杀", 七杀:"官杀",
    正印:"印绶", 偏印:"印绶"
  };

  /**
   * @param bz  computeBazi() 的返回值（含 8 个索引）
   * @param gender "male" | "female"
   */
  function analyze(bz, gender) {
    var yG = TIANGAN[bz.yGanIdx], yZ = DIZHI[bz.yZhiIdx];
    var mG = TIANGAN[bz.mGanIdx], mZ = DIZHI[bz.mZhiIdx];
    var dG = TIANGAN[bz.dGanIdx], dZ = DIZHI[bz.dZhiIdx];
    var hG = TIANGAN[bz.hGanIdx], hZ = DIZHI[bz.hZhiIdx];

    var dayMaster = dG;
    var dmWx = GAN_WX[dayMaster];
    var dmYinYang = (bz.dGanIdx % 2 === 0) ? "阳" : "阴";

    /* --- 四柱十神（日干本身为「日主」） --- */
    var pillars = [
      { pos:"年", gan:yG, zhi:yZ, ganGod: tenGod(dayMaster, yG) },
      { pos:"月", gan:mG, zhi:mZ, ganGod: tenGod(dayMaster, mG) },
      { pos:"日", gan:dG, zhi:dZ, ganGod: "日主" },
      { pos:"时", gan:hG, zhi:hZ, ganGod: tenGod(dayMaster, hG) }
    ];

    /* --- 藏干与其十神 --- */
    pillars.forEach(function (p) {
      p.hidden = (HIDDEN[p.zhi] || []).map(function (h, i) {
        return { gan:h, god: tenGod(dayMaster, h), role: i === 0 ? "本气" : (i === 1 ? "中气" : "余气") };
      });
    });

    /* --- 十神清单（含藏干），去重 --- */
    var godsSet = {}, groupsSet = {};
    pillars.forEach(function (p) {
      if (p.ganGod && p.ganGod !== "日主") { godsSet[p.ganGod] = true; }
      p.hidden.forEach(function (h) { if (h.god) godsSet[h.god] = true; });
    });
    var tenGods = Object.keys(godsSet);
    tenGods.forEach(function (g) { if (GOD_GROUP[g]) groupsSet[GOD_GROUP[g]] = true; });

    /* --- 五行分布：天干各计 1，藏干本气 1 / 中气 0.5 / 余气 0.3 --- */
    var wx = { 木:0, 火:0, 土:0, 金:0, 水:0 };
    [yG, mG, dG, hG].forEach(function (g) { wx[GAN_WX[g]] += 1; });
    pillars.forEach(function (p) {
      p.hidden.forEach(function (h, i) {
        wx[GAN_WX[h.gan]] += (i === 0 ? 1 : (i === 1 ? 0.5 : 0.3));
      });
    });
    Object.keys(wx).forEach(function (k) { wx[k] = Math.round(wx[k] * 10) / 10; });

    var wxSorted = Object.keys(wx).sort(function (a, b) { return wx[b] - wx[a]; });
    var missing = Object.keys(wx).filter(function (k) { return wx[k] === 0; });

    /* --- 调候坐标（窮通寶鑑检索 key） --- */
    var mNum = monthNumOf(bz.mZhiIdx);
    var monthCN = MONTH_CN[mNum - 1];
    var season = seasonOf(mNum);

    /* --- 配偶星（男看财、女看官杀） --- */
    var spouseGods = (gender === "female") ? ["正官","七杀"] : ["正财","偏财"];
    var spouseGodPresent = spouseGods.filter(function (g) { return godsSet[g]; });

    return {
      dayMaster: dayMaster,
      dayMasterWuxing: dmWx,
      dayMasterYinYang: dmYinYang,
      dayMasterLabel: dayMaster + dmWx,          // 如「丁火」
      monthZhi: mZ,
      monthNum: mNum,
      monthCN: monthCN,                          // 如「七月」
      season: season,                            // 如「三秋」
      tiaohouKey: dayMaster + dmWx + "|" + monthCN,   // 「丁火|七月」
      seasonKey: season + dayMaster + dmWx,           // 「三秋丁火」
      pillars: pillars,
      tenGods: tenGods,
      tenGodGroups: Object.keys(groupsSet),
      wuxingCount: wx,
      wuxingStrongest: wxSorted[0],
      wuxingWeakest: wxSorted[wxSorted.length - 1],
      wuxingMissing: missing,
      spouseGods: spouseGods,
      spouseGodPresent: spouseGodPresent,
      spouseGodAbsent: spouseGodPresent.length === 0
    };
  }

  /** 人类可读摘要，用于塞进 LLM prompt */
  function toText(a) {
    var L = [];
    L.push("日主：" + a.dayMasterLabel + "（" + a.dayMasterYinYang + "），生于" + a.monthZhi + "月（" + a.season + "·" + a.monthCN + "）");
    L.push("四柱十神：" + a.pillars.map(function (p) {
      var hid = p.hidden.map(function (h) { return h.gan + h.god; }).join("·");
      return p.pos + "柱 " + p.gan + p.zhi + "（干:" + p.ganGod + "｜支藏:" + hid + "）";
    }).join("；"));
    L.push("五行分布：" + Object.keys(a.wuxingCount).map(function (k) {
      return k + a.wuxingCount[k];
    }).join(" ") + "｜最旺 " + a.wuxingStrongest + "｜最弱 " + a.wuxingWeakest +
      (a.wuxingMissing.length ? "｜缺 " + a.wuxingMissing.join("") : "｜五行不缺"));
    L.push("命中十神：" + (a.tenGods.join("、") || "无"));
    L.push("配偶星（" + a.spouseGods.join("/") + "）：" + (a.spouseGodAbsent ? "四柱与藏干中均未现，属配偶星不透" : "已现于命局（" + a.spouseGodPresent.join("、") + "）"));
    return L.join("\n");
  }

  global.BaziAnalyzer = {
    analyze: analyze,
    toText: toText,
    tenGod: tenGod,
    HIDDEN: HIDDEN,
    GAN_WX: GAN_WX
  };
})(typeof window !== "undefined" ? window : global);
