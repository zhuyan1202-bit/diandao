/* ============================================================================
 * ziwei_engine.js —— 紫微斗数真实排盘引擎
 *
 * 依赖：calendar_core.js（农历转换 + 节气）
 *
 * 实现内容：
 *   - 定命宫 / 身宫（寅宫起正月顺数至生月，再自生月宫起子时逆数至生时）
 *   - 五行局（命宫干支纳音）
 *   - 安紫微星（局数起紫微诀）→ 紫微系 6 星（逆行）
 *   - 安天府星 → 天府系 8 星（顺行）
 *   - 六吉：文昌 文曲 左辅 右弼 天魁 天钺
 *   - 六煞：擎羊 陀罗 火星 铃星 地空 地劫
 *   - 禄存、天马
 *   - 桃花/婚姻星：红鸾 天喜 天姚 咸池 孤辰 寡宿 天刑 华盖
 *   - 生年四化（禄权科忌）+ 宫干自化
 *   - 十二宫名、宫干（五虎遁）、主星庙旺
 *   - 大限（阳男阴女顺行 / 阴男阳女逆行）
 *
 * 流派说明：庙旺表与庚干四化采用「中州派 / 通行本」说法，不同流派存在差异。
 * ========================================================================== */
(function (global) {
  "use strict";

  const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const ZHI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

  /* ---------- 六十甲子纳音 → 五行局 ---------- */
  // 每 2 个干支一组，共 30 组
  const NAYIN = [
    ["海中金",4],["炉中火",6],["大林木",3],["路旁土",5],["剑锋金",4],["山头火",6],
    ["涧下水",2],["城头土",5],["白蜡金",4],["杨柳木",3],["泉中水",2],["屋上土",5],
    ["霹雳火",6],["松柏木",3],["长流水",2],["砂中金",4],["山下火",6],["平地木",3],
    ["壁上土",5],["金箔金",4],["覆灯火",6],["天河水",2],["大驿土",5],["钗钏金",4],
    ["桑柘木",3],["大溪水",2],["沙中土",5],["天上火",6],["石榴木",3],["大海水",2]
  ];
  const JU_NAME = { 2:"水二局", 3:"木三局", 4:"金四局", 5:"土五局", 6:"火六局" };

  // 干支 → 六十甲子序号(0..59)
  function jiaziIndex(ganIdx, zhiIdx) {
    for (let i = 0; i < 60; i++) {
      if (i % 10 === ganIdx && i % 12 === zhiIdx) return i;
    }
    return -1;
  }
  function nayinOf(ganIdx, zhiIdx) {
    const i = jiaziIndex(ganIdx, zhiIdx);
    return NAYIN[Math.floor(i / 2)];
  }

  /* ---------- 五虎遁：年干 → 寅宫天干 ---------- */
  // 甲己→丙寅 乙庚→戊寅 丙辛→庚寅 丁壬→壬寅 戊癸→甲寅
  const YIN_GAN = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0]; // index=年干
  function palaceGan(yearGanIdx, palaceZhiIdx) {
    const base = YIN_GAN[yearGanIdx];
    return (base + ((palaceZhiIdx - 2) % 12 + 12) % 12) % 10;
  }

  /* ---------- 十二宫名（自命宫起逆行） ---------- */
  const PALACE_NAMES = ["命宫","兄弟宫","夫妻宫","子女宫","财帛宫","疾厄宫",
                        "迁移宫","交友宫","官禄宫","田宅宫","福德宫","父母宫"];

  /* ---------- 十四主星庙旺表（子…亥） ---------- */
  const BRIGHT = {
    "紫微":["平","庙","庙","旺","得","旺","庙","庙","旺","旺","得","旺"],
    "天机":["庙","陷","得","旺","利","平","庙","陷","得","旺","利","平"],
    "太阳":["陷","陷","旺","庙","旺","旺","庙","得","得","平","不","陷"],
    "武曲":["旺","庙","得","利","庙","平","旺","庙","得","利","庙","平"],
    "天同":["旺","陷","利","庙","平","庙","陷","陷","旺","平","平","庙"],
    "廉贞":["平","利","庙","平","利","陷","平","利","庙","平","利","陷"],
    "天府":["庙","庙","庙","得","庙","得","旺","庙","得","旺","庙","得"],
    "太阴":["庙","庙","陷","陷","陷","陷","不","不","利","旺","旺","庙"],
    "贪狼":["旺","庙","平","利","庙","陷","旺","庙","平","利","庙","陷"],
    "巨门":["旺","不","庙","庙","陷","旺","旺","不","庙","庙","陷","旺"],
    "天相":["庙","庙","庙","陷","得","得","庙","得","庙","陷","得","得"],
    "天梁":["庙","旺","庙","庙","庙","陷","庙","旺","陷","得","庙","陷"],
    "七杀":["旺","庙","庙","旺","庙","平","旺","庙","庙","旺","庙","平"],
    "破军":["庙","旺","得","陷","旺","平","庙","旺","得","陷","旺","平"]
  };
  function brightnessOf(star, zhiIdx) {
    return BRIGHT[star] ? BRIGHT[star][zhiIdx] : "";
  }

  /* ---------- 十干四化（中州派通行） ---------- */
  const SIHUA = {
    "甲":{禄:"廉贞",权:"破军",科:"武曲",忌:"太阳"},
    "乙":{禄:"天机",权:"天梁",科:"紫微",忌:"太阴"},
    "丙":{禄:"天同",权:"天机",科:"文昌",忌:"廉贞"},
    "丁":{禄:"太阴",权:"天同",科:"天机",忌:"巨门"},
    "戊":{禄:"贪狼",权:"太阴",科:"右弼",忌:"天机"},
    "己":{禄:"武曲",权:"贪狼",科:"天梁",忌:"文曲"},
    "庚":{禄:"太阳",权:"武曲",科:"太阴",忌:"天同"},
    "辛":{禄:"巨门",权:"太阳",科:"文曲",忌:"文昌"},
    "壬":{禄:"天梁",权:"紫微",科:"左辅",忌:"武曲"},
    "癸":{禄:"破军",权:"巨门",科:"太阴",忌:"贪狼"}
  };

  /* ---------- 安星 ---------- */
  const M = 12;
  const mod = (n) => ((n % M) + M) % M;

  /**
   * 排盘主函数
   * @param {Object} o
   *   lunarMonth  农历月（1-12，闰月已按上下半月折算）
   *   lunarDay    农历日（1-30）
   *   hourIdx     时支序号（0=子 … 11=亥）
   *   yearGanIdx  年干序号（以立春为界的干支年）
   *   yearZhiIdx  年支序号
   *   gender      "male" | "female"
   */
  function buildChart(o) {
    const { lunarMonth: lm, lunarDay: ld, hourIdx: h,
            yearGanIdx: yg, yearZhiIdx: yz, gender } = o;

    /* 1) 命宫 / 身宫 */
    const mingIdx = mod(2 + (lm - 1) - h);
    const shenIdx = mod(2 + (lm - 1) + h);

    /* 2) 五行局 = 命宫干支纳音 */
    const mingGan = palaceGan(yg, mingIdx);
    const [nayinName, ju] = nayinOf(mingGan, mingIdx);

    /* 3) 安紫微 */
    const n = Math.ceil(ld / ju);
    const r = ju * n - ld;
    const ziweiIdx = (r % 2 === 0) ? mod(2 + n - 1 + r) : mod(2 + n - 1 - r);

    /* 4) 紫微系（逆行）+ 天府系（顺行） */
    const stars = {};                       // starName -> palaceIdx
    stars["紫微"] = ziweiIdx;
    stars["天机"] = mod(ziweiIdx - 1);
    stars["太阳"] = mod(ziweiIdx - 3);
    stars["武曲"] = mod(ziweiIdx - 4);
    stars["天同"] = mod(ziweiIdx - 5);
    stars["廉贞"] = mod(ziweiIdx - 8);

    const fuIdx = mod(4 - ziweiIdx);
    stars["天府"] = fuIdx;
    stars["太阴"] = mod(fuIdx + 1);
    stars["贪狼"] = mod(fuIdx + 2);
    stars["巨门"] = mod(fuIdx + 3);
    stars["天相"] = mod(fuIdx + 4);
    stars["天梁"] = mod(fuIdx + 5);
    stars["七杀"] = mod(fuIdx + 6);
    stars["破军"] = mod(fuIdx + 10);

    const MAIN14 = ["紫微","天机","太阳","武曲","天同","廉贞","天府","太阴",
                    "贪狼","巨门","天相","天梁","七杀","破军"];

    /* 5) 六吉 */
    const aux = {};
    aux["文昌"] = mod(10 - h);              // 戌起子时逆
    aux["文曲"] = mod(4 + h);               // 辰起子时顺
    aux["左辅"] = mod(4 + (lm - 1));        // 辰起正月顺
    aux["右弼"] = mod(10 - (lm - 1));       // 戌起正月逆
    // 天魁天钺：甲戊庚→丑/未 乙己→子/申 丙丁→亥/酉 壬癸→卯/巳 辛→午/寅
    const KUI = [1, 0, 11, 11, 1, 0, 1, 6, 3, 3];
    const YUE = [7, 8, 9, 9, 7, 8, 7, 2, 5, 5];
    aux["天魁"] = KUI[yg];
    aux["天钺"] = YUE[yg];

    /* 6) 禄存 / 擎羊 / 陀罗 */
    const LUCUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]; // 甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子
    aux["禄存"] = LUCUN[yg];
    aux["擎羊"] = mod(LUCUN[yg] + 1);
    aux["陀罗"] = mod(LUCUN[yg] - 1);

    /* 7) 火星铃星（年支三合定起点，子时起顺行） */
    let hStart, lStart;
    if ([2,6,10].indexOf(yz) >= 0)      { hStart = 1;  lStart = 3;  } // 寅午戌
    else if ([8,0,4].indexOf(yz) >= 0)  { hStart = 2;  lStart = 10; } // 申子辰
    else if ([5,9,1].indexOf(yz) >= 0)  { hStart = 3;  lStart = 10; } // 巳酉丑
    else                                { hStart = 9;  lStart = 10; } // 亥卯未
    aux["火星"] = mod(hStart + h);
    aux["铃星"] = mod(lStart + h);

    /* 8) 地空地劫（亥宫起子时，地空逆 地劫顺） */
    aux["地空"] = mod(11 - h);
    aux["地劫"] = mod(11 + h);

    /* 9) 天马（年支三合） */
    let tianma;
    if ([2,6,10].indexOf(yz) >= 0)      tianma = 8;  // 寅午戌→申
    else if ([8,0,4].indexOf(yz) >= 0)  tianma = 2;  // 申子辰→寅
    else if ([5,9,1].indexOf(yz) >= 0)  tianma = 11; // 巳酉丑→亥
    else                                tianma = 5;  // 亥卯未→巳
    aux["天马"] = tianma;

    /* 10) 婚姻 / 桃花 / 孤克星 */
    const peach = {};
    peach["红鸾"] = mod(3 - yz);            // 卯起子年逆
    peach["天喜"] = mod(3 - yz + 6);
    peach["天姚"] = mod(1 + (lm - 1));      // 丑起正月顺
    peach["天刑"] = mod(9 + (lm - 1));      // 酉起正月顺
    // 咸池：寅午戌见卯 申子辰见酉 巳酉丑见午 亥卯未见子
    if ([2,6,10].indexOf(yz) >= 0)      peach["咸池"] = 3;
    else if ([8,0,4].indexOf(yz) >= 0)  peach["咸池"] = 9;
    else if ([5,9,1].indexOf(yz) >= 0)  peach["咸池"] = 6;
    else                                peach["咸池"] = 0;
    // 孤辰寡宿
    let guchen, guasu;
    if ([11,0,1].indexOf(yz) >= 0)      { guchen = 2;  guasu = 10; } // 亥子丑
    else if ([2,3,4].indexOf(yz) >= 0)  { guchen = 5;  guasu = 1;  } // 寅卯辰
    else if ([5,6,7].indexOf(yz) >= 0)  { guchen = 8;  guasu = 4;  } // 巳午未
    else                                { guchen = 11; guasu = 7;  } // 申酉戌
    peach["孤辰"] = guchen;
    peach["寡宿"] = guasu;
    // 华盖：寅午戌→戌 申子辰→辰 巳酉丑→丑 亥卯未→未
    if ([2,6,10].indexOf(yz) >= 0)      peach["华盖"] = 10;
    else if ([8,0,4].indexOf(yz) >= 0)  peach["华盖"] = 4;
    else if ([5,9,1].indexOf(yz) >= 0)  peach["华盖"] = 1;
    else                                peach["华盖"] = 7;

    /* 11) 生年四化 */
    const sh = SIHUA[GAN[yg]];
    const sihuaMap = {};                    // starName -> "禄"/"权"/"科"/"忌"
    ["禄","权","科","忌"].forEach(function (t) { sihuaMap[sh[t]] = t; });

    /* 12) 组装十二宫 */
    const palaces = [];
    for (let i = 0; i < 12; i++) {
      palaces.push({
        index: i,
        branch: ZHI[i],
        gan: GAN[palaceGan(yg, i)],
        name: "",
        isMing: i === mingIdx,
        isShen: i === shenIdx,
        mainStars: [],
        auxStars: [],
        peachStars: [],
        sihua: []
      });
    }
    // 宫名：自命宫起逆行
    for (let k = 0; k < 12; k++) {
      palaces[mod(mingIdx - k)].name = PALACE_NAMES[k];
    }
    // 落星
    MAIN14.forEach(function (s) {
      const p = palaces[stars[s]];
      const b = brightnessOf(s, stars[s]);
      p.mainStars.push({ name: s, brightness: b, sihua: sihuaMap[s] || "" });
      if (sihuaMap[s]) p.sihua.push(s + "化" + sihuaMap[s]);
    });
    Object.keys(aux).forEach(function (s) {
      const p = palaces[aux[s]];
      p.auxStars.push({ name: s, sihua: sihuaMap[s] || "" });
      if (sihuaMap[s]) p.sihua.push(s + "化" + sihuaMap[s]);
    });
    Object.keys(peach).forEach(function (s) {
      palaces[peach[s]].peachStars.push({ name: s });
    });

    /* 13) 大限 */
    const yangGan = (yg % 2 === 0);
    const isMale = gender === "male";
    const forward = (yangGan && isMale) || (!yangGan && !isMale);  // 阳男阴女顺行
    for (let k = 0; k < 12; k++) {
      const idx = forward ? mod(mingIdx + k) : mod(mingIdx - k);
      const start = ju + k * 10;
      palaces[idx].daxian = { start: start, end: start + 9, order: k + 1 };
    }

    return {
      mingIdx, shenIdx,
      mingPalaceLabel: GAN[mingGan] + ZHI[mingIdx],
      ju, juName: JU_NAME[ju], nayin: nayinName,
      ziweiIdx, tianfuIdx: fuIdx,
      forward,
      palaces,
      starPos: stars,
      auxPos: aux,
      peachPos: peach,
      sihuaMap,
      sihuaYear: { gan: GAN[yg], 禄: sh.禄, 权: sh.权, 科: sh.科, 忌: sh.忌 }
    };
  }

  /* ---------- 取某宫（含对宫借星） ---------- */
  function getPalace(chart, name) {
    for (let i = 0; i < 12; i++) if (chart.palaces[i].name === name) return chart.palaces[i];
    return null;
  }
  function oppositePalace(chart, p) {
    return chart.palaces[mod(p.index + 6)];
  }
  // 三方四正：本宫 + 对宫 + 三合两宫
  function sanfangSizheng(chart, p) {
    return [p,
            chart.palaces[mod(p.index + 6)],
            chart.palaces[mod(p.index + 4)],
            chart.palaces[mod(p.index + 8)]];
  }

  global.ZiweiEngine = {
    GAN, ZHI, PALACE_NAMES, SIHUA, BRIGHT, JU_NAME,
    buildChart, getPalace, oppositePalace, sanfangSizheng,
    palaceGan, nayinOf, brightnessOf
  };
})(typeof window !== "undefined" ? window : this);
