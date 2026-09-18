/* ============================================================================
 * calendar_core.js —— 天文历法内核
 * 提供：儒略日换算、ΔT、太阳视黄经、24节气精确时刻、朔（新月）时刻、
 *       农历（含闰月）转换。全部以北京时间（UTC+8）输出。
 *
 * 算法来源：Jean Meeus《Astronomical Algorithms》
 *   - 太阳视黄经：Ch.25（低精度公式，精度约 0.01° ≈ ±15 分钟）
 *   - 朔望月时刻：Ch.49（含 25 项周期修正 + 行星摄动项，精度约数秒）
 *   - ΔT：Espenak & Meeus 多项式拟合
 * 农历置闰：以「冬至必在十一月」+「无中气之月为闰月」的现行国标规则实现
 * ========================================================================== */
(function (global) {
  "use strict";

  const PI = Math.PI;
  const RAD = PI / 180;
  const SYNODIC = 29.530588861;           // 平均朔望月长度（日）
  const CN_TZ = 8 / 24;                    // 北京时区偏移（日）

  /* -------------------- 基础换算 -------------------- */

  // 公历 → 儒略日（格里高利历，dayFrac 为当日小数部分）
  function gregorianToJD(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  // 儒略日 → 公历 {y, m, d(含小数)}
  function jdToGregorian(jd) {
    const z = Math.floor(jd + 0.5);
    const f = (jd + 0.5) - z;
    let A = z;
    if (z >= 2299161) {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      A = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + f;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return { y: year, m: month, d: day };
  }

  // 便捷：公历日期(北京时) → 「日序号」整数（用于按天比较）
  function dayNumber(y, m, d) {
    return Math.floor(gregorianToJD(y, m, d) + 0.5);
  }

  /* -------------------- ΔT（TT - UT，单位：秒） -------------------- */
  function deltaT(year) {
    let t, dt;
    if (year < 1900) {                       // 1800–1900
      t = (year - 1860) / 1;
      dt = 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * Math.pow(t, 3)
         - 0.0004473624 * Math.pow(t, 4) + Math.pow(t, 5) / 233174;
    } else if (year < 1920) {
      t = year - 1900;
      dt = -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * Math.pow(t, 3)
         - 0.000197 * Math.pow(t, 4);
    } else if (year < 1941) {
      t = year - 1920;
      dt = 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3);
    } else if (year < 1961) {
      t = year - 1950;
      dt = 29.07 + 0.407 * t - t * t / 233 + Math.pow(t, 3) / 2547;
    } else if (year < 1986) {
      t = year - 1975;
      dt = 45.45 + 1.067 * t - t * t / 260 - Math.pow(t, 3) / 718;
    } else if (year < 2005) {
      t = year - 2000;
      dt = 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3)
         + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
    } else if (year < 2050) {
      t = year - 2000;
      dt = 62.92 + 0.32217 * t + 0.005589 * t * t;
    } else if (year < 2150) {
      const u = (year - 1820) / 100;
      dt = -20 + 32 * u * u - 0.5628 * (2150 - year);
    } else {
      const u = (year - 1820) / 100;
      dt = -20 + 32 * u * u;
    }
    return dt;
  }

  // TT(力学时) 儒略日 → 北京时儒略日
  function ttToBeijing(jdTT, year) {
    return jdTT - deltaT(year) / 86400 + CN_TZ;
  }

  /* -------------------- 太阳视黄经（Meeus Ch.25） -------------------- */
  function sunApparentLongitude(jdTT) {
    const T = (jdTT - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M  = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mr = M * RAD;
    const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
             + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
             + 0.000289 * Math.sin(3 * Mr);
    const trueLong = L0 + C;
    const omega = (125.04 - 1934.136 * T) * RAD;
    let lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega);
    lambda = lambda % 360;
    if (lambda < 0) lambda += 360;
    return lambda;
  }

  /* -------------------- 24 节气精确时刻 --------------------
   * k = 0..23 对应：0 小寒(285°) 1 大寒(300) 2 立春(315) 3 雨水(330)
   *   4 惊蛰(345) 5 春分(0) 6 清明(15) 7 谷雨(30) 8 立夏(45) 9 小满(60)
   *   10 芒种(75) 11 夏至(90) 12 小暑(105) 13 大暑(120) 14 立秋(135)
   *   15 处暑(150) 16 白露(165) 17 秋分(180) 18 寒露(195) 19 霜降(210)
   *   20 立冬(225) 21 小雪(240) 22 大雪(255) 23 冬至(270)
   * 偶数 k 为「节」（换月用），奇数 k 为「中气」（置闰用）
   * ---------------------------------------------------------- */
  const TERM_NAMES = ["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨",
                      "立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑",
                      "白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"];

  function termTargetLongitude(k) { return (285 + k * 15) % 360; }

  // 返回该节气在「北京时」的儒略日（含小数）
  // 若已加载 vsop87.js，则自动改用高精度算法（误差 <1 分钟）
  function sunLongitude(jdTT) {
    if (global.VSOP87 && global.VSOP87.sunApparentLongitudeHP) {
      return global.VSOP87.sunApparentLongitudeHP(jdTT);
    }
    return sunApparentLongitude(jdTT);
  }

  function solarTermJD(year, k) {
    const target = termTargetLongitude(k);
    // 初值估计：以该年 1/6 为小寒起点，每节气约 15.22 天
    let jd = gregorianToJD(year, 1, 6) + k * 15.2185;
    for (let i = 0; i < 12; i++) {
      const lam = sunLongitude(jd);
      let diff = target - lam;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      const step = diff / 0.9856473;          // 太阳日均行度
      jd += step;
      if (Math.abs(step) < 1e-7) break;
    }
    return ttToBeijing(jd, year);
  }

  function solarTermDate(year, k) {
    const jd = solarTermJD(year, k);
    const g = jdToGregorian(jd);
    const dayF = g.d - Math.floor(g.d);
    const totalMin = Math.round(dayF * 1440);
    return {
      name: TERM_NAMES[k],
      y: g.y, m: g.m, d: Math.floor(g.d),
      hour: Math.floor(totalMin / 60) % 24,
      minute: totalMin % 60,
      jd,
      dayNum: Math.floor(jd + 0.5)
    };
  }

  /* -------------------- 朔（新月）时刻，Meeus Ch.49 -------------------- */
  function newMoonJD(k) {
    const T = k / 1236.85;
    const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let JDE = 2451550.09766 + 29.530588861 * k
            + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;

    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M  = (2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2
              + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
    const F  = (160.7108 + 390.67050284 * k - 0.0016118 * T2
              - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;

    // 主周期修正（新月）
    let c = 0;
    c += -0.40720 * Math.sin(Mp);
    c +=  0.17241 * E * Math.sin(M);
    c +=  0.01608 * Math.sin(2 * Mp);
    c +=  0.01039 * Math.sin(2 * F);
    c +=  0.00739 * E * Math.sin(Mp - M);
    c += -0.00514 * E * Math.sin(Mp + M);
    c +=  0.00208 * E * E * Math.sin(2 * M);
    c += -0.00111 * Math.sin(Mp - 2 * F);
    c += -0.00057 * Math.sin(Mp + 2 * F);
    c +=  0.00056 * E * Math.sin(2 * Mp + M);
    c += -0.00042 * Math.sin(3 * Mp);
    c +=  0.00042 * E * Math.sin(M + 2 * F);
    c +=  0.00038 * E * Math.sin(M - 2 * F);
    c += -0.00024 * E * Math.sin(2 * Mp - M);
    c += -0.00017 * Math.sin(Om);
    c += -0.00007 * Math.sin(Mp + 2 * M);
    c +=  0.00004 * Math.sin(2 * Mp - 2 * F);
    c +=  0.00004 * Math.sin(3 * M);
    c +=  0.00003 * Math.sin(Mp + M - 2 * F);
    c +=  0.00003 * Math.sin(2 * Mp + 2 * F);
    c += -0.00003 * Math.sin(Mp + M + 2 * F);
    c +=  0.00003 * Math.sin(Mp - M + 2 * F);
    c += -0.00002 * Math.sin(Mp - M - 2 * F);
    c += -0.00002 * Math.sin(3 * Mp + M);
    c +=  0.00002 * Math.sin(4 * Mp);
    JDE += c;

    // 行星摄动附加项（Meeus 表 49.B）
    const A1  = (299.77 +  0.107408 * k - 0.009173 * T2) * RAD;
    const A2  = (251.88 +  0.016321 * k) * RAD;
    const A3  = (251.83 + 26.651886 * k) * RAD;
    const A4  = (349.42 + 36.412478 * k) * RAD;
    const A5  = ( 84.66 + 18.206239 * k) * RAD;
    const A6  = (141.74 + 53.303771 * k) * RAD;
    const A7  = (207.14 +  2.453732 * k) * RAD;
    const A8  = (154.84 +  7.306860 * k) * RAD;
    const A9  = ( 34.52 + 27.261239 * k) * RAD;
    const A10 = (207.19 +  0.121824 * k) * RAD;
    const A11 = (291.34 +  1.844379 * k) * RAD;
    const A12 = (161.72 + 24.198154 * k) * RAD;
    const A13 = (239.56 + 25.513099 * k) * RAD;
    const A14 = (331.55 +  3.592518 * k) * RAD;

    JDE += 0.000325 * Math.sin(A1)  + 0.000165 * Math.sin(A2)
         + 0.000164 * Math.sin(A3)  + 0.000126 * Math.sin(A4)
         + 0.000110 * Math.sin(A5)  + 0.000062 * Math.sin(A6)
         + 0.000060 * Math.sin(A7)  + 0.000056 * Math.sin(A8)
         + 0.000047 * Math.sin(A9)  + 0.000042 * Math.sin(A10)
         + 0.000040 * Math.sin(A11) + 0.000037 * Math.sin(A12)
         + 0.000035 * Math.sin(A13) + 0.000023 * Math.sin(A14);

    const approxYear = 2000 + k / 12.3685;
    return ttToBeijing(JDE, approxYear);
  }

  // 朔日的「日序号」
  function newMoonDayNum(k) { return Math.floor(newMoonJD(k) + 0.5); }

  // 求 <= dayNum 的最近一个朔日（返回 {k, dayNum}）
  function newMoonOnOrBefore(dayNum) {
    const g = jdToGregorian(dayNum - 0.5);
    let k = Math.round((g.y + (g.m - 0.5) / 12 - 2000) * 12.3685);
    let nd = newMoonDayNum(k);
    while (nd > dayNum) { k -= 1; nd = newMoonDayNum(k); }
    while (true) {
      const nd2 = newMoonDayNum(k + 1);
      if (nd2 <= dayNum) { k += 1; nd = nd2; } else break;
    }
    return { k, dayNum: nd };
  }

  /* -------------------- 农历转换（含闰月） -------------------- */

  // 冬至（k=23）的日序号
  function winterSolsticeDayNum(year) {
    return solarTermDate(year, 23).dayNum;
  }

  // 判断某农历月区间 [start, nextStart) 内是否含「中气」
  // 中气 = 太阳黄经为 30 的整数倍：对应 k 为奇数（大寒300、雨水330…冬至270）
  function hasMajorTerm(startDayNum, nextStartDayNum) {
    const g = jdToGregorian(startDayNum - 0.5);
    for (let dy = -1; dy <= 1; dy++) {
      for (let k = 1; k < 24; k += 2) {
        const t = solarTermDate(g.y + dy, k);
        if (t.dayNum >= startDayNum && t.dayNum < nextStartDayNum) return true;
      }
    }
    return false;
  }

  /**
   * 公历(北京时) → 农历
   * @returns {lYear, lMonth, lDay, isLeap, monthStartDayNum, lMonthLabel}
   */
  function solarToLunar(y, m, d) {
    const dn = dayNumber(y, m, d);

    // 1) 找到包含本日的「冬至月」起点
    //    注意：农历十一月起于「冬至前(含)的那个朔日」，该朔日通常早于冬至数日至一月。
    //    因此判断归属必须比较「十一月初一」而非「冬至当天」，
    //    否则「已过十一月初一但未到冬至」的日期会被错划进上一周期。
    let wsYear = y;
    let ws = winterSolsticeDayNum(wsYear);
    let m11 = newMoonOnOrBefore(ws);              // 十一月初一
    if (dn < m11.dayNum) {                        // 尚未进入本年度十一月 → 退回上一周期
      wsYear = y - 1;
      ws = winterSolsticeDayNum(wsYear);
      m11 = newMoonOnOrBefore(ws);
    }
    const wsNext = winterSolsticeDayNum(wsYear + 1);
    const m11next = newMoonOnOrBefore(wsNext);

    // 2) 该冬至周期内的月数（12 或 13）
    const monthCount = Math.round((m11next.dayNum - m11.dayNum) / SYNODIC);
    const isLeapYear = (monthCount === 13);

    // 3) 构造月序列
    const months = [];
    for (let i = 0; i <= monthCount; i++) {
      months.push({ k: m11.k + i, start: newMoonDayNum(m11.k + i) });
    }

    // 4) 找闰月（第一个无中气之月，从十一月之后开始找）
    let leapIndex = -1;
    if (isLeapYear) {
      for (let i = 1; i < monthCount; i++) {
        if (!hasMajorTerm(months[i].start, months[i + 1].start)) { leapIndex = i; break; }
      }
      if (leapIndex === -1) leapIndex = monthCount; // 理论上不会发生
    }

    // 5) 编号：months[0] 为十一月
    let num = 11;
    for (let i = 0; i < monthCount; i++) {
      if (isLeapYear && i === leapIndex) {
        // 闰月沿用上一个月的月号（闰月不推进月序）
        months[i].month = months[i - 1] ? months[i - 1].month : num;
        months[i].isLeap = true;
      } else {
        months[i].month = num;
        months[i].isLeap = false;
        num = num === 12 ? 1 : num + 1;
      }
    }

    // 6) 定位本日所在月
    let idx = -1;
    for (let i = 0; i < monthCount; i++) {
      if (dn >= months[i].start && dn < months[i + 1].start) { idx = i; break; }
    }
    if (idx === -1) {
      // 不应发生；抛错而非返回错误数据，避免静默污染下游排盘
      throw new Error("solarToLunar: 无法定位 " + y + "-" + m + "-" + d + " 所属农历月");
    }
    const cur = months[idx];
    const lDay = dn - cur.start + 1;

    // 7) 农历年份：以正月初一为界
    let lYear = wsYear;
    // 找到本周期内的正月
    let zhengIdx = -1;
    for (let i = 0; i < monthCount; i++) {
      if (months[i].month === 1 && !months[i].isLeap) { zhengIdx = i; break; }
    }
    if (zhengIdx >= 0 && idx >= zhengIdx) lYear = wsYear + 1;

    return {
      lYear,
      lMonth: cur.month,
      lDay,
      isLeap: !!cur.isLeap,
      monthStartDayNum: cur.start,
      lMonthLabel: (cur.isLeap ? "闰" : "") + ["","正","二","三","四","五","六","七","八","九","十","冬","腊"][cur.month] + "月",
      lDayLabel: lunarDayLabel(lDay)
    };
  }

  function lunarDayLabel(d) {
    const a = ["","初一","初二","初三","初四","初五","初六","初七","初八","初九","初十",
               "十一","十二","十三","十四","十五","十六","十七","十八","十九","二十",
               "廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
    return a[d] || String(d);
  }

  /* -------------------- 导出 -------------------- */
  global.CalendarCore = {
    gregorianToJD, jdToGregorian, dayNumber,
    deltaT, sunApparentLongitude,
    TERM_NAMES, solarTermJD, solarTermDate, sunLongitude,
    newMoonJD, newMoonDayNum, newMoonOnOrBefore,
    winterSolsticeDayNum, solarToLunar
  };
})(typeof window !== "undefined" ? window : this);
