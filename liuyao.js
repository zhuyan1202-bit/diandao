/* =============================================================
 *  点到 · 六爻装卦引擎（liuyao.js）
 *
 *  只做「排出来就是确定的」那部分：
 *    摇钱 → 本卦/变卦 → 纳甲 → 八宫与世应 → 六亲 → 六神 → 旬空
 *    → 月建、日辰对每一爻的作用 → 伏神 → 动爻回头生克
 *  判断吉凶、定应期交给 AI —— 但 AI 只准引用这里排好的数据，不准自己重装卦。
 *
 *  约定：lines[0] 是初爻（最下面），lines[5] 是上爻。1 = 阳，0 = 阴。
 *  钱法：三枚铜钱，「背」记 3、「字」记 2：
 *    三背 = 9 老阳（动，阳变阴）  一背 = 7 少阳
 *    两背 = 8 少阴               三字 = 6 老阴（动，阴变阳）
 * ============================================================= */
(function (global) {
  "use strict";

  const GAN = "甲乙丙丁戊己庚辛壬癸";
  const ZHI = "子丑寅卯辰巳午未申酉戌亥";
  const ZHI_WX = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"];
  const SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };   // A 生 SHENG[A]
  const KE    = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };   // A 克 KE[A]

  // 八卦：键是 初-中-上 三爻（1 阳 0 阴）
  const TRI = {
    "111": { name: "乾", img: "天", wx: "金", inG: "甲", outG: "壬", inZ: "子寅辰", outZ: "午申戌" },
    "110": { name: "兑", img: "泽", wx: "金", inG: "丁", outG: "丁", inZ: "巳卯丑", outZ: "亥酉未" },
    "101": { name: "离", img: "火", wx: "火", inG: "己", outG: "己", inZ: "卯丑亥", outZ: "酉未巳" },
    "100": { name: "震", img: "雷", wx: "木", inG: "庚", outG: "庚", inZ: "子寅辰", outZ: "午申戌" },
    "011": { name: "巽", img: "风", wx: "木", inG: "辛", outG: "辛", inZ: "丑亥酉", outZ: "未巳卯" },
    "010": { name: "坎", img: "水", wx: "水", inG: "戊", outG: "戊", inZ: "寅辰午", outZ: "申戌子" },
    "001": { name: "艮", img: "山", wx: "土", inG: "丙", outG: "丙", inZ: "辰午申", outZ: "戌子寅" },
    "000": { name: "坤", img: "地", wx: "土", inG: "乙", outG: "癸", inZ: "未巳卯", outZ: "丑亥酉" }
  };
  const TRI_ORDER = ["111", "110", "101", "100", "011", "010", "001", "000"];   // 乾兑离震巽坎艮坤

  // 六十四卦名：行 = 上卦，列 = 下卦，顺序同 TRI_ORDER
  const NAMES = [
    ["乾为天", "天泽履", "天火同人", "天雷无妄", "天风姤", "天水讼", "天山遯", "天地否"],
    ["泽天夬", "兑为泽", "泽火革", "泽雷随", "泽风大过", "泽水困", "泽山咸", "泽地萃"],
    ["火天大有", "火泽睽", "离为火", "火雷噬嗑", "火风鼎", "火水未济", "火山旅", "火地晋"],
    ["雷天大壮", "雷泽归妹", "雷火丰", "震为雷", "雷风恒", "雷水解", "雷山小过", "雷地豫"],
    ["风天小畜", "风泽中孚", "风火家人", "风雷益", "巽为风", "风水涣", "风山渐", "风地观"],
    ["水天需", "水泽节", "水火既济", "水雷屯", "水风井", "坎为水", "水山蹇", "水地比"],
    ["山天大畜", "山泽损", "山火贲", "山雷颐", "山风蛊", "山水蒙", "艮为山", "山地剥"],
    ["地天泰", "地泽临", "地火明夷", "地雷复", "地风升", "地水师", "地山谦", "坤为地"]
  ];

  // 八宫卦序：本宫 → 一世…五世 → 游魂 → 归魂，顺手记下世爻位置
  const PALACE = {};
  TRI_ORDER.forEach(function (k) {
    const base = (k + k).split("").map(Number);
    const cur = base.slice();
    const put = function (shi, gen) { PALACE[cur.join("")] = { palace: k, shi: shi, gen: gen }; };
    put(6, "本宫卦");
    for (let g = 1; g <= 5; g++) { cur[g - 1] ^= 1; put(g, ["", "一世卦", "二世卦", "三世卦", "四世卦", "五世卦"][g]); }
    cur[3] ^= 1; put(4, "游魂卦");
    for (let i = 0; i < 3; i++) cur[i] = base[i];
    put(3, "归魂卦");
  });

  const GODS = ["青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武"];
  const GOD_START = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
  const POS_NAME = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
  const KINS = ["父母", "兄弟", "子孙", "妻财", "官鬼"];

  function kinOf(palaceWx, wx) {
    if (wx === palaceWx) return "兄弟";
    if (SHENG[palaceWx] === wx) return "子孙";
    if (SHENG[wx] === palaceWx) return "父母";
    if (KE[palaceWx] === wx) return "妻财";
    return "官鬼";
  }
  function isChong(a, b) { return Math.abs(ZHI.indexOf(a) - ZHI.indexOf(b)) === 6; }
  function isHe(a, b) { return (ZHI.indexOf(a) + ZHI.indexOf(b)) % 12 === 1; }
  // 月建对这一爻：旺相休囚死
  function seasonState(monthZhi, wx) {
    const m = ZHI_WX[ZHI.indexOf(monthZhi)];
    if (m === wx) return "旺";
    if (SHENG[m] === wx) return "相";
    if (SHENG[wx] === m) return "休";
    if (KE[wx] === m) return "囚";
    return "死";
  }
  // 日辰对这一爻：冲 / 合 / 生 / 克 / 比
  function dayRelation(dayZhi, zhi) {
    const d = ZHI_WX[ZHI.indexOf(dayZhi)], w = ZHI_WX[ZHI.indexOf(zhi)];
    const out = [];
    if (dayZhi === zhi) out.push("临日");
    else if (isChong(dayZhi, zhi)) out.push("日冲");
    else if (isHe(dayZhi, zhi)) out.push("日合");
    if (dayZhi !== zhi) {
      if (SHENG[d] === w) out.push("日生");
      else if (KE[d] === w) out.push("日克");
      else if (d === w) out.push("日比");
    }
    return out;
  }
  function xunKong(dayPillar) {
    const g = GAN.indexOf(dayPillar.charAt(0)), z = ZHI.indexOf(dayPillar.charAt(1));
    if (g < 0 || z < 0) return [];
    const start = (z - g + 12) % 12;               // 这一旬「甲」落在哪个地支
    return [ZHI[(start + 10) % 12], ZHI[(start + 11) % 12]];
  }

  function hexOf(lines) {
    const lo = lines.slice(0, 3).join(""), up = lines.slice(3).join("");
    const pal = PALACE[lines.join("")];
    return {
      key: lines.join(""),
      name: NAMES[TRI_ORDER.indexOf(up)][TRI_ORDER.indexOf(lo)],
      upper: TRI[up].name, lower: TRI[lo].name,
      palace: TRI[pal.palace].name, palaceWx: TRI[pal.palace].wx,
      gen: pal.gen, shi: pal.shi, ying: pal.shi > 3 ? pal.shi - 3 : pal.shi + 3,
      najia: lines.map(function (_, i) {
        const t = i < 3 ? TRI[lo] : TRI[up];
        const stem = i < 3 ? t.inG : t.outG;
        const zhi = (i < 3 ? t.inZ : t.outZ).charAt(i % 3);
        return { stem: stem, zhi: zhi, wx: ZHI_WX[ZHI.indexOf(zhi)] };
      })
    };
  }

  // 摇一次：三枚钱，返回 { coins: [1,0,1]（1 = 背）, sum }
  function tossOnce() {
    const r = new Uint8Array(3);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(r);
    else for (let i = 0; i < 3; i++) r[i] = Math.floor(Math.random() * 256);
    const coins = Array.from(r, function (x) { return x & 1; });
    const backs = coins.reduce(function (a, b) { return a + b; }, 0);
    return { coins: coins, sum: backs * 3 + (3 - backs) * 2 };
  }
  const SUM_LABEL = { 6: "老阴 ×（动）", 7: "少阳", 8: "少阴", 9: "老阳 ○（动）" };

  // 按问题类别定用神
  function yongShenFor(category, gender) {
    const loveKin = gender === "male" ? "妻财" : "官鬼";
    const loveWhy = gender === "male" ? "男问感情以妻财为对象" : "女问感情以官鬼为对象";
    switch (category) {
      case "job":       return { kin: "官鬼", why: "问工作、offer、面试以官鬼为用神（职位、录用方）；世爻为自己，应爻为对方公司" };
      case "single":    return { kin: loveKin, why: loveWhy + "；世爻为自己，看对象星何时有力、何时与世爻生合" };
      case "marry":     return { kin: loveKin, why: loveWhy + "；应爻为对方，世应生合为有缘；婚书看父母" };
      case "reconcile": return { kin: loveKin, why: loveWhy + "；应爻为对方，看世应、用神有无回头之象" };
      case "money":     return { kin: "妻财", why: "问钱财、投资、回款以妻财为用神；兄弟为劫财之神" };
      case "exam":      return { kin: "父母", why: "问考试以父母为用神（试卷、文书、录取通知），官鬼为名次、功名" };
      default:          return { kin: "", why: "类别未定，按问题内容自行取用神并说明理由" };
    }
  }

  /**
   * 装卦
   * @param sums   6 个数（6/7/8/9），sums[0] 是初爻
   * @param anchor { mPillar, dPillar }（起卦时刻的月柱、日柱）
   */
  function build(sums, anchor, opts) {
    opts = opts || {};
    const benLines = sums.map(function (s) { return (s === 7 || s === 9) ? 1 : 0; });
    const moving = sums.map(function (s) { return s === 6 || s === 9; });
    const hasMove = moving.some(Boolean);
    const bianLines = benLines.map(function (v, i) { return moving[i] ? 1 - v : v; });

    const ben = hexOf(benLines);
    const bian = hasMove ? hexOf(bianLines) : null;
    const monthZhi = (anchor.mPillar || "").charAt(1);
    const dayZhi = (anchor.dPillar || "").charAt(1);
    const dayGan = (anchor.dPillar || "").charAt(0);
    const kong = xunKong(anchor.dPillar || "");
    const godStart = GOD_START[dayGan] !== undefined ? GOD_START[dayGan] : 0;

    const lines = benLines.map(function (yang, i) {
      const nj = ben.najia[i];
      const ln = {
        pos: i + 1, posName: POS_NAME[i], yang: !!yang, sum: sums[i], moving: moving[i],
        god: GODS[(godStart + i) % 6],
        stem: nj.stem, zhi: nj.zhi, wx: nj.wx, kin: kinOf(ben.palaceWx, nj.wx),
        shi: ben.shi === i + 1, ying: ben.ying === i + 1,
        season: monthZhi ? seasonState(monthZhi, nj.wx) : "",
        yuePo: monthZhi ? isChong(monthZhi, nj.zhi) : false,
        yueHe: monthZhi ? isHe(monthZhi, nj.zhi) : false,
        linYue: monthZhi === nj.zhi,
        day: dayZhi ? dayRelation(dayZhi, nj.zhi) : [],
        kong: kong.indexOf(nj.zhi) >= 0
      };
      if (moving[i] && bian) {
        const bj = bian.najia[i];
        const hua = [];
        if (SHENG[bj.wx] === nj.wx) hua.push("回头生");
        else if (KE[bj.wx] === nj.wx) hua.push("回头克");
        else if (SHENG[nj.wx] === bj.wx) hua.push("化泄");
        else if (KE[nj.wx] === bj.wx) hua.push("化克出");
        else hua.push("化比和");
        // 同五行地支前进 / 后退（寅→卯 进，卯→寅 退；辰戌丑未按顺序：丑→辰→未→戌 为进）
        if (bj.wx === nj.wx) {
          const ORDER = { 木: "寅卯", 火: "巳午", 金: "申酉", 水: "亥子", 土: "丑辰未戌" };
          const o = ORDER[nj.wx] || "";
          const a = o.indexOf(nj.zhi), b = o.indexOf(bj.zhi);
          if (a >= 0 && b >= 0 && a !== b) hua.push(b > a ? "化进神" : "化退神");
        }
        if (kong.indexOf(bj.zhi) >= 0) hua.push("化空");
        if (monthZhi && isChong(monthZhi, bj.zhi)) hua.push("化月破");
        if (isChong(nj.zhi, bj.zhi)) hua.push("反吟（冲）");
        ln.bian = { stem: bj.stem, zhi: bj.zhi, wx: bj.wx, kin: kinOf(ben.palaceWx, bj.wx), yang: !!bianLines[i], hua: hua };
      }
      return ln;
    });

    // 伏神：本卦里缺哪个六亲，就到本宫纯卦同一爻位去找
    const present = {};
    lines.forEach(function (l) { present[l.kin] = true; });
    const fushen = [];
    const missing = KINS.filter(function (k) { return !present[k]; });
    if (missing.length) {
      const pureKey = Object.keys(PALACE).find(function (k) { return PALACE[k].gen === "本宫卦" && TRI[PALACE[k].palace].name === ben.palace; });
      const pure = hexOf(pureKey.split("").map(Number));
      pure.najia.forEach(function (nj, i) {
        const k = kinOf(ben.palaceWx, nj.wx);
        if (missing.indexOf(k) >= 0) {
          fushen.push({ pos: i + 1, posName: POS_NAME[i], kin: k, stem: nj.stem, zhi: nj.zhi, wx: nj.wx,
                        underKin: lines[i].kin, underZhi: lines[i].zhi, kong: kong.indexOf(nj.zhi) >= 0 });
        }
      });
    }

    // 六冲卦 / 六合卦（内外卦对应爻两两相冲或相合）
    let pattern = "";
    const allPair = function (fn) { return [0, 1, 2].every(function (i) { return fn(ben.najia[i].zhi, ben.najia[i + 3].zhi); }); };
    if (allPair(isChong)) pattern = "六冲卦";
    else if (allPair(isHe)) pattern = "六合卦";

    return {
      sums: sums.slice(),
      ben: { name: ben.name, upper: ben.upper, lower: ben.lower, palace: ben.palace, palaceWx: ben.palaceWx,
             gen: ben.gen, shi: ben.shi, ying: ben.ying, pattern: pattern },
      bian: bian ? { name: bian.name, upper: bian.upper, lower: bian.lower, palace: bian.palace, gen: bian.gen } : null,
      lines: lines, fushen: fushen,
      monthZhi: monthZhi, dayPillar: anchor.dPillar || "", mPillar: anchor.mPillar || "", kong: kong,
      movingCount: moving.filter(Boolean).length,
      yong: yongShenFor(opts.category, opts.gender)
    };
  }

  // 起卦后往后看：未来 12 个月的月建（按节气切换的真实日期）＋ 未来 15 天的日辰，给 AI 定应期用
  function timeline(fromDate) {
    const AC = global.AstrologyCore;
    const out = { months: [], days: [] };
    if (!AC || !AC.computeBazi) return out;
    const TG = AC.TIANGAN || GAN.split(""), DZ = AC.DIZHI || ZHI.split("");
    const d0 = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12, 0);
    let prevM = null, lastSwitch = 0;
    // computeBazi 要算节气，很重：逐日扫 400 天在手机上要好几秒。
    // 前 15 天逐日（要日辰）；之后每次切换月建后直接跳 27 天再逐日探 —— 两个「节」之间至少 29 天。
    for (let i = 0; i <= 420 && out.months.length < 13; ) {
      const d = new Date(d0.getTime() + i * 86400000);
      let bz;
      try { bz = AC.computeBazi(d.getFullYear(), d.getMonth() + 1, d.getDate(), 12, 0); } catch (e) { break; }
      const mp = TG[bz.mGanIdx] + DZ[bz.mZhiIdx];
      const dp = TG[bz.dGanIdx] + DZ[bz.dZhiIdx];
      const ds = (d.getMonth() + 1) + "月" + d.getDate() + "日";
      if (i < 15) out.days.push(ds + " " + dp);
      if (mp !== prevM) {
        out.months.push({ pillar: mp, from: (i === 0 ? "现在" : d.getFullYear() + "年" + ds + "起") });
        prevM = mp;
        lastSwitch = i > 0 ? i : -99;      // 第 0 天只是「当前月」，不是真正的切换点，不能从它起跳
      }
      i = (i < 14) ? i + 1 : Math.max(i + 1, lastSwitch + 27);
    }
    return out;
  }

  // 给 AI 看的装卦文本
  function describe(g) {
    const pad = function (s, n) { s = String(s); while (s.length < n) s += "　"; return s; };
    const rows = g.lines.slice().reverse().map(function (l) {
      const mark = l.yang ? (l.moving ? "▅▅▅ ○" : "▅▅▅  ") : (l.moving ? "▅ ▅ ×" : "▅ ▅  ");
      const tags = [];
      tags.push("月" + l.season + (l.yuePo ? "·月破" : "") + (l.linYue ? "·临月" : "") + (l.yueHe ? "·月合" : ""));
      if (l.day.length) tags.push(l.day.join("·"));
      if (l.kong) tags.push("旬空");
      let s = pad(l.posName, 3) + " " + pad(l.god, 2) + " " + l.kin + " " + l.stem + l.zhi + l.wx + " " + mark +
              (l.shi ? " 世" : l.ying ? " 应" : "   ") + "  〔" + tags.join("，") + "〕";
      if (l.bian) s += "  → 变 " + l.bian.kin + " " + l.bian.stem + l.bian.zhi + l.bian.wx + "（" + l.bian.hua.join("，") + "）";
      return s;
    });
    const fs = g.fushen.length
      ? g.fushen.map(function (f) { return "  " + f.posName + "伏 " + f.kin + " " + f.stem + f.zhi + f.wx + "（飞神 " + f.underKin + f.underZhi + (f.kong ? "，伏神旬空" : "") + "）"; }).join("\n")
      : "  无（五亲俱全）";
    return [
      "本卦：" + g.ben.name + "（" + g.ben.palace + "宫·" + g.ben.palaceWx + "，" + g.ben.gen + (g.ben.pattern ? "，" + g.ben.pattern : "") + "）" +
        (g.bian ? "　→　变卦：" + g.bian.name + "（" + g.bian.palace + "宫，" + g.bian.gen + "）" : "　（六爻安静，无动爻）"),
      "月建：" + g.mPillar + "月（" + g.monthZhi + "）　日辰：" + g.dayPillar + "日　旬空：" + g.kong.join(""),
      "动爻：" + (g.movingCount ? g.movingCount + " 个" : "无"),
      "",
      "爻位 六神 六亲 纳甲    爻象    世应  〔月建、日辰、旬空〕  → 变爻",
      rows.join("\n"),
      "",
      "伏神：",
      fs
    ].join("\n");
  }

  global.Liuyao = { tossOnce: tossOnce, build: build, describe: describe, timeline: timeline,
                    SUM_LABEL: SUM_LABEL, yongShenFor: yongShenFor, _PALACE: PALACE, _hexOf: hexOf };
})(typeof window !== "undefined" ? window : globalThis);
