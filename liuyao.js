/* =============================================================
 *  点到 · 六爻装卦引擎（liuyao.js）
 *
 *  只做「排出来就是确定的」那部分：
 *    摇钱 → 本卦/变卦 → 纳甲 → 八宫与世应 → 六亲 → 六神 → 旬空
 *    → 月建、日辰对每一爻的作用 → 伏神 → 动爻回头生克
 *  判断吉凶、定应期交给 AI —— 但 AI 只准引用这里排好的数据，不准自己重装卦。
 *  另外把用神的有利／不利／悬着的信号按规则数一遍（assess），给 AI 定「把握度」用 —— 只数信号，不断吉凶。
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
  // 六冲卦 / 六合卦：内外卦对应爻两两相冲或相合
  function patternOf(najia) {
    const all = function (fn) { return [0, 1, 2].every(function (i) { return fn(najia[i].zhi, najia[i + 3].zhi); }); };
    return all(isChong) ? "六冲卦" : all(isHe) ? "六合卦" : "";
  }
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
        if (bj.zhi === nj.zhi) hua.push("伏吟");     // 乾震互变时同位纳甲不变：原地打转
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

    // 六冲卦 / 六合卦（内外卦对应爻两两相冲或相合）；变卦也记 —— 六冲变六合先散后聚，六合变六冲先聚后散
    const pattern = patternOf(ben.najia);

    return {
      sums: sums.slice(),
      ben: { name: ben.name, upper: ben.upper, lower: ben.lower, palace: ben.palace, palaceWx: ben.palaceWx,
             gen: ben.gen, shi: ben.shi, ying: ben.ying, pattern: pattern },
      bian: bian ? { name: bian.name, upper: bian.upper, lower: bian.lower, palace: bian.palace, gen: bian.gen,
                     pattern: patternOf(bian.najia) } : null,
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
        (g.bian ? "　→　变卦：" + g.bian.name + "（" + g.bian.palace + "宫，" + g.bian.gen + (g.bian.pattern ? "，" + g.bian.pattern : "") + "）" : "　（六爻安静，无动爻）"),
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

  /* =============================================================
   *  用神盘点：给 AI 定「把握度」用
   *  以前 prompt 只写「再加一句把握度（高 / 中 / 低）」、不给标准 —— 模型求稳，回回都写「中」。
   *  这里只数规则上确定的信号：用神在月建日辰下有没有气、动了往哪变、原神忌神动没动、
   *  跟世爻合还是冲、卦是聚是散，以及哪些因素还悬着。吉凶仍由 AI 断，但它得对着这张清单说话。
   *  把握度说的是「这一卦说得清不清楚」，不是结果好不好：难成也可以是高把握。
   * ============================================================= */
  const YUAN_OF = { 父母: "官鬼", 兄弟: "父母", 子孙: "兄弟", 妻财: "子孙", 官鬼: "妻财" };   // 生用神的：原神
  const JI_OF   = { 父母: "妻财", 兄弟: "官鬼", 子孙: "父母", 妻财: "兄弟", 官鬼: "子孙" };   // 克用神的：忌神
  const MU_OF   = { 木: "未", 火: "戌", 金: "丑", 水: "辰", 土: "辰" };                        // 墓库（水土同墓）

  // 一个地支在这一卦的月建、日辰下有没有气。m、d 为正 = 帮它，为负 = 伤它
  function qiOf(zhi, wx, g) {
    const mz = g.monthZhi || "", dz = String(g.dayPillar || "").charAt(1);
    const q = { m: 0, d: 0, mTxt: "", dTxt: "", anDong: false, riPo: false, he: false, mu: false,
                kong: (g.kong || []).indexOf(zhi) >= 0 };
    if (mz) {
      if (isChong(mz, zhi)) { q.m = -2; q.mTxt = "月破"; }
      else if (mz === zhi) { q.m = 2; q.mTxt = "临月建"; }
      else {
        const s = seasonState(mz, wx);
        q.m = { 旺: 2, 相: 1, 休: -0.5, 囚: -0.5, 死: -1 }[s];
        q.mTxt = { 旺: "得月令", 相: "得月建生", 休: "不得月令", 囚: "不得月令", 死: "被月建克" }[s];
        if (isHe(mz, zhi)) { q.mTxt += (q.m >= 1 ? "，又" : "，但") + "与月建相合"; q.m = Math.min(2, q.m + 1); }
      }
    }
    if (dz) {
      const rel = dayRelation(dz, zhi);
      if (rel.indexOf("临日") >= 0) { q.d = 2; q.dTxt = "临日辰"; }
      else if (rel.indexOf("日冲") >= 0) {
        // 旺相之爻逢日冲是暗动（被激起来），休囚的才是日破（被冲散）
        if (q.m >= 1) { q.anDong = true; q.dTxt = "旺而逢日冲（暗动）"; }
        else { q.d = -2; q.riPo = true; q.dTxt = "休囚又逢日冲（日破）"; }
      } else {
        if (rel.indexOf("日生") >= 0) { q.d = 1; q.dTxt = "得日辰生"; }
        else if (rel.indexOf("日比") >= 0) { q.d = 1; q.dTxt = "得日辰扶"; }
        else if (rel.indexOf("日克") >= 0) { q.d = -1; q.dTxt = "被日辰克"; }
        if (rel.indexOf("日合") >= 0) { q.he = true; q.d += 1; q.dTxt += (q.dTxt ? "，又" : "") + "与日辰相合"; }
        q.mu = MU_OF[wx] === dz;
      }
    }
    q.qi = q.m >= 1 || q.d >= 1;        // 有气：月建、日辰至少一边帮它
    return q;
  }

  /**
   * @param g    build() 的结果
   * @param kin  用神六亲；不传就用 g.yong.kin（AI 换了用神时可以按新的重数）
   * @returns { kin, where, pro[], con[], open[], lean: 偏成/偏不成/两可, level: 高/中/低 }
   *          没有用神（类别未定）时 level 为空
   */
  function assess(g, kinOverride) {
    const kin = kinOverride || (g && g.yong && g.yong.kin) || "";
    const out = { kin: kin, where: "", pro: [], con: [], open: [], lean: "", level: "", score: null };
    if (!kin || !g || !g.lines) return out;
    const P = function (w, t) { if (w > 0) out.pro.push({ w: w, t: t }); };
    const C = function (w, t) { if (w > 0) out.con.push({ w: w, t: t }); };
    const O = function (w, t) { out.open.push({ w: w, t: t }); };
    const nameOf = function (l) { return l.posName + l.kin + l.zhi + l.wx; };

    // 用神落在哪一爻：两现时取动、取持世、取临应、再取有气的；不上卦就找伏神
    let main = null, fu = null, q = null;
    const cands = g.lines.filter(function (l) { return l.kin === kin; });
    if (cands.length) {
      const rank = function (l) { const x = qiOf(l.zhi, l.wx, g); return (l.moving ? 100 : 0) + (l.shi ? 20 : 0) + (l.ying ? 10 : 0) + x.m + x.d; };
      main = cands.slice().sort(function (a, b) { return rank(b) - rank(a); })[0];
      q = qiOf(main.zhi, main.wx, g);
      out.where = nameOf(main) + (main.moving ? "，动" : "，静") + (main.shi ? "，持世" : main.ying ? "，临应" : "") +
                  (cands.length > 1 ? "（卦里另有 " + (cands.length - 1) + " 处" + kin + "）" : "");
    } else {
      const fs = (g.fushen || []).filter(function (f) { return f.kin === kin; });
      if (!fs.length) return out;
      fu = fs.map(function (f) { return { f: f, q: qiOf(f.zhi, f.wx, g) }; })
             .sort(function (a, b) { return (b.q.m + b.q.d) - (a.q.m + a.q.d); })[0];
      q = fu.q;
      out.where = "不上卦，伏在" + fu.f.posName + fu.f.underKin + fu.f.underZhi + "之下（伏神" + kin + fu.f.zhi + fu.f.wx + "）";
      O(1, "用神不上卦（伏藏）：事情还没摆到台面上");
    }
    const who = fu ? "伏神" : "用神";
    const moving = !!(main && main.moving);

    // ① 用神在月建、日辰下有没有气
    if (q.m > 0) P(q.m, who + q.mTxt); else C(-q.m, who + q.mTxt);
    if (q.d > 0) P(q.d, who + q.dTxt); else C(-q.d, who + q.dTxt);
    if (q.anDong && !moving) P(0.5, who + q.dTxt + "：事情在暗中推进");
    if (!q.qi && !q.anDong) C(1, who + "无气：月建、日辰都不帮它");
    if (q.mu) O(1, who + "入日墓：像被关住，要等冲开墓库");
    if (q.m <= -2 && q.d >= 1) O(0.5, who + "月破但得日辰帮：要等出了这个月或填实才算数");
    if (q.kong) {
      if (moving) O(0.5, "用神动而旬空：动不为空，出空那天落地");
      else if (q.qi || q.anDong || q.riPo) O(0.5, who + "旬空，但有气或逢冲：不算真空，出空才落地");
      else C(2, who + "旬空又无气：真空，落不了地");
    }

    // ② 用神动了往哪变（变爻只回头作用于本爻）
    if (moving && main.bian) {
      const h = main.bian.hua.join("，");
      if (/回头生/.test(h)) P(2, "用神动而化回头生");
      if (/回头克/.test(h)) C(2, "用神动而化回头克");
      if (/化进神/.test(h)) P(1, "用神化进神：越走越旺");
      if (/化退神/.test(h)) C(1, "用神化退神：劲头往回收");
      if (/化空/.test(h)) C(1, "用神化空：有头无尾");
      if (/化月破/.test(h)) C(1, "用神化月破");
      if (/反吟/.test(h)) { C(1, "用神反吟"); O(1, "反吟主反复：结果会来回变"); }
      if (main.bian.zhi === main.zhi) C(1, "用神伏吟：原地打转、推不动");
      if (MU_OF[main.wx] === main.bian.zhi && main.bian.zhi !== main.zhi) C(1, "用神化墓：动了又被困住");
      if (q.he) O(1, "用神动而被日辰合住：要等冲开才真动起来");
    }

    // ③ 原神、忌神：明动算足，暗动或自身无力算一半
    const actOf = function (l) {
      if (l === main) return null;
      const x = qiOf(l.zhi, l.wx, g);
      if (!l.moving && !x.anDong) return null;
      const h = l.bian ? l.bian.hua.join("，") : "";
      return { l: l, an: !l.moving, weak: !x.qi || x.m <= -2 || x.riPo || /回头克|化退神/.test(h) };   // 无气、月破日破、回头克、化退：力弱
    };
    const yuans = g.lines.filter(function (l) { return l.kin === YUAN_OF[kin]; }).map(actOf).filter(Boolean);
    const jis   = g.lines.filter(function (l) { return l.kin === JI_OF[kin]; }).map(actOf).filter(Boolean);
    const relay = yuans.some(function (a) { return !a.an && !a.weak; });   // 原神明动有力：忌神再动也只是接力生用神
    let yw = 0, jw = 0;
    yuans.forEach(function (a) {
      const w = (a.an || a.weak) ? 0.5 : 1;
      if (yw + w > 2) return;
      yw += w;
      P(w, "原神" + nameOf(a.l) + (a.an ? "暗动" : "发动") + "，生" + who + (a.weak ? "（但它自己无力，帮得有限）" : ""));
    });
    jis.forEach(function (a) {
      if (relay) { P(0.5, "忌神" + nameOf(a.l) + "虽动，原神也在动：忌生原、原生用，反成接力"); return; }
      const w = (a.an || a.weak) ? 1 : 2;
      if (jw + w > 3) return;
      jw += w;
      C(w, "忌神" + nameOf(a.l) + (a.an ? "暗动" : "发动") + "，克" + who + (a.weak ? "（但它自己无力，克得不重）" : ""));
    });

    // ④ 伏神出不出得来：看压在上面的飞神
    if (fu) {
      const fly = g.lines[fu.f.pos - 1];
      if (fly) {
        if (SHENG[fly.wx] === fu.f.wx) P(1, "飞神" + nameOf(fly) + "生伏神：伏神有靠");
        else if (KE[fly.wx] === fu.f.wx) C(1, "飞神" + nameOf(fly) + "克伏神：伏神被压着出不来");
        if (fly.moving || fly.yuePo || fly.kong || (fly.day || []).indexOf("日冲") >= 0)
          P(1, "飞神" + (fly.moving ? "发动" : fly.kong ? "旬空" : "被冲") + "：给伏神让了路，容易出来");
      }
    }

    // ⑤ 用神和世爻（自己）的关系
    const shi = g.lines.filter(function (l) { return l.shi; })[0];
    if (main && shi) {
      if (main === shi) P(1, "用神持世：事情落在自己手上");
      else {
        if (isHe(main.zhi, shi.zhi)) P(1, "用神与世爻相合");
        else if (isChong(main.zhi, shi.zhi)) C(1, "用神与世爻相冲");
        if (SHENG[main.wx] === shi.wx) P(1, "用神生世：往你这边来");
      }
    }

    // ⑥ 卦是聚是散：六冲主散，六合主聚，变卦也算（老存档里的变卦没记 pattern，这里现算）
    const bn = g.ben.pattern || "";
    const bp = g.movingCount
      ? patternOf(hexOf(g.lines.map(function (l) { return (l.moving ? !l.yang : l.yang) ? 1 : 0; })).najia)
      : "";
    if (bn === "六冲卦" && bp === "六合卦") P(1, "六冲变六合：先散后聚");
    else if (bn === "六合卦" && bp === "六冲卦") C(1, "六合变六冲：先聚后散");
    else {
      if (bn === "六冲卦") C(1, "本卦六冲：主散、难聚");
      if (bn === "六合卦") P(1, "本卦六合：主成、有牵连");
      if (bp === "六冲卦") C(1, "变卦六冲：后头容易散");
      if (bp === "六合卦") P(1, "变卦六合：后头能合上");
    }

    // ⑦ 动得太乱
    if (g.movingCount >= 4) O(1, "动爻多达 " + g.movingCount + " 个：头绪乱、变数大");

    // 合计：方向看有利减不利，把握度看差距有多大、反方向有多少、还有多少悬着
    // 阈值按两万次随机起卦校过（高 22% / 中 44% / 低 34%）：三档都得常见，不能又挤回「中」；
    // 反方向只要有一条足力的（忌神发动、回头克），就不算「基本指向同一边」，到不了高
    const sum = function (a) { return a.reduce(function (s, x) { return s + x.w; }, 0); };
    const F = sum(out.pro), U = sum(out.con), S = sum(out.open), net = F - U;
    out.lean = net >= 1.5 ? "偏成" : net <= -1.5 ? "偏不成" : "两可";
    out.level = (Math.abs(net) >= 3 && Math.min(F, U) <= 1.5 && S < 1) ? "高"
              : (Math.abs(net) < 1.5 || S >= 2) ? "低" : "中";
    out.score = { pro: F, con: U, open: S };      // 调参用，不进 prompt —— 实测模型会把数字原样抄进回答
    return out;
  }

  // 盘点写成给 AI 看的几行字（不带分数）
  function assessText(a) {
    if (!a || !a.kin) return "  （没有建议用神：你按问题自己取用神，再按【把握度怎么定】自己数）";
    if (!a.level) return "  （用神" + a.kin + "在卦里、伏神里都找不到：你按问题自己取用神，再自己数）";
    const list = function (arr) { return arr.length ? arr.map(function (x) { return x.t; }).join("；") : "—"; };
    return [
      "  用神" + a.kin + "：" + a.where,
      "  · 有利：" + list(a.pro),
      "  · 不利：" + list(a.con),
      "  · 悬着：" + list(a.open),
      "  · 按【把握度怎么定】数下来：" + a.lean + "，把握度「" + a.level + "」"
    ].join("\n");
  }

  // 没选类别时按问题里的字眼猜一个。像好几类、或哪类都不像，就不猜 —— 交给 AI 自己取用神
  const CAT_HINTS = [
    ["reconcile", /复合|挽回|前任|前男友|前女友|和好|断联|拉黑|分手/],
    ["marry",     /结婚|领证|婚礼|嫁给|娶|见家长|走到最后|在一起/],
    ["single",    /脱单|桃花|正缘|找对象|单身|另一半/],
    ["job",       /offer|面试|工作|入职|录用|跳槽|升职|晋升|岗位|转正|求职|裁员|调岗/i],
    ["money",     /钱|投资|回款|收款|借款|欠款|还款|股票|基金|理财|赚|货款|尾款/],
    ["exam",      /考试|考研|考公|考编|上岸|录取|升学|雅思|托福|考证|成绩|分数线/]
  ];
  function guessCategory(text) {
    const s = String(text || "");
    const hit = CAT_HINTS.filter(function (c) { return c[1].test(s); });
    return hit.length === 1 ? hit[0][0] : "";
  }

  global.Liuyao = { tossOnce: tossOnce, build: build, describe: describe, timeline: timeline,
                    assess: assess, assessText: assessText, guessCategory: guessCategory,
                    SUM_LABEL: SUM_LABEL, yongShenFor: yongShenFor, _PALACE: PALACE, _hexOf: hexOf };
})(typeof window !== "undefined" ? window : globalThis);
