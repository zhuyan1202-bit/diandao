// 点到 - 紫微斗数与八字融合命理引擎
(function (global) {
  const TIANGAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const DIZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

  const GAN_WUXING = {
    "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土",
    "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水"
  };
  const ZHI_WUXING = {
    "寅": "木", "卯": "木", "巳": "火", "午": "火", "申": "金", "酉": "金",
    "亥": "水", "子": "水", "辰": "土", "戌": "土", "丑": "土", "未": "土"
  };

  const ZHI_HIDDEN = {
    "子": ["癸"], "丑": ["己", "癸", "辛"], "寅": ["甲", "丙", "戊"], "卯": ["乙"],
    "辰": ["戊", "乙", "癸"], "巳": ["丙", "庚", "戊"], "午": ["丁", "己"], "未": ["己", "丁", "乙"],
    "申": ["庚", "壬", "戊"], "酉": ["辛"], "戌": ["戊", "辛", "丁"], "亥": ["壬", "甲"]
  };

  const WUXING_RELATIONS = {
    "木": { "木": "比", "火": "生", "土": "克", "金": "被克", "水": "被生" },
    "火": { "木": "被生", "火": "比", "土": "生", "金": "克", "水": "被克" },
    "土": { "木": "被克", "火": "被生", "土": "比", "金": "生", "水": "克" },
    "金": { "木": "克", "火": "被克", "土": "被生", "金": "比", "水": "生" },
    "水": { "木": "生", "火": "克", "土": "被克", "金": "被生", "水": "比" }
  };

  function getTenGod(dayGan, targetGan) {
    if (!dayGan || !targetGan) return "比肩";
    const dayIdx = TIANGAN.indexOf(dayGan);
    const targetIdx = TIANGAN.indexOf(targetGan);
    const samePolarity = (dayIdx % 2) === (targetIdx % 2);
    const dayWx = GAN_WUXING[dayGan];
    const targetWx = GAN_WUXING[targetGan];
    const rel = WUXING_RELATIONS[dayWx][targetWx];

    if (rel === "比") return samePolarity ? "比肩" : "劫财";
    if (rel === "生") return samePolarity ? "食神" : "伤官";
    if (rel === "克") return samePolarity ? "偏财" : "正财";
    if (rel === "被克") return samePolarity ? "七杀" : "正官";
    if (rel === "被生") return samePolarity ? "偏印" : "正印";
    return "比肩";
  }

  // 紫微十四主星在夫妻宫的深度意象
  const ZIWEI_SPOUSE_STARS = {
    "紫微": {
      name: "紫微星",
      nature: "帝王尊星",
      mateTrait: "伴侣气质高贵，自尊心极强，有领导气度与才干，在职场或社交圈中颇具声望。",
      dynamics: "相处时需给足对方体面与崇拜感。虽然偶尔略显强势，但对家庭极具担当与保护欲。",
      pros: "能成为你事业与人生的坚强后盾，婚后家庭体面风光。",
      cons: "爱面子、嘴硬，不善于轻易认错，需要你用温柔和智慧适度给台阶。"
    },
    "天机": {
      name: "天机星",
      nature: "谋略智星",
      mateTrait: "伴侣思维灵动敏捷，足智多谋，兴趣广泛，充满书卷气或技术极客气质。",
      dynamics: "极其注重精神共鸣与日常智力交流。若缺乏共同话题容易感到无趣。",
      pros: "情商智商双在线，懂变通，是人生出谋划策的军师型伴侣。",
      cons: "心思多变容易焦虑，情绪有时敏感内耗，偶有神经质。"
    },
    "太阳": {
      name: "太阳星",
      nature: "光明博爱星",
      mateTrait: "伴侣性格开朗热情，行事光明磊落，乐于助人，有阳刚健朗的气场。",
      dynamics: "感情热烈坦诚，毫无隐瞒。女命逢之易得体贴能干之夫，男命逢之伴侣性格巾帼不让须眉。",
      pros: "忠诚坦荡，积极阳光，能时刻给你带来正能量与满满的安全感。",
      cons: "有时对朋友比对伴侣还要操心，容易大包大揽导致自己疲惫。"
    },
    "武曲": {
      name: "武曲星",
      nature: "财帛将星",
      mateTrait: "伴侣务实干练，责任心极重，执行力强，擅长财富积累与实业拼搏。",
      dynamics: "感情表达内敛实在，不善甜言蜜语，但会把爱化为存折和实实在在的物质保障。",
      pros: "极其可靠，经济观念强，婚后财富运势蒸蒸日上。",
      cons: "性格稍显耿直刚硬，缺乏浪漫情调，相处需要多注入温情柔和剂。"
    },
    "天同": {
      name: "天同星",
      nature: "福德纯真星",
      mateTrait: "伴侣性格温和纯良，天真随和，幽默风趣，富有童心与生活情趣。",
      dynamics: "相处如沐春风，注重生活舒适度。喜欢撒娇或被照顾，感情甜美浪漫。",
      pros: "脾气极好，不记仇，懂知足常乐，能极大缓解你的生活焦虑。",
      cons: "有时缺乏一点上进野心与决断力，面对现实风浪容易退缩依赖。"
    },
    "廉贞": {
      name: "廉贞星",
      nature: "次桃花烈性星",
      mateTrait: "伴侣五官精致，辨识度极高，极具异性吸引力与个人魅力，爱憎分明。",
      dynamics: "感情浓烈深邃，追求纯粹的忠诚与占有。若相爱则倾尽全力，若背叛则决绝无情。",
      pros: "专一深情，对你极度护短，生活充满激情与浪漫色彩。",
      cons: "猜忌心与占有欲较强，感情中容易钻牛角尖，需建立极度透明的信任。"
    },
    "天府": {
      name: "天府星",
      nature: "财库令星",
      mateTrait: "伴侣气度沉稳儒雅，端庄从容，懂得享受生活品位，顾家且擅长理财。",
      dynamics: "夫妻关系稳固如泰山，彼此信任包容，属于细水长流、白头到老的典范组合。",
      pros: "包容度极大，擅长安顿家庭内外，婚后生活衣食无忧、安享福禄。",
      cons: "有时较为保守固执，害怕突如其来的变动与风险，缺乏即兴冒险精神。"
    },
    "太阴": {
      name: "太阴星",
      nature: "月曜柔情星",
      mateTrait: "伴侣容貌清秀温婉，眼神多情，举止斯文优雅，内心极其细腻柔软。",
      dynamics: "重情重义，擅长照顾人的情绪，注重家庭氛围营造。男命逢之多得贤内助。",
      pros: "体贴入微，懂你的每一个微小表情，是避风港般的温暖存在。",
      cons: "内心脆弱容易患得患失，被动克制，遇到委屈喜欢暗自垂泪生闷气。"
    },
    "贪狼": {
      name: "贪狼星",
      nature: "第一主桃花星",
      mateTrait: "伴侣风趣幽默，魅力四射，八面玲珑，极懂浪漫情调与异性心理。",
      dynamics: "恋爱过程充满电影般的波澜起伏与甜蜜心跳。双方必须保持新鲜感与自身吸引力。",
      pros: "永远不会让你感到枯燥无味，生活处处是惊喜与浪漫情调。",
      cons: "异性缘过于旺盛，自身需防范外界烂桃花骚扰，感情需要坚定的道德契约维系。"
    },
    "巨门": {
      name: "巨门星",
      nature: "暗星法官星",
      mateTrait: "伴侣口才出众，观察敏锐，逻辑思维严密，具备极强的洞察力与批判思维。",
      dynamics: "相处中需要极其坦诚清晰的言语沟通。稍有隐瞒就容易引发口角怀疑。",
      pros: "看人极准，能帮你识破身边的小人与陷阱，是不可多得的事业参谋。",
      cons: "言辞有时尖锐刻薄，容易在争吵中说气话伤人，需谨防“祸从口出”。"
    },
    "天相": {
      name: "天相星",
      nature: "宰相印星",
      mateTrait: "伴侣五官端正帅气/清丽，衣品讲究，言行举止得体大方，极有人缘。",
      dynamics: "双方往往注重门当户对与外界眼光评价，婚姻受到长辈亲友的一致祝福赞许。",
      pros: "处事圆融周全，能完美操持家庭社交，让你在亲友面前极有面子。",
      cons: "有时较为注重世俗体面，遇到冲突习惯粉饰太平，压抑真实的个人情绪。"
    },
    "天梁": {
      name: "天梁星",
      nature: "老成荫庇星",
      mateTrait: "伴侣沉稳老练，有长辈风范，品行端正，自带一种令人心安的威严与仁厚。",
      dynamics: "多适合年龄相差 3-8 岁的良缘配对。对方如同长辈一般在生活与精神上庇护你。",
      pros: "逢凶化吉的福将，遇到任何人生危机都能沉着应对，为你遮风挡雨。",
      cons: "有时过于说教、爱讲大道理，略显古板严肃，缺乏年轻人该有的轻快浪漫。"
    },
    "七杀": {
      name: "七杀星",
      nature: "孤勇战神星",
      mateTrait: "伴侣独立果敢，性格刚毅冷峻，不拘小节，有强烈的个人主见与冒险家精神。",
      dynamics: "感情往往一见钟情、爱得轰轰烈烈。但因双方个性皆要强，宜经历一番磨砺后晚婚更吉。",
      pros: "极具担当，一诺千金，关键时刻能为你豁出一切冲锋陷阵。",
      cons: "脾气急躁倔强，不喜妥协低头，在小事琐事上缺乏耐心。"
    },
    "破军": {
      name: "破军星",
      nature: "先破后立变曜星",
      mateTrait: "伴侣特立独行，敢爱敢恨，不走寻常路，性格带有极强的开拓性与颠覆性。",
      dynamics: "婚恋易有先破后立之象（如经历过一次深刻遗憾后方懂珍惜，或打破传统世俗束缚结合）。",
      pros: "敢于为你对抗全世界，一旦认定你便有斩断一切过往的勇气。",
      cons: "情绪起伏大，厌倦平淡重复的生活，需共同寻找新鲜的人生挑战。"
    }
  };

  /* ==========================================================================
   * 以下为 P0 重写部分：接入真实历法与真实紫微排盘
   * 依赖：calendar_core.js (global.CalendarCore) + ziwei_engine.js (global.ZiweiEngine)
   * ========================================================================== */

  const CAL = global.CalendarCore;
  const ZW  = global.ZiweiEngine;

  // 12 个「节」的 k 值（偶数项），k → 月支序号
  const JIE_KS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
  function jieToMonthZhi(k) { return (k / 2 + 1) % 12; }

  // 出生时刻 → 以「日 + 小数」表示的可比较数值
  function momentOf(y, m, d, hour, minute) {
    return CAL.dayNumber(y, m, d) + (hour + (minute || 0) / 60) / 24;
  }
  function termMoment(year, k) {
    const t = CAL.solarTermDate(year, k);
    return t.dayNum + (t.hour + t.minute / 60) / 24;
  }

  /**
   * 节气精确八字
   * @returns {yGanIdx,yZhiIdx,mGanIdx,mZhiIdx,dGanIdx,dZhiIdx,hGanIdx,hZhiIdx,
   *           solarTermName, nearestTermGapHours, dayAdvanced}
   */
  function computeBazi(y, m, d, hour, minute) {
    const mo = momentOf(y, m, d, hour, minute);

    /* --- 年柱：以立春(k=2)为界 --- */
    const lichun = termMoment(y, 2);
    const ganzhiYear = (mo < lichun) ? y - 1 : y;
    const off = ganzhiYear - 4;
    const yGanIdx = ((off % 10) + 10) % 10;
    const yZhiIdx = ((off % 12) + 12) % 12;

    /* --- 月柱：找出 <= 出生时刻的最近一个「节」 --- */
    let bestK = null, bestMo = -Infinity, bestName = "";
    for (let dy = -1; dy <= 1; dy++) {
      for (let i = 0; i < JIE_KS.length; i++) {
        const k = JIE_KS[i];
        const tm = termMoment(y + dy, k);
        if (tm <= mo && tm > bestMo) { bestMo = tm; bestK = k; bestName = CAL.TERM_NAMES[k]; }
      }
    }
    const mZhiIdx = jieToMonthZhi(bestK);
    // 五虎遁：年干 → 寅月天干
    const yinGan = [2, 4, 6, 8, 0][yGanIdx % 5];
    const mGanIdx = (yinGan + (((mZhiIdx - 2) % 12) + 12) % 12) % 10;

    /* --- 日柱：2000-01-01 = 戊午；23:00 后进位次日 --- */
    const dayAdvanced = hour >= 23;
    let dn = CAL.dayNumber(y, m, d) + (dayAdvanced ? 1 : 0);
    const base = CAL.dayNumber(2000, 1, 1);
    const diff = dn - base;
    const dGanIdx = (((4 + diff) % 10) + 10) % 10;
    const dZhiIdx = (((6 + diff) % 12) + 12) % 12;

    /* --- 时柱：五鼠遁 --- */
    const hZhiIdx = Math.floor((((hour + 1) % 24) + 24) % 24 / 2);
    const hGanIdx = ([0, 2, 4, 6, 8][dGanIdx % 5] + hZhiIdx) % 10;

    /* --- 节气边界预警（太阳黄经算法精度约 ±15 分钟） --- */
    let minGap = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let i = 0; i < JIE_KS.length; i++) {
        const g = Math.abs(mo - termMoment(y + dy, JIE_KS[i])) * 24;
        if (g < minGap) minGap = g;
      }
    }

    return {
      yGanIdx, yZhiIdx, mGanIdx, mZhiIdx, dGanIdx, dZhiIdx, hGanIdx, hZhiIdx,
      ganzhiYear, solarTermName: bestName, nearestTermGapHours: minGap, dayAdvanced
    };
  }

  /* ---------- 四化落宫描述 ---------- */
  const SIHUA_DESC = {
    "禄": "夫妻宫逢化禄：这段关系天然带有滋养感——对方愿意给，你也接得住。缘分来得顺，相处有甜味，物质与情绪都容易被照顾到。",
    "权": "夫妻宫逢化权：伴侣有能力、有主见，在关系里握有话语权。好处是靠得住，代价是你得学会和一个「不容易被说服的人」协商。",
    "科": "夫妻宫逢化科：相敬如宾的格局，彼此体面、有分寸、讲道理。感情稳，但要小心「太客气」而少了热度。",
    "忌": "夫妻宫逢化忌：这是一份带执念的缘分。你对感情投入深、放不下，也容易被同一类课题反复考验。晚婚、或先把自我建好再进入关系，是常见的化解方式。"
  };

  /**
   * 真实紫微排盘 → 输出保持原有字段契约
   */
  function deriveZiweiPalaces(y, m, d, hour, minute, bazi, gender) {
    // 农历（紫微用农历月日）；23:00 后按次日起盘
    let sy = y, sm = m, sd = d;
    if (hour >= 23) {
      const g = CAL.jdToGregorian(CAL.dayNumber(y, m, d) + 1 - 0.5);
      sy = g.y; sm = g.m; sd = Math.floor(g.d);
    }
    const lun = CAL.solarToLunar(sy, sm, sd);

    // 闰月通行处理：上半月(<=15)算本月，下半月算下月
    let useMonth = lun.lMonth;
    if (lun.isLeap && lun.lDay > 15) useMonth = (lun.lMonth % 12) + 1;

    const chart = ZW.buildChart({
      lunarMonth: useMonth,
      lunarDay: lun.lDay,
      hourIdx: bazi.hZhiIdx,
      yearGanIdx: bazi.yGanIdx,
      yearZhiIdx: bazi.yZhiIdx,
      gender: gender === "male" ? "male" : "female"
    });

    const fq  = ZW.getPalace(chart, "夫妻宫");
    const opp = ZW.oppositePalace(chart, fq);

    // 主星（空宫借对宫）
    let borrowed = false;
    let mains = fq.mainStars;
    if (mains.length === 0) { mains = opp.mainStars; borrowed = true; }
    const mainNames = mains.map(function (s) { return s.name; });
    const primaryKey = mainNames[0] || "天相";
    const data = ZIWEI_SPOUSE_STARS[primaryKey] || ZIWEI_SPOUSE_STARS["天相"];

    let primaryStar;
    if (borrowed) {
      primaryStar = "夫妻宫空宫 · 借对宫" + mainNames.map(function (n, i) {
        return n + "(" + mains[i].brightness + ")";
      }).join("");
    } else {
      primaryStar = mains.map(function (s) { return s.name + "(" + s.brightness + ")"; }).join(" ");
    }

    // 四化：优先本宫生年四化，其次三方四正
    let sihuaKey = "", sihuaSrc = "";
    const inPalace = fq.mainStars.concat(fq.auxStars).filter(function (s) { return s.sihua; });
    if (inPalace.length) {
      sihuaKey = inPalace[0].sihua;
      sihuaSrc = fq.gan + fq.branch + "宫内 " + inPalace.map(function (s) { return s.name + "化" + s.sihua; }).join("、");
    } else {
      const oppHua = opp.mainStars.concat(opp.auxStars).filter(function (s) { return s.sihua; });
      if (oppHua.length) {
        sihuaKey = oppHua[0].sihua;
        sihuaSrc = "对宫(官禄)" + oppHua.map(function (s) { return s.name + "化" + s.sihua; }).join("、") + "，四化冲照夫妻宫";
      }
    }
    const sihua = sihuaKey ? ("化" + sihuaKey) : "本宫无生年四化";
    const sihuaDesc = sihuaKey
      ? SIHUA_DESC[sihuaKey] + "（来源：" + sihuaSrc + "）"
      : "夫妻宫与对宫均无生年四化落入：感情课题不算命定的重灾区，起伏更多来自流年与你自己的选择，主动权在你手上。";

    // 辅星（吉/煞）
    const GOOD = { "文昌":"伴侣有文采、讲究情调，沟通带温度","文曲":"对方口才好、懂表达，容易一句话把你哄住",
                   "左辅":"婚姻有实质助力，遇事有人搭把手","右弼":"人缘与助缘旺，关系里不缺帮手",
                   "天魁":"伴侣自带贵人相，常在关键时刻拉你一把","天钺":"暗中贵人扶持，缘分往往由人介绍而来",
                   "禄存":"夫妻宫带财库，婚后经济基础稳固","天马":"聚少离多或异地缘，也主因动而生情" };
    const BAD  = { "擎羊":"相处易有言语锋芒，争执来得快去得也快","陀罗":"问题容易拖着不解决，纠缠反复",
                   "火星":"脾气来得急，冲动之下容易说重话","铃星":"闷火型，不说破但心里记账",
                   "地空":"感情里常有落空感，期待与现实有落差","地劫":"易遇突发变数，也主为情破财" };
    const assistantStars = [];
    fq.auxStars.forEach(function (s) {
      if (GOOD[s.name]) assistantStars.push({ name: s.name, type: "吉", desc: GOOD[s.name] });
      else if (BAD[s.name]) assistantStars.push({ name: s.name, type: "煞", desc: BAD[s.name] });
    });
    const PEACH = { "红鸾":"红鸾入夫妻宫，正缘感应强，遇缘多在明处","天喜":"天喜同宫，喜事牵引，容易在热闹场合遇人",
                    "天姚":"天姚带风情，魅力强但也易招暧昧","咸池":"咸池桃花，情感浓烈，需辨真心与一时心动",
                    "孤辰":"孤辰入宫，内心有独处需求，早婚易感孤单","寡宿":"寡宿入宫，情感上偏克己自守，宜晚婚",
                    "天刑":"天刑主自律与约束，感情讲原则，易因规矩生隙","华盖":"华盖主孤高，精神世界丰富但知音难求" };
    fq.peachStars.forEach(function (s) {
      if (PEACH[s.name]) assistantStars.push({ name: s.name, type: (s.name==="孤辰"||s.name==="寡宿"||s.name==="华盖") ? "煞" : "桃花", desc: PEACH[s.name] });
    });

    const mingP = ZW.getPalace(chart, "命宫");
    const fudeP = ZW.getPalace(chart, "福德宫");

    return {
      spousePalace: {
        primaryStar: primaryStar,
        primaryStarKey: primaryKey,
        mainStarNames: mainNames,
        borrowed: borrowed,
        branch: fq.branch,
        gan: fq.gan,
        nature: data.nature,
        detail: data,
        assistantStars: assistantStars,
        sihua: sihua,
        sihuaDesc: sihuaDesc,
        daxian: fq.daxian,
        oppositeStars: opp.mainStars.map(function (s) { return s.name + "(" + s.brightness + ")"; }).join(" ") || "（空宫）"
      },
      mingPalace: {
        star: (mingP.mainStars.map(function (s) { return s.name; }).join("") || "空宫"),
        branch: mingP.branch, gan: mingP.gan,
        stars: mingP.mainStars
      },
      fudePalace: {
        star: (fudeP.mainStars.map(function (s) { return s.name; }).join("") || "空宫"),
        branch: fudeP.branch,
        stars: fudeP.mainStars
      },
      shenPalace: ZW.PALACE_NAMES[((chart.mingIdx - chart.shenIdx) % 12 + 12) % 12],
      ju: chart.ju,
      juName: chart.juName,
      nayin: chart.nayin,
      palaces: chart.palaces,
      sihuaYear: chart.sihuaYear,
      lunar: null,   // 由上层填入
      raw: chart
    };
  }

  // 完整排盘计算入口
  const CITY_LONGITUDES = {
    "默认 (东经120°标准时)": 120.00,
    "北京": 116.40, "上海": 121.47, "广州": 113.26, "深圳": 114.06,
    "杭州": 120.15, "南京": 118.78, "成都": 104.07, "重庆": 106.55,
    "武汉": 114.30, "西安": 108.94, "郑州": 113.62, "长沙": 112.94,
    "天津": 117.20, "苏州": 120.58, "合肥": 117.23, "福州": 119.30,
    "厦门": 118.09, "济南": 117.00, "青岛": 120.38, "沈阳": 123.43,
    "大连": 121.61, "长春": 125.32, "哈尔滨": 126.64, "石家庄": 114.51,
    "太原": 112.55, "呼和浩特": 111.75, "南昌": 115.86, "南宁": 108.37,
    "海口": 110.33, "贵阳": 106.63, "昆明": 102.71, "拉萨": 91.13,
    "兰州": 103.83, "西宁": 101.78, "银川": 106.23, "乌鲁木齐": 87.62,
    "香港": 114.17, "澳门": 113.54, "台北": 121.56
  };

  /**
   * 计算天文真太阳时（经度平太阳时差 + 地球公转椭圆轨道均时差 Equation of Time）
   */
  function computeTrueSolarTime(year, month, day, hour, minute, longitude, city = "") {
    const lon = typeof longitude === "number" && !isNaN(longitude) ? longitude : 120.0;
    // 1. 经度时差：每度4分钟（东经120度为北京时间基准）
    const lonDeltaMin = (lon - 120.0) * 4.0;
    // 2. 均时差（Equation of Time）
    const startOfYear = new Date(year, 0, 1);
    const curDate = new Date(year, month - 1, day);
    const dayOfYear = Math.floor((curDate - startOfYear) / 86400000) + 1;
    const B = (2 * Math.PI * (dayOfYear - 81)) / 365.2422;
    const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

    // 若选择“默认 (东经120°标准时)”且未指定特殊城市，则仅按标准时间或可选开启真太阳时
    const isDefaultClock = (city.indexOf("默认") >= 0 && Math.abs(lon - 120.0) < 0.01);
    const totalDeltaMin = isDefaultClock ? 0 : Math.round(lonDeltaMin + eotMin);

    const baseMs = new Date(year, month - 1, day, hour, minute, 0).getTime();
    const trueDate = new Date(baseMs + totalDeltaMin * 60000);

    const ty = trueDate.getFullYear();
    const tm = trueDate.getMonth() + 1;
    const td = trueDate.getDate();
    const th = trueDate.getHours();
    const tmin = trueDate.getMinutes();

    const pad = n => String(n).padStart(2, "0");
    return {
      year: ty, month: tm, day: td, hour: th, minute: tmin,
      clockTimeStr: `${pad(hour)}:${pad(minute)}`,
      trueTimeStr: `${pad(th)}:${pad(tmin)}`,
      totalDeltaMin,
      lonDeltaMin: Math.round(lonDeltaMin),
      eotMin: Math.round(eotMin),
      longitude: lon,
      city: city || "默认 (东经120°标准时)",
      isCalibrated: !isDefaultClock
    };
  }

  const MING_RECTIFY_TRAITS = {
    "紫微": "骨子里自尊心极强、有主见，不喜欢被人管束或居于人下，哪怕表面随和，关键事一定自己拿主意，自带气场。",
    "天机": "大脑转速极快、点子多、洞察力敏锐，闲不住，但容易想太多、思虑过重，睡眠较浅或偶尔精神内耗。",
    "太阳": "性格光明磊落、热心肠、爱照顾人或替人操心，好面子，在外面比在家里更活跃，说话直接不喜欢弯弯绕绕。",
    "武曲": "行动派、执行力极强、讲求实际效率与结果，对钱财数字敏感，性格偏刚毅干脆，不喜欢拖泥带水。",
    "天同": "性格温和、重生活品质与精神舒适度，不爱与人正面起冲突，随遇而安，有时略带一点拖延或心软。",
    "廉贞": "爱憎分明、原则感与边界感极强，要么不做要么做到极致，眼神有神，对审美或专业细节有独特挑剔度。",
    "天府": "性格稳重、有包容力、擅长统筹规划与守成，重视安全感与储蓄底气，处事圆融不激进。",
    "太阴": "心思细腻敏感、注重家庭氛围与内心安全感，观察力强，情绪容易受环境影响，偏内敛含蓄。",
    "贪狼": "兴趣广泛、社交手腕灵活、善于交际或学习新事物，好奇心强，不喜欢枯燥重复的一成不变生活。",
    "巨门": "表达欲或思辨力强、看问题一针见血，天生带一点怀疑精神，凡事要搞清楚底层逻辑才肯信服。",
    "天相": "注重仪表形象与公平体面，处事讲究分寸与平衡，乐于助人，适合做协调者或品质把关者。",
    "天梁": "自带长辈/老师风范，心肠软但嘴上爱讲道理，责任心重，遇到危机往往能逢凶化吉。",
    "七杀": "果断干练、敢闯敢拼、独立性极强，遇事不喜欢求助别人，越有挑战越兴奋，脾气来得快去得也快。",
    "破军": "极具开创性与颠覆精神，不喜欢墨守成规，人生经历或职业/感情往往有“推倒重来”的大破大立体验。"
  };

  /**
   * 针对不确定具体分钟、仅知时间区间的用户：
   * 计算该区间经当地真太阳时修正后，跨越了哪几个时辰，并生成每个候选时辰的排盘与定盘特征对比
   */
  // ==================== 动态差异最大化定盘引擎（随生辰与候选盘动态生成专属断口题） ====================

  // 1. 生年化忌落宫的具体现实痛点（人生最容易卡壳/执着/吃亏的领域，随出生年干+时辰100%动态变化）
  const SIHUA_JI_PAIN = {
    "命宫": "骨子里极度自我较劲，凡事喜欢亲力亲为、不放心交给别人，容易因为想得太多或原则性太强而让自己陷入精神劳碌",
    "兄弟宫": "在平辈朋友、合伙人或兄弟姐妹关系上容易吃亏，曾有过借钱给朋友难收回、或与亲近伙伴因利益/观念分道扬镳的经历",
    "夫妻宫": "感情婚恋是你人生最核心的修炼场：对待感情极度认真甚至有些执念，过往恋爱容易遇到沟通频道错位、冷战拉扯或晚婚",
    "子女宫": "对晚辈、下属、宠物或自己孵化的作品/项目倾注过多心血；在合伙投资或娱乐消费上曾有过意外破耗",
    "财帛宫": "对钱财既看重又容易焦虑，手头刚攒下一笔钱就容易出现计划外的大额花销（如人情、救急、垫资），现金流常处于动态周转中",
    "疾厄宫": "从小到大体质偏敏感，或幼年/青少年时期有过一次较明显的生病住院、手术、肠胃或过敏调理经历，身体一旦劳累立刻报警",
    "迁移宫": "出门在外、换城市发展或出差奔波时，初期容易遇到水土不服、行程临时变动或小人是非，属于“在家千日好、出门需谨慎”体质",
    "奴仆宫": "在工作中容易遇到难缠的客户、不省心的下属或团队甩锅侠，常需要替别人的失误擦屁股，人际协调消耗较大",
    "交友宫": "在平辈社交、团队合作或客户往来中容易遇到甩锅侠或不对等付出，常需要替他人的失误善后，人际协调消耗较大",
    "官禄宫": "对事业成就要求极高，工作上常承担核心攻坚任务或高压指标，曾经历过至少一次行业赛道转换、跳槽改行或学业/考证上的波折",
    "田宅宫": "在房产置业、租房搬家或房屋装修上曾费过不少周折（如频繁搬家、邻里噪音或合同纠纷），对家庭内部安全感极为看重",
    "福德宫": "表面看起来通透淡定，但内心深处极易精神内耗，夜深人静时常反复复盘过往得失，睡眠浅且对精神伴侣的要求极高",
    "父母宫": "与父母长辈（尤其是父亲或直属上司）之间存在明显的代沟或观念碰撞，早年求学或考取重要资质文书时曾经历过波折重考"
  };

  // 2. 疾厄宫星曜与五行对应的真实身体薄弱部位（客观生理体感，绝不雷同）
  const JIE_HEALTH_TRAITS = {
    "紫微": "脾胃消化系统偏弱（容易胃胀、反酸或饮食不规律引发肠胃不适），且睡眠时对光线或声音较挑剔",
    "天机": "肝胆与神经系统偏敏感，容易出现颈椎肩颈酸痛、偏头痛、思虑过多导致的入睡困难或四肢偶尔发麻",
    "太阳": "心火或肝火偏旺，容易出现眼睛干涩疲劳、熬夜后口腔上火/嗓子发炎、血压或心血管波动",
    "武曲": "呼吸系统与肺部偏敏感，换季容易鼻炎、咽喉干痒、咳嗽，或皮肤较干燥、年轻时有过牙齿/骨骼外伤",
    "天同": "肾水与内分泌代谢偏弱，容易出现水肿、体寒怕冷、湿气重、泌尿系统敏感或一累就嗜睡乏力",
    "廉贞": "免疫与心血系统敏感，情绪急躁时容易引发皮肤过敏/痘疹、口腔溃疡、心悸或失眠多梦",
    "天府": "脾胃吸收功能极强但容易积食发胖、胃动力不足或湿热困脾，需要控制甜食与夜宵",
    "太阴": "内分泌、睡眠节律或眼部/妇科（男命为肾水肠胃）偏敏感，情绪波动会直接反映在肠胃或睡眠质量上",
    "贪狼": "肝胆代谢与应酬消耗较大，容易出现熬夜后的疲劳积累、皮肤油脂分泌不均或筋骨关节酸痛",
    "巨门": "咽喉、扁桃体、口腔及消化道（食道、肠胃）是薄弱点，说话多或受凉后极易嗓子不适或肠胃胀气",
    "天相": "皮肤敏感、排毒代谢或血糖/泌尿循环需留意，饮食口味偏重时容易出现身体浮肿或皮肤小疹子",
    "天梁": "脾胃虚寒或慢性鼻炎/咽炎，遇到压力时容易胃痛、消化不良，但身体自我恢复力与耐受力较强",
    "七杀": "肺部呼吸道、肠胃急症或运动/磕碰外伤，性格急躁时容易引发急性炎症或筋骨拉伤",
    "破军": "牙齿、骨骼关节、皮肤疤痕或免疫系统波動，作息极度不规律时容易引发突发性感冒或肠胃炎"
  };

  // 3. 父母宫星曜对应的原生家庭与长辈管教风格
  const FUMU_FAMILY_TRAITS = {
    "紫微": "父母（尤其父亲）在家里很有威严、说一不二，对你从小要求高、期望大，家庭规矩感强",
    "天机": "父母思维活跃或工作变动较多，早年与你沟通像朋友但有时情绪变化快，家里常有搬动或装修变化",
    "太阳": "父亲或母亲一方性格极极其爽朗热心、在外面人缘好爱张罗，但在家里脾气较急、说话声音大不藏事",
    "武曲": "父母務实能干、极其看重经济基础与自立能力，对你属于“行动上给支持、嘴上不爱说软话”的硬核管教",
    "天同": "父母性格相对温和慈祥、不爱用棍棒高压管教，家庭氛围偏宽松，长辈对你比较宠爱或顺从你的意愿",
    "廉贞": "父母原则性极强、脾气较倔，早年对你管教严格甚至有些挑剔，两代人之间容易因为观念不同而硬碰硬",
    "天府": "家庭底子稳健或父母处事保守稳重，从小衣食安全感充足，长辈注重传统礼数与稳定发展",
    "太阴": "母亲在家庭中付出极多、心思细腻温柔（或父亲性格偏内敛温和），早年受女性长辈照顾与影响极深",
    "贪狼": "父母社交广泛、爱好丰富或做生意/搞技术出身，家里人来人往较热闹，对你兴趣爱好的发展比较开明",
    "巨门": "父母说话一针见血、爱讲大道理或要求极其细致，早年家里容易有拌嘴争论，促使你很早就学会独立思考",
    "天相": "父母注重体面、待人接物讲究分寸，在亲友圈中口碑好，从小教你为人处世要讲规矩、重仪表",
    "天梁": "父母自带长辈/老师般的威严与操心体质，爱唠叨但心肠极软，遇到大事总是第一时间替你兜底",
    "七杀": "父母性格风风火火、脾气急躁直接，早年管教偏严厉，或者你很早就离开父母独自住校/外出闯荡独立",
    "破军": "原生家庭早年经历过较大的经济起伏、搬迁换城市或父母工作大变动，让你从小就比同龄人更早熟独立"
  };

  // 4. 流年宫位应事描述
  const PALACE_EVENT_DESC = {
    "命宫": "个人身份转换、独立做决定或人生方向发生关键转折，把重心完全收回到自己身上",
    "兄弟宫": "朋友圈层、合伙人或闺蜜兄弟关系大洗牌，或者有较大额的现金流周转与人情往来",
    "夫妻宫": "感情关系出现关键节点（遇到深刻的人、确立/结束关系、或伴侣之间经历深刻磨合）",
    "子女宫": "孵化新项目、培养新技能/爱好、养宠物，或社交娱乐、桃花应酬明显增多",
    "财帛宫": "赚钱模式改变、薪资结构调整，或有一笔数额较大的计划外支出/投资开销",
    "疾厄宫": "身体健康体检调理、作息重塑，或因工作劳累倒逼你放慢脚步修养身心",
    "迁移宫": "换城市发展、频繁出差远行、搬换办公地点，或外部市场变动促使你向外跑动开拓",
    "奴仆宫": "团队同事大换血、客户圈层调整，在处理他人琐事与人际配合上耗费了大量精力",
    "交友宫": "团队同事与合作圈层大换血，在社交往来、客户协调或处理朋友琐事上耗费了大量心力",
    "官禄宫": "职场岗位晋升/跳槽、考证升学攻坚、业务赛道调整，事业突破成为全年的绝对重心",
    "田宅宫": "买房租房、搬家装修、不动产处理，或原生家庭内部事务牵扯了你最多的精力",
    "福德宫": "精神世界的深度蜕变、心态与人生观彻底重塑，表面平静但内心想通了很多关键问题",
    "父母宫": "处理与长辈父母健康、直属领导变更、体制单位或重要文书契约/牌照资质相关的事务"
  };

  /**
   * 动态差异最大化定盘问卷生成器：
   * 根据用户具体的出生日期与候选时辰盘（A盘 vs B盘），实时计算两盘在【生年化忌痛点】【疾厄生理体感】【原生家庭父母管教】【2024-2025真实流年事件】上的最大差异断口，生成专属定盘题！
   */
  function buildRectifyQuiz(candidates) {
    if (!candidates || !candidates.length) return [];
    let cands = candidates;
    if (cands.length === 1 && cands[0].chart) {
      const p = cands[0].chart.profile;
      const prevH = (p.hour - 2 + 24) % 24;
      const altChart = analyzeFullNatalChart({
        year: p.year, month: p.month, day: p.day,
        hour: prevH, minute: p.minute || 0,
        city: p.city, gender: p.gender, status: p.status
      });
      const mingPal = altChart.ziwei.mingPalace || {};
      const mStars = (mingPal.stars || []).map(s => s.name);
      cands = [
        cands[0],
        {
          zhiIdx: (cands[0].zhiIdx - 1 + 12) % 12,
          shichenName: DIZHI[(cands[0].zhiIdx - 1 + 12) % 12] + "时（前一时辰对照）",
          prob: 30,
          clockHour: prevH,
          clockMinute: p.minute || 0,
          hourPillar: altChart.bazi.hourPillar,
          mingBranch: mingPal.branch,
          mingStars: mStars.join("·") || "借对宫星曜",
          spouseStars: (altChart.ziwei.spousePalace.mainStarNames || []).join("·") || "借对宫",
          traitText: mStars.map(n => `【${n}】${MING_RECTIFY_TRAITS[n] || ""}`).join("；") || "性格沉稳内敛。",
          chart: altChart
        }
      ];
    }

    const getPalaceByBranch = (chart, branchName) => {
      const pals = (chart.ziwei && chart.ziwei.palaces) || [];
      return pals.find(x => x.branch === branchName) || { name: "命宫", mainStars: [] };
    };
    const getPalaceByName = (chart, name) => {
      const pals = (chart.ziwei && chart.ziwei.palaces) || [];
      return pals.find(x => x.name === name) || { name, mainStars: [] };
    };
    const getPrimaryStar = (chart, palName) => {
      const pal = getPalaceByName(chart, palName);
      const ms = (pal.mainStars || []).map(s => s.name);
      if (ms.length) return ms[0];
      // 若本宫空宫，取对宫主星
      const pals = (chart.ziwei && chart.ziwei.palaces) || [];
      const idx = pals.findIndex(x => x.name === palName);
      if (idx >= 0) {
        const opp = pals[(idx + 6) % 12];
        const oms = (opp && opp.mainStars || []).map(s => s.name);
        if (oms.length) return oms[0];
      }
      return "天机";
    };

    // 找出每个候选盘中【生年化忌】落入的宫位名称
    const getHuaJiPalaceName = chart => {
      const pals = (chart.ziwei && chart.ziwei.palaces) || [];
      const sy = (chart.ziwei && chart.ziwei.sihuaYear) || {};
      const jiStar = sy["忌"];
      for (let i = 0; i < pals.length; i++) {
        const allS = (pals[i].mainStars || []).concat(pals[i].auxStars || []);
        if (allS.some(s => s.sihua === "忌" || (jiStar && s.name === jiStar))) {
          return { palName: pals[i].name, starName: jiStar || "主星" };
        }
      }
      return { palName: "福德宫", starName: "主星" };
    };

    const sampleProfile = cands[0].chart.profile;
    const birthYearStr = `${sampleProfile.year}年${sampleProfile.month}月${sampleProfile.day}日`;

    // ==================== 题目 1：生年化忌落宫痛点核对（100% 随生年天干与时辰移位！） ====================
    const q1 = {
      id: "q1",
      dimension: `第一维 · 专属生年化忌落宫核对（${birthYearStr}出生者核心痛点分水岭）`,
      question: `根据你的出生年天干，不同出生时辰会导致你命盘的「生年化忌（人生最容易卡壳、反复磨合或吃亏的领域）」落入截然不同的宫位。回顾你过往的人生体验，哪一项是你最明显的“痛点”？`,
      options: cands.map((c, idx) => {
        const jiInfo = getHuaJiPalaceName(c.chart);
        const painDesc = SIHUA_JI_PAIN[jiInfo.palName] || SIHUA_JI_PAIN["福德宫"];
        return {
          candIdx: idx,
          shichenName: c.shichenName,
          label: `生年化忌落入【${jiInfo.palName}】：${painDesc}。（对应${c.shichenName}盘 · 时柱${c.hourPillar}）`
        };
      })
    };

    // ==================== 题目 2：2024甲辰 / 2025乙巳 过往真实应事铁证 ====================
    const q2 = {
      id: "q2",
      dimension: "第二维 · 2024–2025 过往两年真实经历回溯（客观事件铁证 · 权重最高）",
      question: "性格可以模棱两可，但发生过的事不会撒谎。回想刚刚过去的 2024年（甲辰年）与 2025年（乙巳年），你现实生活中最核心的精力牵扯或变动发生在哪条主线上？",
      options: cands.map((c, idx) => {
        const pal2024 = getPalaceByBranch(c.chart, "辰");
        const pal2025 = getPalaceByBranch(c.chart, "巳");
        const d24 = PALACE_EVENT_DESC[pal2024.name] || "个人事务调整";
        const d25 = PALACE_EVENT_DESC[pal2025.name] || "外部环境变化";
        return {
          candIdx: idx,
          shichenName: c.shichenName,
          label: `2024年重心在【${pal2024.name}】（${d24}） ➔ 2025年重心转向【${pal2025.name}】（${d25}）。（对应${c.shichenName}盘）`
        };
      })
    };

    // ==================== 题目 3：疾厄宫生理体质与身体敏感部位核对 ====================
    const q3 = {
      id: "q3",
      dimension: "第三维 · 先天生理体质与身体敏感部位（疾厄宫星曜与五行分野）",
      question: "中医与命理同源，不同时辰的疾厄宫星曜直接对应你身体的先天薄弱环节。从小到大当你劳累、熬夜或换季时，身体最容易亮红灯的是哪个部位？",
      options: cands.map((c, idx) => {
        const jieStar = getPrimaryStar(c.chart, "疾厄宫");
        const healthDesc = JIE_HEALTH_TRAITS[jieStar] || "肠胃消化与睡眠节律偏敏感";
        return {
          candIdx: idx,
          shichenName: c.shichenName,
          label: `疾厄宫坐【${jieStar}】：${healthDesc}。（对应${c.shichenName}盘）`
        };
      })
    };

    // ==================== 题目 4：原生家庭与父母早年管教风格核对 ====================
    const q4 = {
      id: "q4",
      dimension: "第四维 · 原生家庭氛围与父母管教底色（父母宫与早年印记）",
      question: "回想你从小长大的原生家庭氛围，以及父母（尤其是当家一方）对你的管教方式，以下哪种描述更符合事实？",
      options: cands.map((c, idx) => {
        const fumuStar = getPrimaryStar(c.chart, "父母宫");
        const famDesc = FUMU_FAMILY_TRAITS[fumuStar] || "父母注重实际，对你既有期望又强调独立";
        return {
          candIdx: idx,
          shichenName: c.shichenName,
          label: `父母宫坐【${fumuStar}】：${famDesc}。（对应${c.shichenName}盘 · 命宫坐【${c.mingStars}】）`
        };
      })
    };

    // ==================== 题目 5（终极决胜题 · 当出现平局或拿不准时一锤定音）：2022壬寅 / 2023癸卯 往事大事件核对 ====================
    const q5 = {
      id: "q5",
      dimension: "第五维 · 2022–2023 往事转折点核对（当性格体感相近时的终极一锤定音铁证）",
      question: "如果前面几项你觉得两边都有点像（命理上称为“格局交叠”），请回想更早一点的 2022年（壬寅年）与 2023年（癸卯年），以下哪条轨迹更符合你当时的真实处境？",
      options: cands.map((c, idx) => {
        const pal2022 = getPalaceByBranch(c.chart, "寅");
        const pal2023 = getPalaceByBranch(c.chart, "卯");
        const d22 = PALACE_EVENT_DESC[pal2022.name] || "个人事务调整";
        const d23 = PALACE_EVENT_DESC[pal2023.name] || "外部环境变化";
        return {
          candIdx: idx,
          shichenName: c.shichenName,
          label: `2022年核心事件在【${pal2022.name}】（${d22}） ➔ 2023年核心事件在【${pal2023.name}】（${d23}）。（对应${c.shichenName}盘）`
        };
      })
    };

    return { candidates: cands, questions: [q1, q2, q3, q4, q5] };
  }
  function analyzeTimeInterval(params) {
    const {
      year, month, day,
      startHour = 9, startMinute = 0,
      endHour = 11, endMinute = 0,
      city = "默认 (东经120°标准时)",
      gender = "female", status = "single"
    } = params;

    const lon = CITY_LONGITUDES[city] !== undefined ? CITY_LONGITUDES[city] : 120.0;
    const tstStart = computeTrueSolarTime(year, month, day, startHour, startMinute, lon, city);
    const tstEnd   = computeTrueSolarTime(year, month, day, endHour, endMinute, lon, city);

    // 将起止时间转为从当日 00:00 算起的分钟数（处理跨日）
    const startTotalMin = tstStart.hour * 60 + tstStart.minute;
    let endTotalMin = tstEnd.hour * 60 + tstEnd.minute;
    if (endTotalMin < startTotalMin) endTotalMin += 1440;

    // 采样区间内每 15 分钟对应的时辰地支，找出所有候选时辰及覆盖时长占比
    const shichenCounts = {};
    const shichenSampleTime = {};
    let totalSamples = 0;
    for (let m = startTotalMin; m <= endTotalMin; m += 10) {
      const normMin = ((m % 1440) + 1440) % 1440;
      const h = Math.floor(normMin / 60);
      const min = normMin % 60;
      const bz = computeBazi(year, month, day, h, min);
      const zhiIdx = bz.hZhiIdx;
      shichenCounts[zhiIdx] = (shichenCounts[zhiIdx] || 0) + 1;
      if (!shichenSampleTime[zhiIdx]) {
        shichenSampleTime[zhiIdx] = { hour: h, minute: min };
      }
      totalSamples++;
    }

    const candidates = Object.keys(shichenCounts).map(idxStr => {
      const zhiIdx = parseInt(idxStr, 10);
      const sample = shichenSampleTime[zhiIdx];
      // 反推对应的钟表时间用于保存
      const clockH = Math.floor(((sample.hour * 60 + sample.minute - tstStart.totalDeltaMin + 1440) % 1440) / 60);
      const clockM = ((sample.hour * 60 + sample.minute - tstStart.totalDeltaMin + 1440) % 60);
      const chart = analyzeFullNatalChart({
        year, month, day,
        hour: clockH, minute: clockM,
        city, gender, status
      });
      const mingPal = chart.ziwei.mingPalace || {};
      const mainStarsArr = mingPal.stars || [];
      const mainNames = mainStarsArr.map(s => s.name);
      const traitText = mainNames.length
        ? mainNames.map(n => `【${n}】${MING_RECTIFY_TRAITS[n] || ""}`).join("；")
        : "命宫无主星（空宫借对宫），适应力与可塑性极强，易受伴侣与外部环境带动。";
      const spNames = (chart.ziwei.spousePalace.mainStarNames || []).join("·") || "借对宫星曜";
      const prob = Math.round((shichenCounts[zhiIdx] / Math.max(1, totalSamples)) * 100);

      return {
        zhiIdx,
        shichenName: DIZHI[zhiIdx] + "时",
        prob,
        clockHour: clockH,
        clockMinute: clockM,
        trueHour: sample.hour,
        trueMinute: sample.minute,
        hourPillar: chart.bazi.hourPillar,
        mingBranch: mingPal.branch,
        mingStars: mainNames.join("·") || "空宫借对宫",
        spouseStars: spNames,
        traitText,
        chart
      };
    });

    return {
      tstStart,
      tstEnd,
      isSingleShichen: candidates.length === 1,
      candidates
    };
  }

  function analyzeFullNatalChart(params) {
    const { year, month, day, hour = 12, minute = 0,
            gender = "female", status = "single",
            city = "默认 (东经120°标准时)", longitude } = params;

    const lon = (typeof longitude === "number" && !isNaN(longitude))
      ? longitude
      : (CITY_LONGITUDES[city] !== undefined ? CITY_LONGITUDES[city] : 120.0);
    const tst = computeTrueSolarTime(year, month, day, hour, minute, lon, city);

    // 使用校准后的当地真太阳时进行四柱八字与紫微排盘
    const bz = computeBazi(tst.year, tst.month, tst.day, tst.hour, tst.minute);
    const rawClockBz = computeBazi(year, month, day, hour, minute);

    const yearPillar  = TIANGAN[bz.yGanIdx] + DIZHI[bz.yZhiIdx];
    const monthPillar = TIANGAN[bz.mGanIdx] + DIZHI[bz.mZhiIdx];
    const dayPillar   = TIANGAN[bz.dGanIdx] + DIZHI[bz.dZhiIdx];
    const hourPillar  = TIANGAN[bz.hGanIdx] + DIZHI[bz.hZhiIdx];

    const dayMaster      = TIANGAN[bz.dGanIdx];
    const marriageBranch = DIZHI[bz.dZhiIdx];

    /* --- 神煞（以年支 / 日支查） --- */
    const yz = DIZHI[bz.yZhiIdx];
    const peachMap    = { "申":"酉","子":"酉","辰":"酉","寅":"卯","午":"卯","戌":"卯",
                          "巳":"午","酉":"午","丑":"午","亥":"子","卯":"子","未":"子" };
    const hongLuanMap = { "子":"卯","丑":"寅","寅":"丑","卯":"子","辰":"亥","巳":"戌",
                          "午":"酉","未":"申","申":"未","酉":"午","戌":"巳","亥":"辰" };
    const TIANYI = { "甲":["丑","未"],"戊":["丑","未"],"庚":["丑","未"],
                     "乙":["子","申"],"己":["子","申"],
                     "丙":["亥","酉"],"丁":["亥","酉"],
                     "壬":["卯","巳"],"癸":["卯","巳"],"辛":["午","寅"] };
    const allBranches = [DIZHI[bz.yZhiIdx], DIZHI[bz.mZhiIdx], marriageBranch, DIZHI[bz.hZhiIdx]];

    const shenshaList = [];
    if (allBranches.indexOf(peachMap[yz]) >= 0)    shenshaList.push("咸池桃花");
    if (allBranches.indexOf(hongLuanMap[yz]) >= 0) shenshaList.push("红鸾星动");
    if ((TIANYI[dayMaster] || []).some(function (b) { return allBranches.indexOf(b) >= 0; }))
      shenshaList.push("天乙贵人");
    // 日支自坐：日柱同支重复出现 → 伏吟
    if (DIZHI[bz.hZhiIdx] === marriageBranch) shenshaList.push("日时伏吟");
    // 孤鸾煞（日柱）
    const GULUAN = ["甲寅","乙巳","丙午","丁巳","戊申","戊午","辛亥","壬子"];
    if (GULUAN.indexOf(dayPillar) >= 0) shenshaList.push("孤鸾日");
    if (shenshaList.length === 0) shenshaList.push("无明显婚姻神煞");

    /* --- 紫微真实排盘 --- */
    const ziwei = deriveZiweiPalaces(tst.year, tst.month, tst.day, tst.hour, tst.minute, bz, gender);

    /* --- 农历信息 --- */
    const lun = CAL.solarToLunar(year, month, day);
    ziwei.lunar = lun;

    /* --- 边界预警 --- */
    const warnings = [];
    if (tst.isCalibrated) {
      const sign = tst.totalDeltaMin >= 0 ? "+" : "";
      if (rawClockBz.hZhiIdx !== bz.hZhiIdx) {
        warnings.push(`【真太阳时跨时辰关键修正】出生地【${tst.city}（东经${tst.longitude}°）】真太阳时比北京时间${tst.totalDeltaMin >= 0 ? "快" : "慢"} ${Math.abs(tst.totalDeltaMin)} 分钟（钟表时间 ${tst.clockTimeStr} → 真太阳时 ${tst.trueTimeStr}），排盘时辰已从【${DIZHI[rawClockBz.hZhiIdx]}时】精准修正为【${DIZHI[bz.hZhiIdx]}时】！`);
      } else {
        warnings.push(`【真太阳时已校准】出生地【${tst.city}（东经${tst.longitude}°）】真太阳时修正为 ${tst.trueTimeStr}（差值 ${sign}${tst.totalDeltaMin} 分钟），仍属【${DIZHI[bz.hZhiIdx]}时】。`);
      }
    }
    if (bz.nearestTermGapHours < 1) {
      warnings.push("你的出生时刻距最近的节气不足 1 小时（本站节气算法精度约 ±15 分钟），年柱或月柱存在跨界可能，建议以权威万年历二次核对。");
    }
    if (bz.dayAdvanced) {
      warnings.push("出生在 23:00 之后，按传统「晚子时」规则日柱已进位至次日。若你采用「早晚子时不分」的流派，日柱与时干会有差异。");
    }
    if (lun.isLeap) {
      warnings.push("出生于农历闰" + lun.lMonth + "月，紫微排盘按通行规则「上半月算本月、下半月算下月」处理（本盘按" +
                    (lun.lDay > 15 ? "下月" : "本月") + "起）。不同流派对闰月处理有分歧。");
    }

    return {
      profile: { year, month, day, hour, minute, gender, status, city: tst.city, longitude: tst.longitude, trueSolarTime: tst },
      lunar: lun,
      bazi: {
        yearPillar, monthPillar, dayPillar, hourPillar,
        // 八字分析层：藏干 / 十神 / 五行分布 / 调候坐标（确定性事实，供 RAG 检索）
        detail: (global.BaziAnalyzer ? global.BaziAnalyzer.analyze(bz, gender) : null),
        dayMaster,
        marriageBranch,
        wuxing: GAN_WUXING[dayMaster],
        tenGodSpouse: gender === "female" ? "官杀星 (夫星)" : "财星 (妻星)",
        shensha: shenshaList,
        solarTerm: bz.solarTermName,
        ganzhiYear: bz.ganzhiYear,
        dayAdvanced: bz.dayAdvanced
      },
      ziwei,
      warnings,
      summaryText: (gender === "female" ? "坤造" : "乾造") +
        " · " + yearPillar + " " + monthPillar + " " + dayPillar + " " + hourPillar +
        " · 日元【" + dayMaster + GAN_WUXING[dayMaster] + "】" +
        " · " + ziwei.juName +
        " · 夫妻宫【" + ziwei.spousePalace.gan + ziwei.spousePalace.branch + " " +
        (ziwei.spousePalace.mainStarNames.join("") || "空宫") + "】" +
        " · " + ziwei.spousePalace.sihua
    };
  }

  global.AstrologyCore = {
    analyzeFullNatalChart,
    computeTrueSolarTime,
    analyzeTimeInterval,
    buildRectifyQuiz,
    CITY_LONGITUDES,
    computeBazi,
    deriveZiweiPalaces,
    ZIWEI_SPOUSE_STARS,
    TIANGAN, DIZHI, GAN_WUXING, getTenGod
  };
})(typeof window !== "undefined" ? window : global);
