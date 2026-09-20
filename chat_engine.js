// 点到 —— 动态命理研判生成引擎 v2
// 核心目标：同一命盘下，不同问题 => 完全不同的分析路径、措辞、时间窗与行动建议
(function (global) {

  /* ============================================================
   * 0. 基础工具：稳定哈希 / 变体选择 / 干支时间计算
   * ============================================================ */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
  function pick(arr, seed, offset = 0) {
    if (!arr || arr.length === 0) return "";
    return arr[(seed + offset) % arr.length];
  }
  function pickMany(arr, seed, n) {
    const out = [];
    const used = new Set();
    let i = 0;
    while (out.length < Math.min(n, arr.length) && i < arr.length * 3) {
      const idx = (seed + i * 7) % arr.length;
      if (!used.has(idx)) { used.add(idx); out.push(arr[idx]); }
      i++;
    }
    return out;
  }

  const TIANGAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const DIZHI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const LIUHE = { "子":"丑","丑":"子","寅":"亥","亥":"寅","卯":"戌","戌":"卯","辰":"酉","酉":"辰","巳":"申","申":"巳","午":"未","未":"午" };
  const LIUCHONG = { "子":"午","午":"子","丑":"未","未":"丑","寅":"申","申":"寅","卯":"酉","酉":"卯","辰":"戌","戌":"辰","巳":"亥","亥":"巳" };
  const SANHE = { "申":["子","辰"],"子":["申","辰"],"辰":["申","子"],"寅":["午","戌"],"午":["寅","戌"],"戌":["寅","午"],"巳":["酉","丑"],"酉":["巳","丑"],"丑":["巳","酉"],"亥":["卯","未"],"卯":["亥","未"],"未":["亥","卯"] };
  // 六害（相穿）
  const LIUHAI = { "子":"未","未":"子","丑":"午","午":"丑","寅":"巳","巳":"寅","卯":"辰","辰":"卯","申":"亥","亥":"申","酉":"戌","戌":"酉" };
  // 相刑：子卯无礼之刑；寅巳申无恩之刑；丑戌未恃势之刑；辰午酉亥自刑
  const XING_PAIR  = { "子":"卯","卯":"子" };
  const XING_GROUP = [ ["寅","巳","申"], ["丑","戌","未"] ];
  const ZIXING     = ["辰","午","酉","亥"];
  // 三合局 / 三会方（两支相遇＝半合 / 半会）
  const SANHE_GROUPS  = [ ["申","子","辰","水"], ["寅","午","戌","火"], ["巳","酉","丑","金"], ["亥","卯","未","木"] ];
  const SANHUI_GROUPS = [ ["寅","卯","辰","木"], ["巳","午","未","火"], ["申","酉","戌","金"], ["亥","子","丑","水"] ];
  // 天干五合与化神；天干相冲（戊己居中不冲）
  const WUHE      = { "甲":"己","己":"甲","乙":"庚","庚":"乙","丙":"辛","辛":"丙","丁":"壬","壬":"丁","戊":"癸","癸":"戊" };
  const WUHE_HUA  = { "甲己":"土","乙庚":"金","丙辛":"水","丁壬":"木","戊癸":"火" };
  const GAN_CHONG = { "甲":"庚","庚":"甲","乙":"辛","辛":"乙","丙":"壬","壬":"丙","丁":"癸","癸":"丁" };
  // 化神得地的月支（本气 + 长生/余气之地）
  const HUA_DEDI  = { "土":["辰","戌","丑","未"], "金":["申","酉","戌","巳"], "水":["亥","子","丑","申"], "木":["寅","卯","辰","亥"], "火":["巳","午","未","寅"] };

  function yearGanZhi(y) {
    const off = (y - 4) % 60;
    return TIANGAN[((off % 10) + 10) % 10] + DIZHI[((off % 12) + 12) % 12];
  }
  function yearZhi(y) {
    const off = (y - 4) % 60;
    return DIZHI[((off % 12) + 12) % 12];
  }
  // 公历月 -> 命理月支（近似：立春后为寅月）
  function monthZhi(m) { return DIZHI[(m + 1) % 12]; }

  /**
   * 获取当前真实绝对时间与天文四柱历法基准（精确到分钟、节气、农历、流年流月流日流时）
   */
  function getCurrentTimeAnchor() {
    const now = new Date();
    const Y = now.getFullYear();
    const M = now.getMonth() + 1;
    const D = now.getDate();
    const H = now.getHours();
    const Min = now.getMinutes();
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const wk = weekdays[now.getDay()];

    let lunarStr = `农历${Y}年`;
    let lMonthLabel = `${M}月`;
    let lDayLabel = `${D}日`;
    if (global.CalendarCore && global.CalendarCore.solarToLunar) {
      try {
        const l = global.CalendarCore.solarToLunar(Y, M, D);
        if (l) {
          lMonthLabel = (l.isLeap ? "闰" : "") + (l.lMonthLabel || `${l.lMonth}月`);
          lDayLabel = l.lDayLabel || `${l.lDay}日`;
          lunarStr = `农历${l.lYear}年${lMonthLabel}${lDayLabel}`;
        }
      } catch (e) {}
    }

    let yPillar = yearGanZhi(Y), mPillar = "", dPillar = "", hPillar = "", termName = "";
    if (global.AstrologyCore && global.AstrologyCore.computeBazi) {
      try {
        const bz = global.AstrologyCore.computeBazi(Y, M, D, H, Min);
        const TG = global.AstrologyCore.TIANGAN || TIANGAN;
        const DZ = global.AstrologyCore.DIZHI || DIZHI;
        if (bz && TG && DZ) {
          yPillar = TG[bz.yGanIdx] + DZ[bz.yZhiIdx];
          mPillar = TG[bz.mGanIdx] + DZ[bz.mZhiIdx];
          dPillar = TG[bz.dGanIdx] + DZ[bz.dZhiIdx];
          hPillar = TG[bz.hGanIdx] + DZ[bz.hZhiIdx];
          termName = bz.solarTermName || "";
        }
      } catch (e) {}
    }

    return {
      Y, M, D, H, Min, wk,
      solarStr: `${Y}年${M}月${D}日 ${wk} ${String(H).padStart(2, "0")}:${String(Min).padStart(2, "0")}`,
      solarDateOnly: `${Y}年${M}月${D}日`,
      lunarStr,
      lMonthLabel,
      lDayLabel,
      yPillar, mPillar, dPillar, hPillar, termName,
      ganzhiFull: `${yPillar}年 ${mPillar}月 ${dPillar}日 ${hPillar}时${termName ? "（" + termName + "节气后）" : ""}`
    };
  }

  /* ============================================================
   * 1. 问题理解层：主题识别 + 语义维度抽取
   * ============================================================ */
  const TOPICS = [
    { id: "true_love",  label: "命中正缘与脱单时机", kw: ["正缘","脱单","单身","对象","遇见","什么时候恋爱","何时恋爱","找对象","真命","另一半","姻缘","桃花运","有没有人喜欢我","我的爱情"] },
    { id: "reconcile",  label: "断联复合与挽回",     kw: ["复合","挽回","前任","前男友","前女友","和好","重圆","回头","会不会回来","还爱我吗","断联","拉黑","删好友","冷静期","分手后"] },
    { id: "mind_read",  label: "对方真心与心态透视", kw: ["他怎么想","她怎么想","ta怎么想","对方心里","真心","喜不喜欢我","有没有喜欢","什么态度","在想什么","是不是玩玩","认真吗","养鱼","备胎","吊着"] },
    { id: "hot_cold",   label: "忽冷忽热与冷暴力",   kw: ["忽冷忽热","冷暴力","不理我","已读不回","不回消息","敷衍","冷淡","消失","疏远","冷战","不主动","态度变了","变冷"] },
    { id: "confess",    label: "暧昧升温与表白时机", kw: ["表白","告白","暧昧","窗户纸","要不要说","怎么追","追求","心动","单恋","暗恋","主动","约会","升温","确定关系"] },
    { id: "marriage",   label: "婚期与婚姻格局",     kw: ["结婚","婚期","领证","婚礼","动婚","嫁","娶","彩礼","婚房","见家长","见父母","谈婚论嫁","几年结婚","什么时候结婚"] },
    { id: "third",      label: "第三者与信任危机",   kw: ["第三者","小三","出轨","劈腿","暧昧对象","背叛","偷偷","手机","撒谎","隐瞒","不忠","前任纠缠","还联系","怀疑","有别人","有人了","瞒着","不忠诚","信任"] },
    { id: "distance",   label: "异地与现实阻力",     kw: ["异地","分居","距离","城市","工作调动","出国","留学","见不到","时差","两地"] },
    { id: "conflict",   label: "争吵内耗与相处模式", kw: ["吵架","争吵","矛盾","内耗","累","消耗","相处","沟通","脾气","冷静","委屈","受不了","心累"] },
    { id: "breakup",    label: "分与合的抉择",       kw: ["要不要分","该不该分","分手","放弃","值不值得","继续吗","坚持","止损","舍不得","犹豫","纠结"] },
    { id: "blindmatch", label: "相亲与择偶判断",     kw: ["相亲","介绍","合适","条件","家境","门当户对","选择","两个人选","甲和乙","该选谁"] },
    { id: "self",       label: "自我性格与情感课题", kw: ["我的性格","为什么我","我总是","我是不是","改变自己","不自信","患得患失","缺爱","依赖","安全感","吸引力","提升"] },
    { id: "fortune",    label: "近期运势与流月走向", kw: ["今天","最近","这个月","近期","下个月","运势","注意什么","状态","本周"] },
    { id: "family",     label: "家庭阻力与婚后生活", kw: ["父母","家人","反对","催婚","婆婆","岳父","长辈","家庭","婚后","生活","孩子","生育"] }
  ];

  function analyzeQuestion(q) {
    const s = (q || "").toLowerCase();
    // 主题打分
    let best = null, bestScore = 0;
    for (const t of TOPICS) {
      let score = 0;
      for (const k of t.kw) if (s.includes(k)) score += k.length >= 3 ? 3 : 2;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    const topic = best || { id: "general", label: "情感综合研判", kw: [] };

    return {
      topic,
      matched: bestScore > 0,
      asksWhen:   /什么时候|何时|多久|几年|哪一年|哪年|时机|时间点|多长时间/.test(s),
      asksWhy:    /为什么|为何|怎么回事|原因|是不是因为/.test(s),
      asksShould: /该不该|要不要|值不值|应不应|可以吗|好吗|能不能|适合吗/.test(s),
      asksHow:    /怎么办|如何|怎样|怎么做|方法|建议/.test(s),
      asksYesNo:  /会不会|能不能|有没有|是不是|可不可能/.test(s),
      hasOther:   /他|她|ta|对方|男友|女友|老公|老婆|伴侣|那个人/.test(s),
      wantTarot:  /塔罗|抽牌|抽一张|起卦|占卜|算一卦|看看牌/.test(s),
      emotional:  /难受|痛苦|崩溃|哭|绝望|放不下|睡不着|焦虑|煎熬|好累|撑不住/.test(s),
      length: (q || "").length,
      raw: q
    };
  }

  /* ============================================================
   * 2. 命盘解读层：把命盘数据翻译成可变的语言
   * ============================================================ */
  function chartLens(chart, seed) {
    const sp = chart.ziwei.spousePalace;
    const b = chart.bazi;
    const wx = b.wuxing;

    /* --- P0 新增：真实排盘衍生信息 --- */
    // 简短星曜标签（供行文内嵌）
    const mainNames = sp.mainStarNames || [];
    const starShort = sp.borrowed
      ? ("空宫借" + mainNames.join(""))
      : (mainNames.join("") || "空宫");
    // 庙旺解读
    const brightOf = (sp.detail && sp.rawBrightness) || "";
    let brightLine = "";
    const firstBright = (chart.ziwei.raw && sp.mainStarNames && sp.mainStarNames.length)
      ? (function () {
          const pal = chart.ziwei.raw.palaces.filter(function (x) { return x.name === "夫妻宫"; })[0];
          const src = (pal && pal.mainStars.length) ? pal.mainStars : null;
          return src ? src[0].brightness : "";
        })() : "";
    if (firstBright === "庙" || firstBright === "旺") {
      brightLine = "该星在此宫处于【" + firstBright + "】位，力量饱满——星曜的优点会明显放大，缺点相对可控";
    } else if (firstBright === "陷" || firstBright === "不") {
      brightLine = "该星在此宫落【" + firstBright + "】，能量偏弱——星曜的正面特质不容易自然显现，需要你有意识地经营，缺点则更易被触发";
    } else if (firstBright) {
      brightLine = "该星在此宫为【" + firstBright + "】，中等力度——好坏都不极端，最终取决于你怎么用";
    }
    // 空宫说明
    const borrowNote = sp.borrowed
      ? "你的夫妻宫本身无主星（命理称「空宫」），需借对宫官禄宫的" + mainNames.join("") +
        "来看。空宫的人在感情里往往没有固定剧本：你容易被不同类型的人吸引，也更容易受环境与对方状态影响，缘分的可塑性大于宿命性。"
      : "";
    // 辅星/桃花星解读
    const auxList = sp.assistantStars || [];
    const auxGood = auxList.filter(function (a) { return a.type === "吉"; });
    const auxBad  = auxList.filter(function (a) { return a.type === "煞"; });
    const auxPeach = auxList.filter(function (a) { return a.type === "桃花"; });
    let auxLine = "";
    if (auxGood.length) auxLine += "夫妻宫会" + auxGood.map(function (a) { return a.name; }).join("、") +
      "：" + auxGood[0].desc + "。";
    if (auxBad.length) auxLine += (auxLine ? "但同时" : "夫妻宫见") + auxBad.map(function (a) { return a.name; }).join("、") +
      "：" + auxBad[0].desc + "。";
    if (auxPeach.length) auxLine += (auxLine ? "另有" : "夫妻宫带") + auxPeach.map(function (a) { return a.name; }).join("、") +
      "：" + auxPeach[0].desc + "。";
    if (!auxLine) auxLine = "夫妻宫无重要吉煞星同度，格局清爽——感情的走向更多由你自己的选择决定，而非外力推动。";
    // 夫妻宫大限
    const dx = sp.daxian;
    const nowAge = (new Date()).getFullYear() - chart.profile.year + 1;
    const inSpouseDaxian = dx && nowAge >= dx.start && nowAge <= dx.end;
    const daxianLine = dx
      ? ("你的夫妻宫大限为 " + dx.start + "–" + dx.end + " 岁" +
         (inSpouseDaxian ? "，而你现在正走在这步大限里——这十年是你感情议题最集中、变化也最大的阶段。"
                         : (nowAge < dx.start ? "，目前尚未进入，感情的重头戏还在后面。"
                                              : "，你已经走过这步大限，当下的感情课题更偏向沉淀与修正。")))
      : "";

    const wxTemper = {
      "木": ["你的情感底色带着生发之气，容易先付出、先靠近，也容易因为对方的停滞而焦躁",
             "木性主仁，你在关系里习惯扮演托举者，替对方想得多，却常常忘了问自己累不累"],
      "火": ["火性外显，你的爱来得快、烧得旺，好处是坦荡，隐患是情绪来时容易把话说满",
             "你属于把心事写在脸上的类型，藏不住失望，也藏不住偏爱"],
      "土": ["土主信，你在感情里求的是一个“稳”字，宁可慢一点，也不要来回反复",
             "你不擅长把爱说出口，更习惯用安排、照顾、兜底来证明在乎"],
      "金": ["金性主义，你有清晰的原则与底线，一旦被越界，转身会比谁都决绝",
             "你外柔内刚，看似好说话，实则心里那杆秤从来没歪过"],
      "水": ["水性主智，你极其敏感，对方一个语气变化你就能捕捉到，这是天赋，也是内耗之源",
             "你善于揣摩人心，所以常常提前预演结局，反而困住了当下"]
    }[wx] || ["你的情感能量温润而含蓄，不争不抢，却自有磁场"];

    const sihuaRead = {
      "化禄": ["夫妻宫化禄，是带着福分的位置：你遇到的人往往真心待你，感情里的付出多半会有回声",
               "化禄入夫妻宫，说明缘分本身是滋养型的，即便过程有波折，结局多偏向圆满"],
      "化权": ["夫妻宫化权，意味着关系里必然存在主导权的角力，谁说了算、听谁的，是你们绕不开的课题",
               "化权的格局下，你的伴侣有主见也有能力，但你若一味顺从，反而会失去被尊重的位置"],
      "化科": ["夫妻宫化科，感情讲究体面与分寸，你们更像一对彼此尊重的搭档，少有失控的撕扯",
               "化科主名声，你的关系容易得到外界认可，但也要小心为了面子压抑真实感受"],
      "化忌": ["夫妻宫化忌，这是宿命感最重的一种格局：你在感情里的执念，往往比事情本身更折磨你",
               "化忌不代表不好，它代表“在意”。你越是想抓紧，越容易卡住，松手反而是解法"]
    }[sp.sihua] || ["夫妻宫星曜平和，感情起伏不大，属于慢火细熬的类型"];

    const shenshaRead = [];
    if (b.shensha.includes("红鸾星动")) shenshaRead.push("命带红鸾，你对感情有种本能的认真，一旦动心便很难敷衍");
    if (b.shensha.includes("咸池桃花")) shenshaRead.push("咸池桃花在位，你的异性缘不缺，缺的是在众多靠近里分辨出真心");
    if (b.shensha.includes("天乙贵人")) shenshaRead.push("天乙贵人照命，你的正缘往往同时是你人生的贵人，婚后运势会被抬高一层");
    if (shenshaRead.length === 0) shenshaRead.push("命带德星，你的感情少有大凶险，多是渐进式的磨合与沉淀");

    return {
      star: starShort,
      starFull: sp.primaryStar,
      brightness: firstBright,
      brightLine,
      borrowNote,
      auxLine,
      daxianLine,
      sihuaShort: (sp.sihua && sp.sihua.indexOf("化") === 0) ? sp.sihua : "无生年四化",
      spouseGanZhi: (sp.gan || "") + (sp.branch || ""),
      oppositeStars: sp.oppositeStars || "",
      lunarLabel: chart.lunar ? (chart.lunar.lYear + "年" + chart.lunar.lMonthLabel + chart.lunar.lDayLabel) : "",
      juName: chart.ziwei.juName || "",
      mingStar: (chart.ziwei.mingPalace && chart.ziwei.mingPalace.star) || "",
      mingBranch: (chart.ziwei.mingPalace && chart.ziwei.mingPalace.branch) || "",
      warnings: chart.warnings || [],
      starNature: sp.nature,
      mateTrait: sp.detail.mateTrait,
      pros: sp.detail.pros,
      cons: sp.detail.cons,
      dynamics: sp.detail.dynamics,
      sihua: sp.sihua,
      sihuaLine: pick(sihuaRead, seed, 1),
      wxLine: pick(wxTemper, seed, 2),
      shenshaLine: pick(shenshaRead, seed, 3),
      dayMaster: b.dayMaster,
      wx,
      branch: b.marriageBranch,
      pillars: `${b.yearPillar} · ${b.monthPillar} · ${b.dayPillar} · ${b.hourPillar}`,
      gender: chart.profile.gender,
      status: chart.profile.status
    };
  }

  /* ============================================================
   * 3. 时间窗计算：基于真实当前日期 + 婚姻宫地支关系
   * ============================================================ */
  function timingReport(branch, seed, wantYears, chart, targetPalaceName = "夫妻宫", domainLabel = "感情") {
    const now = new Date();
    const Y = now.getFullYear();
    const M = now.getMonth() + 1;

    // 未来 4 个月的月支关系
    const monthNotes = [];
    for (let i = 0; i < 4; i++) {
      const mm = ((M - 1 + i) % 12) + 1;
      const mz = monthZhi(mm);
      const plain = [
        "能量平顺，适合把注意力放回自己身上，不必急于推进",
        "无明显外力介入，是打磨相处细节、修复日常裂痕的好时机",
        "关系按原轨道运行，你的主动与否不会带来质变，可先观望",
        "适合梳理自己的真实需求，把想说的话先写下来而不是发出去",
        "外部机会平平，但内在判断力清晰，适合做长远规划"
      ];
      let tag = "平稳", note = plain[(seed + i * 3) % plain.length];
      if (LIUHE[branch] === mz) { tag = "合"; note = "关系最容易松动、破冰、升温的月份，主动开口成功率显著提高"; }
      else if (SANHE[branch] && SANHE[branch].includes(mz)) { tag = "三合"; note = "有贵人或朋友圈牵线，容易出现自然靠近的契机"; }
      else if (LIUCHONG[branch] === mz) { tag = "冲"; note = "情绪易起波澜，也最容易把话说重，此月避免下最终结论"; }
      else if (branch === mz) { tag = "临"; note = "本命月，心绪浮动大，适合内观而非行动"; }
      monthNotes.push({ month: mm, zhi: mz, tag, note });
    }

    // 未来 3 年：地支关系 + 真实流年四化 + 流年红鸾天喜 + 大限
    const ZHI12 = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
    const ZW = global.ZiweiEngine;
    const zwRaw = (chart && chart.ziwei && chart.ziwei.raw) ? chart.ziwei.raw : null;
    // 星 → 本命宫名
    function palaceOfStar(name) {
      if (!zwRaw) return null;
      for (let i = 0; i < 12; i++) {
        const p = zwRaw.palaces[i];
        if (p.mainStars.some(function (x) { return x.name === name; })) return p;
        if (p.auxStars.some(function (x) { return x.name === name; })) return p;
      }
      return null;
    }
    const spouseName = targetPalaceName || "夫妻宫", mingName = "命宫";
    const palShort = spouseName.replace("宫", "");

    const years = [];
    for (let i = 0; i < 3; i++) {
      const y = Y + i;
      const yz = yearZhi(y);
      const yGan = yearGanZhi(y).charAt(0);
      let score = 72, tags = [], notes = [];

      /* a) 目标宫位/婚姻宫地支关系 */
      if (LIUHE[branch] === yz) {
        score += 22; tags.push("六合");
        notes.push(spouseName === "夫妻宫"
          ? "流年与婚姻宫相合，关系最容易「定下来」——确立、见家长、领证都在此列"
          : `流年与你的【${spouseName}】地支六合，外部贵人与合作契机明显，是顺水推舟的好年份`);
      }
      else if (SANHE[branch] && SANHE[branch].includes(yz)) {
        score += 15; tags.push("三合");
        notes.push(`三合拱照【${spouseName}】，外力推动明显，人脉引荐或环境变动会成为催化剂`);
      }
      else if (LIUCHONG[branch] === yz) {
        score -= 12; tags.push("岁冲");
        notes.push(spouseName === "夫妻宫"
          ? "流年冲动婚姻宫，关系会被现实议题推着走（搬迁、异地、家庭介入），过得去反而更牢固"
          : `流年冲动【${spouseName}】，该领域会出现客观变动或换跑道的推力，宜主动求变而非死守旧局`);
      }
      else if (branch === yz) {
        score -= 3; tags.push("太岁临宫");
        notes.push(`流年太岁临【${spouseName}】，该领域议题被推到台前，心绪起伏较大，适合稳扎稳打`);
      }

      /* b) 流年四化飞入本命宫位（真实计算） */
      if (ZW && ZW.SIHUA[yGan]) {
        const sh = ZW.SIHUA[yGan];
        ["禄","权","科","忌"].forEach(function (t) {
          const pal = palaceOfStar(sh[t]);
          if (!pal) return;
          if (pal.name === spouseName) {
            if (t === "禄") { score += 18; tags.push("禄入" + palShort); notes.push("流年" + yGan + "干使【" + sh[t] + "】化禄飞入你的" + spouseName + "——这是全年最实在的顺遂信号，资源与回馈自然涌现"); }
            else if (t === "科") { score += 10; tags.push("科入" + palShort); notes.push("流年【" + sh[t] + "】化科入" + spouseName + "，声誉、认可度与贵人运显著提升"); }
            else if (t === "权") { score += 6; tags.push("权入" + palShort); notes.push("流年【" + sh[t] + "】化权入" + spouseName + "，主导权与责任同步放大，适合主动掌舵"); }
            else { score -= 16; tags.push("忌入" + palShort); notes.push("流年【" + sh[t] + "】化忌入" + spouseName + "——这一年在" + domainLabel + "上容易起执念与阻力，重要决定宜缓，忌情绪化"); }
          } else if (pal.name === mingName && t === "禄") {
            score += 8; tags.push("禄入命"); notes.push("流年化禄入命宫，你自身状态回升，魅力与选择权同步变多");
          } else if (pal.name === mingName && t === "忌") {
            score -= 8; tags.push("忌入命"); notes.push("流年化忌入命宫，你容易自我消耗，感情问题多半源于自己先乱了阵脚");
          } else if (t === "禄" || t === "忌") {
            // 其余宫位也给出与感情相关的解读，保证每年都有具体落点
            const OTHER = {
              "福德宫": { 禄: "流年化禄入福德宫，你的心情与物质享受都会松快不少，感情上更容易「不将就」", 忌: "流年化忌入福德宫，你今年内耗偏重，容易在深夜把小事想成大事——感情问题多半是情绪先出问题" },
              "官禄宫": { 禄: "流年化禄入官禄宫（夫妻宫的对宫），事业顺遂会反向带动感情能见度，工作场合是重要缘分场", 忌: "流年化忌入官禄宫，事业压力会挤占感情，容易因为忙而冷落对方" },
              "子女宫": { 禄: "流年化禄入子女宫，桃花与亲密关系活跃，也主生育或亲子话题被提上日程", 忌: "流年化忌入子女宫，亲密关系里的需求错位需要摊开谈" },
              "迁移宫": { 禄: "流年化禄入迁移宫，外出、旅行、异动带来缘分，走出去比待着强", 忌: "流年化忌入迁移宫，外部环境变动多，异地或分离议题需提前规划" },
              "交友宫": { 禄: "流年化禄入交友宫，人脉扩张，朋友介绍是今年最靠谱的遇缘方式", 忌: "流年化忌入交友宫，留意第三方介入或朋友闲话影响关系" },
              "田宅宫": { 禄: "流年化禄入田宅宫，主置产、同居、家庭稳定，感情容易往「过日子」方向落地", 忌: "流年化忌入田宅宫，家庭或居住议题会成为关系的摩擦点" },
              "父母宫": { 禄: "流年化禄入父母宫，长辈助力明显，见家长时机不错", 忌: "流年化忌入父母宫，长辈意见会给关系添压" },
              "兄弟宫": { 禄: "流年化禄入兄弟宫，身边人给力，合作与相互扶持顺畅", 忌: "流年化忌入兄弟宫，身边亲近的人可能无意间影响你的感情判断" },
              "财帛宫": { 禄: "流年化禄入财帛宫，经济宽裕，关系里的物质摩擦减少", 忌: "流年化忌入财帛宫，金钱议题容易演变成感情议题" },
              "疾厄宫": { 禄: "流年化禄入疾厄宫，身心状态转好，是调整节奏的一年", 忌: "流年化忌入疾厄宫，先照顾好身体与睡眠，状态差时不宜做感情决断" }
            };
            const o = OTHER[pal.name];
            if (o && o[t]) {
              score += (t === "禄" ? 5 : -5);
              tags.push(t + "入" + pal.name.replace("宫", ""));
              notes.push(o[t]);
            }
          }
        });
      }

      /* b2) 流年太岁落宫（流年命宫简化用法） */
      if (zwRaw) {
        const taisuiPal = zwRaw.palaces[ZHI12.indexOf(yz)];
        if (taisuiPal) {
          const ms = taisuiPal.mainStars.map(function (x) { return x.name; }).join("");
          notes.push("流年太岁行至你的【" + taisuiPal.name + "】（" + taisuiPal.branch + "宫" +
                     (ms ? "坐" + ms : "空宫") + "），这是今年感情议题最容易发生的场域");
        }
      }

      /* c) 流年红鸾 / 天喜 */
      const yzIdx = ZHI12.indexOf(yz);
      const hlIdx = ((3 - yzIdx) % 12 + 12) % 12;
      const txIdx = (hlIdx + 6) % 12;
      if (zwRaw) {
        const hlPal = zwRaw.palaces[hlIdx], txPal = zwRaw.palaces[txIdx];
        if (hlPal.name === spouseName || hlPal.name === mingName) {
          score += 12; tags.push("红鸾"); notes.push("流年红鸾正落你的" + hlPal.name + "，是命理上最典型的「感情事发生」信号");
        } else if (txPal.name === spouseName || txPal.name === mingName) {
          score += 8; tags.push("天喜"); notes.push("流年天喜临" + txPal.name + "，主喜庆与人际扩张，容易在热闹场合遇人");
        }
      }

      /* d) 大限提示 */
      const age = y - chart.profile.year + 1;
      let dxNote = "";
      if (zwRaw) {
        const inDx = zwRaw.palaces.filter(function (p) { return p.daxian && age >= p.daxian.start && age <= p.daxian.end; })[0];
        if (inDx) {
          dxNote = "（虚岁 " + age + "，行" + inDx.name + "大限）";
          if (inDx.name === spouseName) { score += 10; notes.push("这一年你正走夫妻宫大限，感情是本阶段的人生主线"); }
        }
      }

      score = Math.max(35, Math.min(97, score));
      const tag = tags.length ? tags.join("·") : "平流年";
      const note = notes.length ? notes.join("；") : "无强力星曜介入，关系按既有轨道推进，变量主要来自你自己的选择";
      years.push({ year: y, ganZhi: yearGanZhi(y), score, tag, note, dxNote });
    }

    const near = monthNotes.find(m => m.tag === "合") || monthNotes.find(m => m.tag === "三合") || monthNotes[1];
    const best = [...years].sort((a, b) => b.score - a.score)[0];

    const anchorLabel = spouseName === "夫妻宫" ? `婚姻宫坐【${branch}】` : `【${spouseName}】坐【${branch}】`;
    let text = `当前时序为 **${Y}年（${yearGanZhi(Y)}）${M}月**，你的${anchorLabel}。\n\n`;
    text += monthNotes.map(m =>
      `• **${m.month}月（${m.zhi}·${m.tag}）**：${m.note}`
    ).join("\n") + "\n\n";
    text += `👉 **近期最优推进窗口：${near.month}月前后**（${near.tag}），此时外部阻力最小。\n`;

    if (wantYears) {
      text += `\n**流年走势：**\n` + years.map(y =>
        `• **${y.year}年（${y.ganZhi}）${y.dxNote} · ${y.tag}｜指数 ${y.score}**：${y.note}`
      ).join("\n");
      text += `\n\n其中 **${best.year}年（${best.ganZhi}）** 是这三年中能量最集中的一年。`;
    }
    return text;
  }

  /* ============================================================
   * 4. 分主题分析库（每主题多变体，按问题哈希轮换）
   * ============================================================ */
  const ANALYSIS = {
    true_love: [
      L => `你现在缺的不是桃花，而是**筛选机制**。${L.wxLine}。夫妻宫坐【${L.star}】，注定你吸引来的人偏向「${L.mateTrait.slice(0, 22)}…」这一类型——他们靠近你时往往带着欣赏，而非猎奇。\n\n真正的卡点在于：你过去容易在**第一印象的舒适度**和**长期适配度**之间摇摆。命盘显示，你的正缘不会以惊天动地的方式出现，而是在一段相对日常的接触中，某一刻你突然发现「和这个人待着不费力」。`,
      L => `${L.shenshaLine}。夫妻宫【${L.star}·${L.starNature}】决定了你的正缘画像相当清晰：${L.mateTrait}\n\n但命盘同时提示一个反直觉的信号——你越是刻意寻找，越容易遇到「条件对但感觉不对」的人。${L.sihuaLine}，这意味着缘分对你而言是**被吸引来的，不是被搜寻到的**。`,
      L => `从格局看，你的感情属于「先立己、后得人」的类型。${L.wxLine}。\n\n夫妻宫【${L.star}】给你的伴侣定了调：${L.pros}但同时也埋了一个伏笔——${L.cons}\n\n换句话说，你未来的另一半不是没有缺点，而是他的优点恰好能覆盖你最在意的底线。`
    ],

    reconcile: [
      L => `先说结论：**这段关系没有彻底断，但也不在你能催的节奏上。**\n\n${L.sihuaLine}。夫妻宫【${L.star}】的人，分开时最典型的表现是**嘴上决绝、行动停滞**——他不会回头来纠缠，但也不会真的把你清理干净。\n\n对方此刻大概率在经历三层心理：\n1. **自证期**：反复告诉自己「分开是对的」，以缓解愧疚；\n2. **反刍期**：在独处、深夜、路过旧地时，习惯性想起你；\n3. **观望期**：偷偷关注你的状态，但绝不主动开口。\n\n你现在每一次主动追问，都会把他推回第 1 层。`,
      L => `${L.wxLine}——这正是复合难点所在：你越在意，越容易用「解释、道歉、翻旧账」去争取，而这三件事恰好都在消耗你的筹码。\n\n夫妻宫【${L.star}】提示，你们之间的断点**不是不爱，而是沟通模式塌方**：一方追问，一方回避，越追越逃，形成死循环。\n\n真正能扭转局面的，不是一段精心措辞的长文，而是**你消失后他感受到的落差**。`,
      L => `从命理角度，${L.shenshaLine}——你对这段关系的执念，一部分来自真情，一部分来自「不甘心」。请先分清这两者。\n\n夫妻宫【${L.star}】的格局下，复合并非不可能，但它有一个硬条件：**关系必须以新的形式重启，而不是回到原样。**如果导致分开的核心矛盾（相处节奏、现实压力、信任裂缝）没有变化，即便复合，也会在 3-6 个月内以同样方式再次崩塌。`
    ],

    mind_read: [
      L => `对方的态度，其实已经写在他的**行为成本**里了。\n\n判断一个人是否认真，只看三件事：\n1. **时间**：他是否愿意把不方便的时间给你（清晨、深夜、周末整块时间）；\n2. **暴露**：他是否让你进入他的真实社交圈（朋友、同事、家人）；\n3. **未来**：他是否在对话中自然出现「我们以后」这类句式。\n\n三项中命中不足两项的，无论嘴上多甜，都属于**低成本维系**。\n\n结合你的夫妻宫【${L.star}】：${L.dynamics}`,
      L => `${L.sihuaLine}。这种格局下，你的直觉往往是准的——你之所以来问，通常不是因为不知道答案，而是希望有人告诉你「再等等」。\n\n对方的真实状态，命盘给出的指向是：**他对你有好感，但这份好感尚未强到让他承担代价。**换句话说，你在他的优先级里存在，但不在最前列。\n\n这不一定是坏事，关键是——你愿意为一个「有好感但不优先」的人投入多久？`,
      L => `${L.wxLine}，所以你容易把对方的沉默解读成含义丰富的暗号，其实很多时候，沉默就只是沉默。\n\n夫妻宫【${L.star}】的伴侣类型有个特点：${L.cons}\n\n这意味着他的「不说」可能有两种截然不同的原因：一是**没想好**，二是**不想负责**。区分方法很简单——给他一个明确的、低压力的选择题，看他是认真回答，还是继续打太极。`
    ],

    hot_cold: [
      L => `忽冷忽热的本质，是**关系的主动权完全在对方手里**。\n\n他热，你就安心；他冷，你就焦虑。这种情绪被单方面掌控的结构，比「他到底爱不爱我」更值得警惕。\n\n${L.sihuaLine}。夫妻宫【${L.star}】提示，对方的降温大概率不是移情，而是**回避型应对**：在他感到压力（关系升级、现实问题、你的期待变高）时，退回壳里是他的本能自保。\n\n但原因不重要，重要的是这套模式如果不打破，会一直重复。`,
      L => `我把这种状态称为「**情绪潮汐**」：他不是不喜欢你，而是他的投入度随自身状态起伏，完全不考虑你的感受节奏。\n\n${L.wxLine}——这让你在冷期格外难熬，因为你会不断复盘「是不是我哪里做错了」。\n\n请记住一件事：**一个人对你忽冷忽热，通常和你做了什么无关，只和他自己的容量有关。**你越是自我归因，越容易被这套节奏驯化。`,
      L => `冷暴力和忽冷忽热最危险的地方，在于它会**重塑你的期待阈值**：原本你要的是稳定的爱，慢慢变成「他今天回我消息了，真好」。\n\n夫妻宫【${L.star}】的相处死穴恰恰是：${L.cons}\n\n这说明你们之间缺的不是感情浓度，而是**一套能承接冲突的沟通机制**。没有这套机制，热的时候有多甜，冷的时候就有多伤。`
    ],

    confess: [
      L => `先判断时机成熟度。真正可以推进的暧昧，至少要满足两条：**对方主动发起过话题**、**你们有过一次以上的单独相处**。若两条都不满足，此刻表白属于「把选择权交给对方」，胜率不高。\n\n${L.sihuaLine}。夫妻宫【${L.star}】显示，你适合的推进方式不是轰轰烈烈的告白，而是${L.dynamics.slice(0, 26)}…这一路径。`,
      L => `${L.wxLine}，所以你大概率已经在心里演练过无数遍开场白了。\n\n但命盘给的建议是：**别用「我喜欢你」开场，用「我想多了解你」开场。**前者要求对方立刻给答案，后者只要求对方给一次机会。对【${L.star}】型的对象尤其有效，因为${L.cons.slice(0, 24)}…`,
      L => `暧昧期最忌讳的是**过度供给**：消息秒回、有求必应、情绪全露。这会让关系提前进入「稳定态」，失去张力。\n\n夫妻宫【${L.star}】提示你的吸引力来源是${L.pros.slice(0, 26)}…请把力气花在展现这一面，而不是花在讨好上。`
    ],

    marriage: [
      L => `婚姻对你而言，命盘给的定调是：${L.dynamics}\n\n${L.sihuaLine}。夫妻宫【${L.star}】意味着你的婚后格局偏向「${L.pros.slice(0, 20)}…」，而需要长期经营的地方是「${L.cons.slice(0, 20)}…」。\n\n这决定了你们能不能顺利进入婚姻，不取决于感情浓度，而取决于**现实议题的协商能力**：钱、房、双方父母、居住地。`,
      L => `从格局看，你不是「早婚型」，而是「条件成熟型」——${L.wxLine}，你需要看到确定性才敢下注。\n\n夫妻宫【${L.star}】的婚配特征是：${L.mateTrait.slice(0, 30)}…\n\n值得注意的是，你们进入婚姻的最大变量往往不是彼此，而是**双方原生家庭的介入程度**。能不能在谈判桌上站成一队，比谈多少年恋爱都关键。`,
      L => `${L.shenshaLine}。婚姻在你的命盘里属于「加分项」而非「避难所」——也就是说，它会放大你现有的状态：你稳，它就让你更稳；你慌，它会让你更慌。\n\n夫妻宫【${L.star}】的伴侣${L.pros}但请提前做好准备：${L.cons}`
    ],

    third: [
      L => `先冷静区分两件事：**你掌握的事实**，和**你脑中的推演**。很多信任崩塌，起点是猜测被当成了证据。\n\n${L.wxLine}——你的敏感度极高，这意味着你的直觉常常准，但也意味着你容易在焦虑中把细节无限放大。\n\n夫妻宫【${L.star}】逢${L.sihua}，这个格局下确实存在**第三方能量介入**的可能，但它未必是具体的人，也可能是工作、原生家庭、或某段未了的过去。`,
      L => `信任一旦出现裂缝，修补的成本远高于建立。你现在需要做的不是「抓证据」，而是**明确自己的底线在哪**。\n\n因为无论真相如何，接下来只有两条路：要么对方给出可验证的行为改变，要么你接受长期的自我怀疑。而后者会耗尽你${L.wx}性本有的能量。\n\n夫妻宫【${L.star}】的相处盲区正是：${L.cons}`,
      L => `${L.sihuaLine}。这种格局下的感情纠葛，往往不是简单的「谁对谁错」，而是三个人各自的未完成课题撞在了一起。\n\n但请记住：**你不需要通过赢过谁来证明自己值得被爱。**真正属于你的关系，不会长期要求你处在竞争状态。`
    ],

    distance: [
      L => `异地真正杀死关系的，从来不是距离，而是**信息不对称带来的想象空间**，以及**共同记忆的停止增长**。\n\n${L.wxLine}——在看不见对方的时候，你的敏感会转化为反复解读消息语气。\n\n夫妻宫【${L.star}】的建议是：${L.dynamics.slice(0, 30)}…你们需要人为制造「共同经历」，而不只是汇报日常。`,
      L => `异地关系有一个硬指标：**是否存在明确的结束期限。**没有终点的异地，本质是消耗；有终点的异地，才叫等待。\n\n如果你们至今没有讨论过「什么时候、在哪个城市结束异地」，那当下最该谈的不是感情，而是这件事。\n\n结合你的婚姻宫【${L.branch}】，这一议题在下文提到的时间窗内会自然浮出水面。`,
      L => `${L.sihuaLine}。异地考验的是你们的**冲突修复速度**——同城吵架当晚能和好，异地吵架可能冷战三天。\n\n夫妻宫【${L.star}】的死穴：${L.cons}这在异地环境中会被放大数倍。`
    ],

    conflict: [
      L => `你们吵的从来不是表面那件事。绝大多数亲密关系的争执，底层只有一句话：「**我需要你看见我。**」\n\n${L.wxLine}。夫妻宫【${L.star}】的相处模式是：${L.dynamics}\n\n这意味着你们的冲突大概率是「节奏错位」而非「三观不合」——一个要立刻解决，一个要先冷静，于是彼此都觉得对方不在乎。`,
      L => `判断一段关系值不值得继续，不看吵得凶不凶，看**吵完之后有没有修复**。\n\n健康的关系：冲突 → 表达 → 理解 → 更靠近。\n消耗型关系：冲突 → 冷处理 → 装作没事 → 裂缝累积。\n\n你可以对照一下，你们属于哪一种。夫妻宫【${L.star}】的盲区正是：${L.cons}`,
      L => `${L.sihuaLine}。你现在的「心累」，很可能不是因为爱得不够，而是因为**你在关系里承担了过多的情绪劳动**——安排、照顾、揣摩、迁就，都是你在做。\n\n${L.wxLine}，这让你习惯性地不喊停，直到彻底透支。`
    ],

    breakup: [
      L => `做这个决定前，请先回答三个问题（不用告诉我，你自己心里清楚就好）：\n\n1. 抛开沉没成本（时间、青春、投入），如果今天才认识他，你还会选他吗？\n2. 让你难受的是**这个人**，还是**失去一段关系**这件事？\n3. 过去半年里，这段关系让你变得更自在，还是更小心翼翼？\n\n${L.sihuaLine}——你的纠结，有很大一部分来自「不甘心」，而非「还爱着」。`,
      L => `${L.wxLine}。你不是优柔寡断的人，你只是**在等一个不必由你承担责任的结局**——最好是对方先开口，或者出现一个无可辩驳的理由。\n\n但命盘显示，这件事最终大概率仍要由你来定夺。夫妻宫【${L.star}】的格局下，拖延只会让消耗延长，不会让答案变清晰。`,
      L => `我不会替你决定去留，但可以给一个判断标准：**看这段关系消耗的是你的情绪，还是你的成长。**\n\n情绪消耗可以恢复，成长停滞不行。如果你为了维持关系，已经开始压抑自己的表达、削减自己的社交、降低自己的标准，那这段关系就已经在收走你的未来了。\n\n夫妻宫【${L.star}】提示：${L.cons}`
    ],

    blindmatch: [
      L => `相亲最容易犯的错，是把「条件清单」当成匹配依据。条件决定的是婚姻的**下限**，相处舒适度决定的是**上限**。\n\n夫妻宫【${L.star}】给你的适配画像是：${L.mateTrait}\n\n请用这个画像做参照，而不是用别人眼中的「好条件」。`,
      L => `判断一个相亲对象是否可继续，建议做三次不同场景的观察：\n\n1. **一次正式吃饭**——看教养、看他如何对待服务人员；\n2. **一次非计划活动**（临时变更行程/小意外）——看情绪韧性；\n3. **一次涉及花钱或麻烦的事**——看责任感与真实态度。\n\n三次之后，你对这个人的判断会比聊三个月微信更准。`,
      L => `${L.wxLine}——你在选择时容易陷入「理性说服自己」的模式：明明感觉一般，却因为条件合适而反复权衡。\n\n夫妻宫【${L.star}】提示，你真正需要的伴侣特质是「${L.pros.slice(0, 22)}…」。这一点如果缺失，条件再好也撑不过磨合期。`
    ],

    self: [
      L => `${L.wxLine}\n\n夫妻宫【${L.star}·${L.starNature}】折射出你在亲密关系里的核心模式：你渴望的是${L.pros.slice(0, 22)}…，而你最容易踩的坑是${L.cons.slice(0, 22)}…\n\n${L.shenshaLine}。这说明你的情感课题不是「没人爱」，而是「如何在被爱时不慌」。`,
      L => `你反复出现的关系模式，通常源于同一个内在脚本。命盘显示，你的脚本大概是：**先用力证明自己值得，再因为对方的一点疏离而全面自我怀疑。**\n\n${L.sihuaLine}。这不是性格缺陷，而是你${L.wx}性能量的双刃面——敏锐让你懂人心，也让你困在推演里。`,
      L => `提升吸引力这件事，命盘给的方向很明确：**不是变得更讨好，而是变得更清晰。**\n\n${L.wxLine}。夫妻宫【${L.star}】的人，最有魅力的状态是有自己的重心、有明确的喜恶、有说「不」的能力。当你不再围着对方转，反而会进入被追逐的位置。`
    ],

    fortune: [
      L => `近期你的情感能量处于**收敛偏上行**的阶段：外部机会不少，但你自己的心绪需要先安定。\n\n${L.wxLine}。夫妻宫【${L.star}】逢${L.sihua}，这段时间最需要注意的是**不要在情绪高点做承诺，也不要在情绪低点下结论**。`,
      L => `从流月能量看，你近期最大的课题是「分辨真信号与假信号」。会有人靠近，会有旧人回头，也会有让你心动一下的瞬间——但其中真正值得投入的，通常是最安静的那个。\n\n${L.shenshaLine}`,
      L => `近期运势的关键词是「**慢下来**」。${L.sihuaLine}\n\n你最近的判断力容易被情绪染色，尤其在深夜。凡是重要的话，请留到第二天白天再说。`
    ],

    family: [
      L => `家庭阻力的本质，往往不是长辈反对某个人，而是**他们对不确定性的恐惧**。你要处理的不是观点之争，而是安全感之争。\n\n夫妻宫【${L.star}】的婚后格局：${L.dynamics}\n\n${L.sihuaLine}。这提示你们能否顶住外部压力，关键在于**两人是否始终站在同一侧**。`,
      L => `面对催婚或干预，最有效的不是对抗，也不是顺从，而是**建立可预期的边界**：给长辈一个明确的时间表和沟通频率，让他们的焦虑有落点。\n\n${L.wxLine}——你习惯自己扛，但这件事上，沉默会被解读为默认。`,
      L => `婚后生活的实质，是两个家庭系统的对接。夫妻宫【${L.star}】显示，你的伴侣${L.pros}这在处理长辈关系时是很大的助力。\n\n但同时要留意：${L.cons}`
    ],

    general: [
      L => `你提出的这个问题，落在你命盘中夫妻宫【${L.star}·${L.starNature}】的能量场上。\n\n${L.wxLine}。${L.sihuaLine}\n\n${L.shenshaLine}。综合来看，你当下面对的并非无解之局，而是**信息不完整导致的焦虑**——你需要的不是答案，而是一个判断框架。`,
      L => `${L.sihuaLine}。这决定了你在感情中的基本姿态：${L.dynamics}\n\n就你所问的这件事而言，命盘给出的方向是：先把注意力从「对方会怎样」移回「我要什么」。前者你控制不了，后者才是你唯一的着力点。`,
      L => `${L.wxLine}。夫妻宫【${L.star}】的你，容易在关系里承担过多的解读工作——揣摩、预演、自我说服。\n\n针对你问的这件事，我的判断是：**表象之下的核心变量只有一个，就是对方愿意为此付出多少确定的成本。**其余一切细节，都是这个变量的注脚。`
    ]
  };

  /* ============================================================
   * 5. 行动建议库（按主题 + 是否情绪化，动态组合）
   * ============================================================ */
  const ACTIONS = {
    true_love: [
      "**扩大高质量曝光面**：正缘不会从天而降。每月至少参与一次陌生人占比高、且与你兴趣真实相关的场合（课程、运动社群、行业活动），比刷一百次社交软件有效。",
      "**建立三条底线，而非三十条标准**：把择偶清单压缩到三条不可妥协的（如：情绪稳定、有责任感、尊重你的事业），其余全部可谈。清单越长，越容易错过对的人。",
      "**给关系一个观察期，而不是判决期**：遇到心动对象时，给自己 6 周不下结论的时间，只做记录：他让你舒服的瞬间，和让你不安的瞬间，哪一类更多。",
      "**优化你的第一印象锚点**：你的气质适合清爽、有质感的呈现方式。与其追求惊艳，不如让人觉得「和你说话很轻松」——这是你最强的吸引力。",
      "**主动创造一次深度对话**：真正的连接发生在第三层对话（价值观、遗憾、渴望），而不是第一层（天气、工作、吃饭）。有意识地把话题往下推一层。"
    ],
    reconcile: [
      "**彻底断联 21 天**：不主动联系、不试探、不在社交动态发情绪内容。这不是冷战，是把注意力收回自己身上，同时让对方的防御机制自然松弛。",
      "**做一件只属于你自己的事**：健身、换发型、完成一个搁置很久的目标。复合的前提是「你依然是那个有光的人」，而不是「离开他就活不好的人」。",
      "**首次破冰用低压力话题**：避开感情本身，从客观事由切入（一件共同关心的小事、他擅长的领域的请教）。发出后不追问、不催回，给彼此留台阶。",
      "**准备一个「新版本」的答案**：如果他问「以后还会那样吗」，你需要说出具体的改变机制，而不是「我会改」。例如：「以后我情绪上头会先说一句我需要半小时，而不是一直追问。」",
      "**设定你自己的截止线**：给这次尝试一个期限（例如 2 个月）。到期若无实质推进，就把它归档。无限期的等待，是对自己最深的消耗。"
    ],
    mind_read: [
      "**停止解读，开始验证**：与其分析他的语气，不如设计一个低成本的验证动作——提出一个具体的、需要他付出一点时间成本的小邀约，看他的反应。",
      "**记录行为而非感受**：拿一周时间，只记录客观事实（谁先发消息、回复间隔、是否主动提出见面）。一周后的数据，会比你的情绪判断准确得多。",
      "**明确表达一次你的期待**：温和但清晰地说出你想要的关系形态。真正在意你的人会给出回应，含糊其辞的人会继续含糊——两种结果都是答案。",
      "**不要为他的沉默写剧本**：当你开始脑补他不回消息的十种理由时，立刻停下，去做一件需要专注的事。你的能量比他的态度更值得投资。"
    ],
    hot_cold: [
      "**镜像法则**：他冷你就慢，他热你再热。不是玩手段，而是把你的投入度与他的投入度对齐，避免单方面输出耗空自己。",
      "**明确划一次边界**：平静地说一次——「我很在意我们的关系，但我没办法接受忽冷忽热的相处。等你想清楚了随时可以找我。」说完立刻回到自己的生活，不再追问。",
      "**在他冷的时候，把日程填满**：提前安排好这几天的行程（运动、朋友、工作目标）。焦虑源于空白，把空白填上，你就不会在手机前反复刷新。",
      "**观察 30 天周期**：如果这种模式在一个月内重复三次以上，那它就不是偶发状态，而是这个人的固定相处模式。请据此决定你的投入上限。"
    ],
    confess: [
      "**先测温，再开口**：连续两次由你发起的邀约，若对方都积极回应并主动延伸话题，说明温度足够；若一次热一次冷，继续观察。",
      "**选择合适的场景**：避免正式、隆重、有第三人的场合。散步、送对方回家的路上、结束一场愉快活动后的余温里，是成功率最高的时刻。",
      "**用「邀请」代替「表白」**：「我挺喜欢和你待在一起的，想更认真地了解你，可以吗？」——这句话给了对方退路，也给了你体面。",
      "**表白后守住 72 小时**：无论结果如何，说完后不要连环追问。给对方消化的空间，也给自己保留姿态。"
    ],
    marriage: [
      "**婚前必谈的四件事**：钱怎么管、住在哪、双方父母的赡养与边界、要不要孩子及时间表。这四件事谈不拢，感情再好也会在婚后爆雷。",
      "**统一对外口径**：在和任何一方长辈沟通前，两人先私下达成共识，对外保持一致。最伤感情的不是长辈施压，而是伴侣在压力下倒戈。",
      "**做一次「冲突演练」**：刻意讨论一个你们意见相左的现实问题，观察彼此的沟通方式。婚姻的质量，取决于处理分歧的能力，而非相爱的浓度。",
      "**给筹备期留出缓冲**：婚礼筹备是关系压力测试的高峰期。提前约定好「争执不过夜、决策分工明确」的规则。"
    ],
    third: [
      "**先分清事实与推测**：拿一张纸，左边写你亲眼所见的客观事实，右边写你的推断。通常右边远多于左边——这就是你痛苦的真正来源。",
      "**一次性、平静地提出核心疑问**：不翻手机、不设陷阱、不反复质问。给对方一次完整回答的机会，然后观察他的反应是坦诚还是回避。",
      "**设定你自己的底线并说出来**：你不需要威胁，只需要让对方知道你的边界在哪里，以及越界的后果是什么。",
      "**保护好自己的现实基础**：在信任重建期间，保持经济独立与社交独立。这不是不信任，是给自己留一条随时能走的路。"
    ],
    distance: [
      "**约定一个结束异地的时间点**：哪怕只是一个粗略的年份。没有终点的异地，会把爱耗成责任，再把责任耗成疲惫。",
      "**创造共同经历而非汇报日常**：一起追同一部剧、玩同一个游戏、读同一本书。共同记忆的增量，才是感情的养分。",
      "**冲突必须升级到通话**：文字是异地关系最大的杀手。一旦出现负面情绪，立刻转语音或视频——很多误会，听到声音就消散了。",
      "**固定一个仪式**：每周同一时间的视频、每月一次的奔赴。可预期的节奏，能极大缓解不安全感。"
    ],
    conflict: [
      "**引入「暂停」机制**：约定一个暂停词。情绪上头时任何一方说出它，双方停止争论 30 分钟，之后必须回来继续谈——不是逃避，是降温。",
      "**把「你总是…」换成「我感到…」**：前者是指控，触发防御；后者是表达，触发共情。这一个句式的改变，能减少一半以上的无效争吵。",
      "**每次只解决一个问题**：不翻旧账，不扩大战场。翻旧账是争吵升级的最快通道。",
      "**吵完必须有修复动作**：一个拥抱、一句总结、一个共同结论。没有修复的冲突，会在关系里持续结疤。"
    ],
    breakup: [
      "**设一个观察期而非立刻决断**：给自己 30 天，期间只记录感受，不做任何行动。30 天后回看记录，答案通常已经很清楚。",
      "**和一位局外人聊一次**：选一个不站队、不八卦的朋友，完整讲一遍。很多时候，你在讲述的过程中就会听见自己的答案。",
      "**分清「舍不得他」和「舍不得投入」**：如果你反复想起的是共同的时间、付出的精力，而不是这个人本身，那多半是沉没成本在作祟。",
      "**若决定结束，就不要留尾巴**：不做朋友、不留暧昧、不定期关心。干净的结束，是对彼此最大的尊重。"
    ],
    blindmatch: [
      "**三次场景观察法**：正式吃饭看教养、突发状况看韧性、涉及麻烦事看担当。三次之后再决定要不要继续。",
      "**把条件清单砍到三条**：只保留真正不可妥协的三项，其余交给相处感受。",
      "**注意他如何谈论前任与家人**：一个人对过去关系的描述方式，基本就是他将来描述你的方式。",
      "**相信你的身体反应**：如果每次见面后你都感到疲惫而非轻松，那再合适的条件也不该继续。"
    ],
    self: [
      "**建立一个不依赖关系的支点**：一项长期爱好、一个职业目标、一群与感情无关的朋友。有支点的人，在关系里才有从容。",
      "**练习表达需求而非期待对方猜**：把「你怎么都不懂我」换成「我希望你这样做」。清晰的人更容易被满足。",
      "**记录你的情绪触发点**：当你感到不安时，写下当时发生了什么。三个月后你会发现，触发你的往往是同一类情境——那才是真正要处理的课题。",
      "**给自己设定「不解释」的额度**：不必为每个误解辩白。你的从容本身，就是最强的筛选器。"
    ],
    fortune: [
      "**近期避免在深夜做决定**：你的判断力在夜间会被情绪显著干扰，重要的话留到白天说。",
      "**给自己安排一次独处的整块时间**：不看手机、不社交。近期你的内耗大多来自信息过载。",
      "**留意来自旧关系的信号**：近期容易有旧人回头或故人重现，先观察对方的动机，再决定回应尺度。",
      "**主动创造一次新的社交暴露**：近期的缘分更可能来自弱连接（朋友的朋友、同行、临时场合）。"
    ],
    family: [
      "**先和伴侣结盟，再面对长辈**：任何对外沟通前，两人必须先对齐立场与底线。",
      "**给长辈一个可预期的时间表**：焦虑源于未知。一个明确的计划，比一百句「你们别催了」有用。",
      "**区分建议与干预**：长辈的意见可以听，但决策权必须在你们手里。明确这条边界，并温和地坚持。",
      "**不要在冲突当下辩论**：先接住情绪（「我知道您是担心我」），再在情绪平复后谈事实。"
    ],
    general: [
      "**把注意力从「对方会怎样」移回「我要什么」**：前者你控制不了，后者才是你的着力点。",
      "**给这件事设一个决策期限**：无限期的悬而未决，比任何结果都更消耗人。",
      "**只相信可验证的行为**：语言可以是即兴的，行为才是成本。用对方付出的实际成本来判断分量。",
      "**允许自己暂时没有答案**：不是所有关系都需要立刻定性。有时候，最好的行动是过好自己的这一周。"
    ]
  };

  const CLOSINGS = [
    "命理给的是趋势，不是判决。真正决定结局的，始终是你在关键节点的选择。",
    "你不需要在今天就想清楚一切。先照顾好眼前这一周的自己，路会慢慢显形。",
    "所有的等待都不该是被动的。愿你在等一个人的同时，也在成为更完整的自己。",
    "感情里最好的姿态，是既有奔赴的勇气，也有随时归来的从容。",
    "不必急着要答案。时间会替你筛掉那些本就不属于你的人。",
    "记住：你值得的关系，不需要你时刻紧绷地去维持。"
  ];

  const FOLLOWUPS = {
    true_love: ["我的正缘大概会在哪个年份出现？", "我该怎么提升自己的吸引力？", "帮我抽张塔罗看看近期桃花"],
    reconcile: ["断联期间我具体该做什么？", "如果他先来找我，我该怎么回应？", "我们复合后会不会重蹈覆辙？"],
    mind_read: ["他到底是回避型还是在权衡？", "我该怎么试探才不掉价？", "帮我抽张塔罗看他的真实想法"],
    hot_cold: ["我该怎么划清边界？", "这种模式还值得继续吗？", "帮我抽张塔罗看他冷淡的原因"],
    confess: ["表白的具体时机怎么选？", "如果被拒绝了我该怎么做？", "帮我抽张塔罗看表白成功率"],
    marriage: ["我哪一年结婚最合适？", "婚后我们的财运如何？", "怎么应对双方父母的分歧？"],
    third: ["我该不该直接问清楚？", "信任还能重建吗？", "帮我抽张塔罗看这段关系的真相"],
    distance: ["异地还能撑多久？", "我们该怎么规划结束异地？", "帮我抽张塔罗看异地结局"],
    conflict: ["我们的核心矛盾到底是什么？", "怎么改善沟通方式？", "这段关系还值得继续吗？"],
    breakup: ["如果分手，我多久能走出来？", "我是不是在沉没成本里？", "帮我抽张塔罗做决断"],
    blindmatch: ["这个人适合长期发展吗？", "我的择偶标准合理吗？", "帮我抽张塔罗看这段缘分"],
    self: ["我在感情里的最大盲区是什么？", "怎么才能不那么患得患失？", "我适合什么类型的伴侣？"],
    fortune: ["这个月我要注意什么？", "近期有桃花吗？", "帮我抽张塔罗看本周走势"],
    family: ["怎么说服父母接受？", "婚后和长辈怎么相处？", "我们的婚后生活会怎样？"],
    general: ["帮我详细分析我的正缘画像", "我近期的感情运势如何？", "帮我抽张塔罗看当下处境"]
  };

  /* ============================================================
   * 6. 主生成函数
   * ============================================================ */
  async function generateChatResponse(question, chart, sessionHistory = [], config = {}) {
    const mode = config.kbMode || "ziwei";
    // 真实大模型优先
    if (config.apiKey && config.provider && config.provider !== "builtin") {
      const text = await callLiveAPI(question, chart, sessionHistory, config);
      return {
        text,
        tarotWidget: null,
        followups: [],
        reasoningSteps: buildReasoningSteps(question, chart, mode)
      };
    }
    await new Promise(r => setTimeout(r, 600 + Math.random() * 500));
    return composeAnswer(question, chart, sessionHistory, mode);
  }

  /* ---------- 多宫位路由 + 779条古籍RAG驱动的智能推演 ---------- */
  function resolveDomainAndPalace(question, chart) {
    const q = String(question || "");
    const zw = chart.ziwei;
    const palaces = (zw && zw.palaces) ? zw.palaces : [];
    function findPal(name) {
      return palaces.find(function (p) { return p.name === name; }) || palaces[0] || {};
    }
    function oppPal(pal) {
      if (!pal || !palaces.length) return {};
      const idx = palaces.indexOf(pal);
      return idx >= 0 ? palaces[(idx + 6) % 12] : {};
    }
    function fmtStars(pal) {
      if (!pal || !pal.mainStars || !pal.mainStars.length) {
        const op = oppPal(pal);
        const oms = (op.mainStars || []).map(function (s) { return s.name + "(" + s.brightness + ")"; }).join(" ");
        return oms ? `空宫（借对宫【${op.name}】${oms}）` : "空宫";
      }
      return pal.mainStars.map(function (s) {
        return s.name + "(" + s.brightness + ")" + (s.sihua ? "[化" + s.sihua + "]" : "");
      }).join(" ");
    }

    // ⚠️ 这里原来的默认分支是「夫妻宫／感情婚恋」—— 早期恋爱 APP 的遗产。
    // 后果是：任何没命中关键词的问题（「要不要换个城市」「今年整体运势」「我适合做什么」）
    // 都会被按感情盘解读，整个推演台锁在夫妻宫上。
    // 现在默认改成「综合」，走命宫／日元格局；感情必须由关键词明确命中才进。
    let palName = "命宫", domainLabel = "综合运势", baziAspect = "日元格局与当前大运";
    if (/(感情|恋爱|爱情|对象|男友|女友|老公|老婆|伴侣|配偶|结婚|离婚|分手|复合|暧昧|表白|相亲|正缘|姻缘|桃花|脱单|单身|喜欢我|追我|出轨|第三者|异地恋)/.test(q)) {
      palName = "夫妻宫"; domainLabel = "感情婚恋"; baziAspect = "婚姻宫与配偶星";
    } else if (/(考试|考研|考公|上岸|升学|学业|读书|论文|学历|证书|执照|面试|笔试|留学申请)/.test(q)) {
      palName = "官禄宫"; domainLabel = "学业考试"; baziAspect = "印星文昌与官星";
    } else if (/(事业|工作|职场|跳槽|升职|创业|老板|领导|前途|发展|做哪行|转行|辞职|副业方向|裁员|失业|晋升)/.test(q)) {
      palName = "官禄宫"; domainLabel = "事业发展"; baziAspect = "官杀事业与月令提纲";
    } else if (/(财运|钱|收入|工资|买房|房产|置业|存款|理财|投资|副业|负债|发财|赚钱|賺钱|欠债|亏钱|回本)/.test(q)) {
      palName = /买房|房产|置业/.test(q) ? "田宅宫" : "财帛宫";
      domainLabel = "财运置业"; baziAspect = "财星源流与食伤生财";
    } else if (/(内耗|焦虑|情绪|心态|性格|脾气|我是谁|自我|孤独|抑郁|睡不着|迷茫|意义|摆烂|内向|敏感)/.test(q)) {
      palName = "福德宫"; domainLabel = "内在状态与心性"; baziAspect = "日元心性与四季调候";
    } else if (/(健康|身体|生病|体检|手术|精力|睡眠|胃|肝|失眠|慢性|调理)/.test(q)) {
      palName = "疾厄宫"; domainLabel = "身心健康"; baziAspect = "五行平衡与寒暖燥湿";
    } else if (/(父母|原生家庭|爸|妈|催婚|家里人|长辈|婆媳|岳)/.test(q)) {
      palName = "父母宫"; domainLabel = "家庭与长辈"; baziAspect = "年柱与印星庇护";
    } else if (/(孩子|怀孕|生育|子女|备孕|宝宝|二胎|试管)/.test(q)) {
      palName = "子女宫"; domainLabel = "子女与创造"; baziAspect = "时柱与食伤生发";
    } else if (/(朋友|人际|小人|合伙|社交|闺蜜|同事|团队|下属|得罪)/.test(q)) {
      palName = "交友宫"; domainLabel = "人际与合作"; baziAspect = "比劫与人脉互动";
    } else if (/(出国|外地|搬迁|搬家|异地|远行|留学|换城市|换个城市|移民|定居|外派|驻外|回国|去哪发展|哪个城市|南方|北方发展)/.test(q)) {
      palName = "迁移宫"; domainLabel = "变动与远行"; baziAspect = "驿马与外部机缘";
    }

    const pal = findPal(palName);
    const opp = oppPal(pal);
    return {
      palName: palName,
      domainLabel: domainLabel,
      baziAspect: baziAspect,
      pal: pal,
      opp: opp,
      starDesc: fmtStars(pal),
      oppDesc: fmtStars(opp),
      branch: palName === "夫妻宫" ? chart.bazi.marriageBranch : (pal.branch || chart.bazi.marriageBranch)
    };
  }

  function buildClassicalEvidenceSection(question, chart, dom, seed) {
    const items = [];
    const kb = global.ZiweiKB || [];
    const palKey = dom.palName.replace("宫", ""); // 如「官禄」「财帛」「福德」「夫妻」
    const mainStar = (dom.pal.mainStars && dom.pal.mainStars[0]) ? dom.pal.mainStars[0].name :
                     ((dom.opp.mainStars && dom.opp.mainStars[0]) ? dom.opp.mainStars[0].name : "紫微");

    // 1. 紫微古籍精确检索：优先找「该主星 + 该宫位」断语，其次找该主星《諸星問答論》总论
    let zwMatch = kb.find(function (e) {
      return e.type === "palace_star" && e.source.indexOf(palKey) >= 0 && e.text.indexOf(mainStar) >= 0;
    });
    if (!zwMatch) {
      zwMatch = kb.find(function (e) {
        return e.type === "star_general" && e.text.indexOf(mainStar + "属") >= 0;
      }) || kb.find(function (e) {
        return e.text.indexOf(mainStar) >= 0 && e.source.indexOf("卷一") >= 0;
      });
    }
    if (zwMatch) {
      const rawQuote = zwMatch.text.replace(/\n+/g, " ").slice(0, 105) + (zwMatch.text.length > 105 ? "…" : "");
      let modern = "";
      if (dom.palName === "官禄宫") {
        modern = `你的官禄宫坐【${dom.starDesc}】，古籍指出${mainStar}星在事业宫位主「权责明晰、凭真本事立身」。你适合有专业门槛、目标导向清晰的岗位，最忌在权责不清、人际倾轧严重的环境消耗精力。`;
      } else if (dom.palName === "财帛宫" || dom.palName === "田宅宫") {
        modern = `你的${dom.palName}坐【${dom.starDesc}】，古籍显示${mainStar}星入财位主「财源有根、重积累而非侥幸」。你的正财与专业溢价能力强，适合稳健配置与长期主义，不宜参与高杠杆投机。`;
      } else if (dom.palName === "福德宫") {
        modern = `你的福德宫坐【${dom.starDesc}】，古籍点出${mainStar}星入福德主「外静内动、思虑极深」。你对环境与人际变化感知敏锐，内耗多源于「未雨绸缪过度」，需用具体行动代替反复推演。`;
      } else if (dom.palName === "疾厄宫") {
        modern = `你的疾厄宫坐【${dom.starDesc}】，古籍提示需留意该星曜对应的气血与作息节律，情绪压力往往最先反映在睡眠与消化系统上。`;
      } else {
        modern = `古籍对【${dom.starDesc}】入${dom.palName}的断语，点出你在亲密关系中「重质感、不喜凑合」的特质。古人所谓刑克，在现代语境下是指双方独立性都强，需要清晰的边界与共同成长节奏，忌用控制代替沟通。`;
      }
      items.push(`- **${zwMatch.source}**（针对你的【${dom.palName} · ${dom.starDesc}】）：\n  > 「${rawQuote}」\n  **白话解读**：${modern}`);
    }

    // 2. 八字古籍精确检索：按问题领域挑选对应十神/六亲/调候条文
    if (global.BaziKBRetriever && chart.bazi && chart.bazi.detail) {
      const d = chart.bazi.detail;
      const bzRes = global.BaziKBRetriever.retrieve(d, question, chart.profile.gender);
      const hits = (bzRes && bzRes.hits) ? bzRes.hits : [];
      let chosen = null;
      if (dom.palName === "官禄宫") {
        chosen = hits.find(function (h) { return /正官|七杀|正印|伤官/.test(h.why); });
      } else if (dom.palName === "财帛宫" || dom.palName === "田宅宫") {
        chosen = hits.find(function (h) { return /正财|偏财|食神/.test(h.why); });
      } else if (dom.palName === "夫妻宫") {
        chosen = hits.find(function (h) { return /配偶|女命|正官|七杀|正财/.test(h.why); });
      }
      if (!chosen && hits.length) chosen = hits[0];

      if (chosen) {
        const rawQuote = chosen.entry.text.replace(/\n+/g, " ").slice(0, 105) + (chosen.entry.text.length > 105 ? "…" : "");
        let modernBazi = "";
        if (dom.palName === "官禄宫") {
          modernBazi = `你八字日元为【${d.dayMasterLabel}】生于【${d.monthZhi}月（${d.season}·${d.monthCN}）】，四柱透出【${d.tenGods.slice(0, 3).join("、")}】。在事业格局上，${d.wuxingStrongest}气最旺赋予你极强的执行力与主见，而补足【${d.wuxingWeakest}】所代表的向上汇报与资源借力，是你突破职场天花板的关键。`;
        } else if (dom.palName === "财帛宫" || dom.palName === "田宅宫") {
          modernBazi = `从八字财星源流看，你日元【${d.dayMasterLabel}】生于${d.monthCN}，命中【${d.wuxingStrongest}】最旺。你的财富运势与「个人专业声誉及长期契约」深度绑定，适合先立专业口碑再放大现金流，逢${d.wuxingWeakest}旺之流年最利置业与资产沉淀。`;
        } else if (dom.palName === "福德宫") {
          modernBazi = `《窮通寶鑑》论【${d.dayMasterLabel}生于${d.monthCN}】，核心在于寒暖燥湿的中和。你命中【${d.wuxingStrongest}】偏盛而【${d.wuxingWeakest}】偏弱，这解释了你为何常有「思维停不下来、能量难以彻底放松」的体验。日常多接触属${d.wuxingWeakest}的环境与节奏，能有效平复内耗。`;
        } else {
          modernBazi = `你八字日元为【${d.dayMasterLabel}】，婚姻宫坐【${chart.bazi.marriageBranch}】，配偶星（${d.spouseGods.join("/")}）${d.spouseGodAbsent ? "藏而不透，说明正缘往往出现在你专注自我成长的阶段，属于晚成而稳固之缘" : "明透于命局，说明你对伴侣有极高要求，关系中既要精神共鸣也要现实并肩"}。`;
        }
        items.push(`- **${chosen.entry.source}**（针对你的八字【${d.dayMasterLabel}生于${d.monthCN} · ${chosen.why}】）：\n  > 「${rawQuote}」\n  **白话解读**：${modernBazi}`);
      }
    }

    if (!items.length) return "";
    return `### 📜 典籍依据（按你的命盘检索自 779 条古籍库）\n\n` + items.join("\n\n") + `\n\n`;
  }

  /* ---------- 分领域专属行动建议与追问（彻底告别千篇一律） ---------- */
  const DOMAIN_ACTIONS = {
    "官禄宫": [
      "**建立不可替代的专业锚点**：你的官禄宫星曜显示，你靠「技术/专业硬实力」晋升远比靠「搞人际关系」顺畅。未来 3 个月把核心精力集中在能产出量化作品/业绩的一件事上。",
      "**借对宫之力平衡节奏**：官禄宫与夫妻宫相对。当你工作陷入僵局时，往往是因为生活节奏完全失衡；先把作息与个人空间理顺，职场判断力会立刻恢复。",
      "**把握流年四化窗口**：留意今年流年化禄与化科所落的月份，那是你提加薪、谈核心项目或投递关键岗位的最佳出手期。"
    ],
    "财帛宫": [
      "**建立「双账户」现金流结构**：按你的财帛宫与八字财星特质，建议将收入按 7:3 拆分为「稳健不动产/低波底仓」与「能力提升/事业杠杆」，忌把资金留在高波动投机标的里。",
      "**靠「食伤生财」放大收入**：你的命局显示正财稳而偏财需借专长生发。与其盯盘炒作，不如把你的专业经验产品化、标准化，开拓第二收入曲线。",
      "**守住田宅与契约底线**：大额支出、合伙出资或房产签约前，务必留出 72 小时冷静期，并核对合同细则，避免因人情面子而让渡财务边界。"
    ],
    "田宅宫": [
      "**优先考量居住环境的采光与气场**：田宅宫不仅主房产，更主你的能量恢复场。近期把卧室与工作台做一次彻底断舍离，清理闲置杂物能直接改善你的睡眠与财运。",
      "**置业决策遵循「现金流安全垫」原则**：结合你八字当前的运势周期，买房或换房宜以「月供不超过稳定现金流 35%」为硬红线，稳扎稳打胜过盲目加杠杆。",
      "**理顺家庭内部权责边界**：田宅宫与原生家庭及伴侣共同生活息息相关，涉及房产署名、装修或父母同住议题时，先定规则再谈感情。"
    ],
    "福德宫": [
      "**给大脑设定「强制断电」时刻**：你的福德宫星曜与八字五行显示你屬於「高敏高思虑」体质。每天晚上 22:30 后远离碎片信息，用运动、洗浴或书写把注意力拉回身体感官。",
      "**区分「真实问题」与「灾难化想象」**：当你再次感到内耗时，拿出一张纸写下：「这件事 3 天后、3 个月后、3 年后分别有什么影响？」90% 的焦虑在落笔瞬间就会消解。",
      "**用「五行调候法」补充日常能量**：你八字最弱的五行是你的情绪调节器。日常在穿搭、饮食或活动场景中有意识融入该元素，能迅速找回内在秩序感。"
    ]
  };

  const DOMAIN_FOLLOWUPS = {
    "官禄宫": [
      "我的命盘适合在大平台/体制内深耕，还是独立创业做自由职业？",
      "近两年我的事业运势在哪个月份容易迎来晋升或跳槽良机？",
      "我在职场人际里最容易踩的坑是什么，怎么化解？"
    ],
    "财帛宫": [
      "从我的财帛宫和八字看，我一生财运的高峰期在哪个大限？",
      "我适合跟朋友合伙做生意或搞副业投资吗？",
      "我的命局里「漏财」的隐患在哪里，怎么守住财库？"
    ],
    "田宅宫": [
      "近两年适合买房置业或者换城市生活吗？",
      "我的田宅宫格局显示什么样的居住环境最旺我？",
      "如何化解家庭内部或居住变动带来的情绪压力？"
    ],
    "福德宫": [
      "为什么我总是比别人想得多、容易心累？命盘上怎么彻底调理？",
      "我八字里最旺和最弱的五行，在日常生活中该怎么平衡？",
      "什么时候我这波情绪低谷与精神内耗能彻底翻篇？"
    ]
  };

  // 同步核心：便于测试与复用
  function composeAnswer(question, chart, sessionHistory = [], kbMode = "ziwei") {
    const mode = kbMode === "bazi" ? "bazi" : "ziwei";
    const dom = resolveDomainAndPalace(question, chart);
    const b = chart.bazi || {};
    const bzD = b.detail || {};
    const zw = chart.ziwei || {};
    const p = chart.profile || {};
    const t = getCurrentTimeAnchor();
    const g = p.gender === "female" ? "女命（坤造）" : "男命（乾造）";
    const dmLabel = (b.dayMaster || "日元") + (b.wuxing || "");

    const timeBanner = `> 🕒 **推演时间基准**：公历 **${t.solarStr}** ｜ **${t.lunarStr}** ｜ 实时干支：**${t.ganzhiFull}**\n\n`;
    const isDateQuery = /(今天|今日|当前|现在).*(几号|日期|星期|什么日子|几月|哪一年|干支|黄历|日柱)|^(今天几号|现在什么日期|今年是哪年|今天星期几)/i.test(question || "");

    let sec1 = "", sec2 = "", sec3 = "";

    if (mode === "ziwei") {
      // ==================== 🔮 紫微斗数专席 · 三步直断分析 ====================
      const mingPal = (zw.palaces || []).find(pl => pl.name === "命宫") || {};
      const mingStar = (mingPal.mainStars || []).map(s => s.name + "(" + s.brightness + ")").join("、") || "借对宫主星";
      const targetPal = dom.pal || {};
      const auxList = (targetPal.auxStars || []).map(x => x.name + (x.sihua ? "[化" + x.sihua + "]" : "")).join("、") || "无同度辅曜";

      if (isDateQuery) {
        sec1 = `### 🎯 一、核心结论（直断定论）\n\n` +
          timeBanner +
          `**今日历法与流日直断**：今天是公历 **${t.solarDateOnly}（${t.wk}）**，**${t.lunarStr}**，干支历为 **${t.yPillar}年 ${t.mPillar}月 ${t.dPillar}日 ${t.hPillar}时**（当前处于 **${t.termName}** 节气后）。\n\n` +
          `结合你本人的紫微实盘（**${g} · 命宫坐【${mingStar}】**），当前处于 **${t.Y}年（${t.yPillar}）流年、${t.lMonthLabel}（${t.mPillar}）流月**。今日流日地支为【${t.dPillar.charAt(1)}】，直接引动你命盘中的对应宫位，今日行事宜顺势推进、果断执行，忌情绪化争执。`;
      } else {
        sec1 = `### 🎯 一、核心结论（直断定论）\n\n` +
          timeBanner +
          `针对你本人的紫微实盘（**${g} · 命宫坐【${mingStar}】**），你所问的**【${dom.domainLabel}】**核心落入**【${dom.palName}（${targetPal.gan || ""}${targetPal.branch || ""}宫）】**，宫内主星坐**【${dom.starDesc}】**，对宫【${dom.opp.name || "对宫"}】坐**【${dom.oppDesc}】**。\n\n` +
          `**直接定论**：你在这个领域目标极明确、宁缺毋滥，绝不接受敷衍。以当前时间（**${t.solarDateOnly} · ${t.lunarStr} · ${t.mPillar}月**）为基准，**当下本月（${t.lMonthLabel}）正是流月气机引动的关键期**；今年接下来 **农历九月（戊戌月）、农历十一月（庚子月）** 流年四化与本宫形成强力交会，是你打破僵局、敲定实质结果的黄金窗口！`;
      }

      sec2 = `### 🔍 二、本人命盘深度剖析（底层逻辑）\n\n` +
        `1. **本宫主星底色（${dom.palName}坐${dom.starDesc}）**：\n` +
        `   你【${dom.palName}】里的【${dom.starDesc}】能量非常鲜明，同度辅曜为【${auxList}】。这种星曜组合决定了你的命格容不下平庸或低效的互动——只要对方稍微敷衍或处事拖泥带水，你心里的防御机制就会立刻拉满。你在面临关键抉择时直觉极准、标准极高，但有时容易因原则性太强而不愿先妥协。想要顺遂，核心原则就是**“找同频的强者、给彼此留出独立空间”**。\n` +
        `2. **对宫外部牵制（对宫${dom.opp.name || ""}坐${dom.oppDesc}）**：\n` +
        `   本宫代表你的内在态度，对宫代表外部环境与对方的表现。对宫【${dom.oppDesc}】时刻照入你的【${dom.palName}】，意味着外部环境或伴侣/合作方的实力与态度会直接激发你的应变力，强强碰撞反而能擦出火花。\n` +
        `3. **当前流年与流月四化枢机（${t.yPillar}年 · ${t.mPillar}月）**：\n` +
        `   当前正值公历 ${t.Y}年${t.M}月（${t.lunarStr}，${t.mPillar}月），流年四化与本月流月气机交会，当下最忌情绪化决断，凡事慢半拍回应即可化阻力为助力。`;

      sec3 = `### 📅 三、明确时间节点与行动建议\n\n` +
        `- **⏳ 结合当前时间（${t.solarDateOnly} · ${t.lunarStr}）的明确时间节点**：\n` +
        `  - **当下本月（${t.lMonthLabel} · ${t.mPillar}月）**：${t.termName}节气之后金气当令，正是理清旧账、明确规则并推进核心议题的当口。\n` +
        `  - **接下来黄金发力月（农历九月戊戌月、农历十一月庚子月）**：流月吉星强力引动你的【${dom.palName}】三方，是关系破冰、确立名分或拿到实质结果的最强月份。\n` +
        `  - **需避开的消耗时段（农历十月己亥月及每日深夜）**：容易因言语误会起争执，切忌在情绪冲动时做决定。\n` +
        `- **⚡ 针对性行动策略**：\n` +
        `  1. **只看实际行动成本，不听口头承诺**：你的【${dom.palName}】星曜最忌讳陷入空想或口舌争辩。对方为你投入了多少时间、办成了什么实事，是唯一的判断标准。\n` +
        `  2. **把精力分出 40% 给【官禄宫/财帛宫】**：你的命盘格局属于“事业稳则感情稳、自身强则贵人聚”，当你把注意力收回到自己的主业与财务积累上，局面反而会主动向你靠拢。`;

    } else {
      // ==================== 📜 四柱八字专席 · 三步直断分析 ====================
      if (isDateQuery) {
        sec1 = `### 🎯 一、核心结论（直断定论）\n\n` +
          timeBanner +
          `**今日历法与八字日课直断**：今天是公历 **${t.solarDateOnly}（${t.wk}）**，**${t.lunarStr}**，实时四柱干支为 **流年【${t.yPillar}】· 流月【${t.mPillar}】· 流日【${t.dPillar}】· 流时【${t.hPillar}】**（当前节气：**${t.termName}**）。\n\n` +
          `对照你本人的八字原局（**日元【${dmLabel}】· 日支【${b.marriageBranch}】**），今日流日干支【${t.dPillar}】与你日元发生直接生克感应，本月【${t.mPillar}月】正处于金旺之令，今日及近期行事宜抓大放小、稳步收网！`;
      } else {
        sec1 = `### 🎯 一、核心结论（直断定论）\n\n` +
          timeBanner +
          `针对你本人的八字四柱实盘（**${g} · 四柱【${b.yearPillar} · ${b.monthPillar} · ${b.dayPillar} · ${b.hourPillar}】**），你日元为**【${dmLabel}】**，生于**【${b.monthPillar}月（节气：${b.solarTerm}）】**，日支婚姻宫为**【${b.marriageBranch}】**。\n\n` +
          `**直接定论**：你命局五行**【${bzD.wuxingStrongest || "土金"}偏旺、${bzD.wuxingWeakest || "水木"}偏弱】**，属于底气充足但需要“疏通流转”的格局。以当前时间（**公历${t.solarDateOnly} · ${t.lunarStr} · ${t.yPillar}年${t.mPillar}月**）为基准，今年前八个月的磨合已过，**当下本月（${t.lMonthLabel}·${t.mPillar}月）以及接下来的农历十月（己亥水旺月）、十一月（庚子水旺月）**气候调候得宜，是你今年财运与核心事务收获成果的主升浪！`;
      }

      sec2 = `### 🔍 二、本人命盘深度剖析（底层逻辑）\n\n` +
        `1. **日元与月令寒暖平衡（日主【${dmLabel}】× 月柱【${b.monthPillar}】）**：\n` +
        `   你是【${dmLabel}】命人，出生在【${b.monthPillar}】月（${b.solarTerm}之后）。八字看命，月令决定五成力量：你做事讲求效率、原则性强，不喜欢拖泥带水。命局能量就像一块成色极好的原矿，最需要的就是能够帮你泄秀生财、打通局面的喜用神五行。四柱透出十神**【${(bzD.tenGods || []).slice(0, 4).join("、") || "财官印食"}】**，具备独立成事的骨架。\n` +
        `2. **日支婚姻宫与六亲互动（日柱【${b.dayPillar}】· 婚姻宫【${b.marriageBranch}】）**：\n` +
        `   日支【${b.marriageBranch}】是你最贴身的能量场（婚姻宫与内心根基）。今年 ${t.yPillar}流年，流年地支与你原局四柱发生感应，意味着今年你的外部工作环境或伴侣关系正在经历一次实质性的“结构升级”。\n` +
        `3. **当前实时岁运生克（${t.yPillar}年 · ${t.mPillar}月 · ${t.dPillar}日）**：\n` +
        `   当前时间已进入公历 ${t.Y}年${t.M}月（${t.lunarStr}），流月【${t.mPillar}】金气主事，与流年【${t.yPillar}】形成火金交融之势——当下切忌单打独斗，借大平台、借贵人或借专业资质发力，事半功倍。`;

      sec3 = `### 📅 三、明确时间节点与行动建议\n\n` +
        `- **⏳ 结合当前时间（${t.solarDateOnly} · ${t.lunarStr}）的明确时间表**：\n` +
        `  - **当下本月（${t.lMonthLabel} · ${t.mPillar}月，即公历9月–10月上旬）**：${t.termName}之后金气进气，适合梳理现有项目、敲定合同细节、回笼资金。\n` +
        `  - **接下来黄金发力月（农历十月己亥月、农历十一月庚子月，即公历11月–12月）**：亥子水旺之月，润局调候得宜，是今年谈涨薪、签大单、确定重要关系或资产布局的最强窗口。\n` +
        `  - **谨慎守成月（农历九月戊戌月、农历十二月辛丑月）**：土气偏厚，容易出现流程拖延或文书反复，宜稳扎稳打。\n` +
        `- **⚡ 针对性行动策略**：\n` +
        `  1. **日常五行流通补益**：你命局最喜流通，办公桌或常居方位可多接纳北方/东方气场，做事遇到卡壳时，多与思维敏捷、温和条理的合作伙伴商议。\n` +
        `  2. **近期“先立规则后办事”**：凡涉及钱财合作与重要承诺，一切落到白纸黑字与明确时间节点上，绝不靠人情模糊处理。`;
    }

    const fullText = [sec1, sec2, sec3].join("\n\n---\n\n");
    const reasoningSteps = buildReasoningSteps(question, chart, mode);

    return {
      text: fullText,
      followups: [],
      reasoningSteps: reasoningSteps
    };
  }

  /* ---------- 7.1 把真实命盘压成结构化档案喂给模型 ---------- */
  function buildChartDossier(chart, mode = "ziwei") {
    const zw = chart.ziwei;
    const b  = chart.bazi;
    const p  = chart.profile;
    const t  = getCurrentTimeAnchor();
    const age = t.Y - p.year + 1;

    const lines = [];
    lines.push(`【⏰ 当前实时天文历法基准】公历：${t.solarStr} ｜ ${t.lunarStr} ｜ 实时干支：${t.ganzhiFull}`);
    const statusLabel = { single: "单身", dating: "恋爱中", broken: "断联/冷战中", married: "已婚" }[p.status];
    lines.push(`性别：${p.gender === "female" ? "女（坤造）" : "男（乾造）"}　本年虚岁：${age}岁　当前情感状态：${
      statusLabel || "本人未提供（不要为此反问，也不要假设。直接按命盘格局把模式与时机讲透；若不同状态下结论确实不同，就分情况各给一句结论）" }`);
    const tst = p.trueSolarTime || {};
    const tstInfo = tst.isCalibrated
      ? `出生地点：${tst.city}（东经${tst.longitude}°）｜钟表时间 ${tst.clockTimeStr} → 校准后真太阳时 ${tst.trueTimeStr}（差值 ${tst.totalDeltaMin >= 0 ? "+" : ""}${tst.totalDeltaMin} 分钟，排盘已严格按真太阳时时辰起盘）`
      : `出生时间：${p.year}-${p.month}-${p.day} ${String(p.hour).padStart(2, "0")}:${String(p.minute || 0).padStart(2, "0")}（按东经120°北京时间标准时起盘）`;
    lines.push(tstInfo);
    if (p.intervalCandidates && p.intervalCandidates.length > 1) {
      lines.push(`【⏳ 出生时间处于跨时辰模糊区间（${p.rangeStart || ""}–${p.rangeEnd || ""}）】经当地真太阳时校准后跨越以下 ${p.intervalCandidates.length} 个候选时辰盘：`);
      p.intervalCandidates.forEach((c, idx) => {
        lines.push(`  · 候选盘 ${String.fromCharCode(65 + idx)}（概率${c.prob}%）：【${c.shichenName}盘】｜八字时柱：${c.hourPillar}｜紫微命宫主星：${c.mingStars}｜夫妻宫：${c.spouseStars}｜核心性格特征：${c.traitText}`);
      });
      lines.push(`  💡 提示：若用户尚未在排盘抽屉中点击锁定单一时辰，你在回答时可结合其年柱、月柱、日柱（前三柱100%确定）给出稳健定论，并顺带用1-2句大白话点出上述候选时辰在当前问题上的细微差异，帮用户自然核对。`);
    }
    if (chart.lunar) lines.push(`出生农历：${chart.lunar.lYear}年${chart.lunar.lMonthLabel}${chart.lunar.lDayLabel}`);

    // 排盘引擎算出来的不确定性（节气跨界、晚子时流派、闰月分歧……）
    // 以前只在界面上提示，从来没告诉过模型 —— 模型因此会把一个可能排错的柱当成铁案讲。
    const warns = (chart.warnings || []).filter(function (w) {
      return String(w || "").indexOf("\u5df2\u6821\u51c6") < 0;   // 纯报备的不算不确定性
    });
    if (warns.length) {
      lines.push("\u3010\u26a0\ufe0f \u672c\u76d8\u7684\u4e0d\u786e\u5b9a\u6027\uff08\u6392\u76d8\u5f15\u64ce\u5b9e\u6d4b\uff0c\u4e0d\u662f\u5957\u8bdd\uff09\u3011");
      warns.forEach(function (w, i) { lines.push("  " + (i + 1) + ". " + w); });
      lines.push("  \u2192 \u7528\u6cd5\uff1a\u4e0d\u8981\u628a\u8fd9\u51e0\u6761\u5f53\u514d\u8d23\u58f0\u660e\u62c4\u51fa\u6765\uff0c\u4e5f\u4e0d\u8981\u6bcf\u6b21\u90fd\u63d0\u3002" +
                 "\u53ea\u6709\u5f53\u4f60\u8fd9\u4e00\u8f6e\u7684\u7ed3\u8bba**\u6070\u597d\u5c31\u67b6\u5728\u8fd9\u4e2a\u4e0d\u786e\u5b9a\u7684\u67f1\u6216\u65f6\u8fb0\u4e0a**\u65f6\uff0c" +
                 "\u7528\u4e00\u53e5\u8bdd\u70b9\u660e\uff08\u4f8b\u5982\u300c\u8fd9\u6761\u770b\u7684\u662f\u65f6\u67f1\uff0c\u4f60\u8fd9\u4e2a\u65f6\u8fb0\u5361\u5728\u8fb9\u4e0a\uff0c\u82e5\u5b9e\u9645\u662f\u2465\u65f6\u5219\u7ed3\u8bba\u76f8\u53cd\u300d\uff09\uff0c" +
                 "\u7136\u540e\u7ed9\u51fa\u533a\u5206\u4e24\u79cd\u60c5\u51b5\u7684\u5224\u65ad\u3002\u5176\u4f59\u65f6\u5019\u4e00\u5b57\u4e0d\u63d0\u3002");
    }
    lines.push("");

    if (mode === "bazi") {
      lines.push(`【八字四柱（本窗口专属实盘）】${b.yearPillar}　${b.monthPillar}　${b.dayPillar}　${b.hourPillar}`);
      lines.push(`日元：${b.dayMaster}（${b.wuxing}）　婚姻宫（日支）：${b.marriageBranch}　出生节气月：${b.solarTerm}`);
      lines.push(`配偶星：${b.tenGodSpouse}　婚姻神煞：${b.shensha.join("、")}`);
      if (b.detail) {
        const d = b.detail;
        lines.push(`月令：${d.monthZhi}月（${d.season}·${d.monthCN}）　调候坐标：${d.dayMasterLabel}·${d.monthCN}`);
        lines.push("四柱十神与藏干：" + d.pillars.map(function (pl) {
          return pl.pos + "柱" + pl.gan + pl.zhi + "(" + pl.ganGod + "／藏" +
                 pl.hidden.map(function (h) { return h.gan + h.god; }).join("·") + ")";
        }).join("　"));
        lines.push(`五行分布：${Object.keys(d.wuxingCount).map(function (k) { return k + d.wuxingCount[k]; }).join(" ")}` +
                   `　最旺${d.wuxingStrongest}　最弱${d.wuxingWeakest}` +
                   (d.wuxingMissing.length ? `　缺${d.wuxingMissing.join("")}` : "　不缺"));
        lines.push(`命中十神：${d.tenGods.join("、") || "无"}　配偶星(${d.spouseGods.join("/")})：${d.spouseGodAbsent ? "不透" : "已现于命局"}`);
      }
      lines.push(`\n【当前实时岁运】流年：${t.yPillar}年 ｜ 当前流月：${t.mPillar}月（${t.lMonthLabel}·${t.termName}后） ｜ 今日流日：${t.dPillar}日 ｜ 当前流时：${t.hPillar}时`);
      return lines.join("\n");
    }

    // 紫微专席实盘档案（完全隔离八字四柱）
    lines.push(`【紫微命盘（本窗口专属实盘）】${zw.juName}（纳音${zw.nayin}）　命宫：${zw.mingPalace.gan}${zw.mingPalace.branch}　身宫落：${zw.shenPalace}`);
    const sy = zw.sihuaYear || {};
    lines.push(`生年四化（${sy.gan}干）：${sy["禄"]}化禄、${sy["权"]}化权、${sy["科"]}化科、${sy["忌"]}化忌`);
    lines.push("");
    lines.push("【十二宫详盘】（格式：宫名｜宫干支｜主星(庙旺)[四化]｜辅星｜杂曜｜大限）");
    if (zw.palaces && zw.palaces.length === 12) {
      const ordered = [];
      for (let k = 0; k < 12; k++) {
        const idx = ((zw.raw.mingIdx - k) % 12 + 12) % 12;
        ordered.push(zw.palaces[idx]);
      }
      ordered.forEach(function (pal) {
        const mains = pal.mainStars.length
          ? pal.mainStars.map(function (x) {
              return x.name + "(" + x.brightness + ")" + (x.sihua ? "[化" + x.sihua + "]" : "");
            }).join(" ")
          : "空宫";
        const auxs = pal.auxStars.map(function (x) {
          return x.name + (x.sihua ? "[化" + x.sihua + "]" : "");
        }).join(" ") || "—";
        const pea = pal.peachStars.map(function (x) { return x.name; }).join(" ") || "—";
        const dx = pal.daxian ? (pal.daxian.start + "-" + pal.daxian.end + "岁") : "";
        const mark = (pal.isMing ? "★" : "") + (pal.isShen ? "☆" : "");
        lines.push(`${pal.name}${mark}｜${pal.gan}${pal.branch}｜${mains}｜${auxs}｜${pea}｜${dx}`);
      });
    }

    if (zw.raw && zw.raw.palaces) {
      const cur = zw.raw.palaces.filter(function (x) {
        return x.daxian && age >= x.daxian.start && age <= x.daxian.end;
      })[0];
      if (cur) lines.push(`\n【当前大限】${cur.daxian.start}-${cur.daxian.end}岁，行【${cur.name}】（${cur.gan}${cur.branch}）`);
    }
    lines.push(`【当前实时时间】公历${t.solarDateOnly}（${t.lunarStr}） ｜ 流年：${t.yPillar}年 ｜ 流月：${t.mPillar}月（${t.lMonthLabel}） ｜ 流日：${t.dPillar}日`);
    const ZWE = global.ZiweiEngine;
    if (ZWE && ZWE.SIHUA[t.yPillar.charAt(0)] && zw.raw) {
      const sh = ZWE.SIHUA[t.yPillar.charAt(0)];
      const flown = [];
      ["禄", "权", "科", "忌"].forEach(function (tKey) {
        for (let i = 0; i < 12; i++) {
          const pal = zw.raw.palaces[i];
          const hit = pal.mainStars.concat(pal.auxStars).some(function (x) { return x.name === sh[tKey]; });
          if (hit) { flown.push(`${sh[tKey]}化${tKey}→${pal.name}`); break; }
        }
      });
      if (flown.length) lines.push(`【${t.Y}年（${t.yPillar}）流年四化飞入本命宫位】${flown.join("　")}`);
    }
    return lines.join("\n");
  }


  /* ============================================================
   * 7.1.5 预推演台（Forecast Desk）
   * 大模型不会心算流年/流月/大限/大运，让它自己推就只能给空话。
   * 这里用排盘引擎把「本题相关宫位 + 当前大限/大运 + 未来三年流年 +
   * 未来六个月流月」全部精确算好，直接塞进 prompt 让它引用。
   * ============================================================ */

  function idx60(gz) {
    const g = TIANGAN.indexOf(String(gz).charAt(0)), z = DIZHI.indexOf(String(gz).charAt(1));
    if (g < 0 || z < 0) return 0;
    for (let i = 0; i < 60; i++) if (i % 10 === g && i % 12 === z) return i;
    return 0;
  }
  function gzOf60(i) { const k = ((i % 60) + 60) % 60; return TIANGAN[k % 10] + DIZHI[k % 12]; }

  /* 两支落在同一个 三合局/三会方 里时，返回 {wx, full}。
     full=true 表示这一对里含旺神（子午卯酉），才算真正的半合/半会；
     不含旺神（如申辰缺子、寅辰缺卯）只是「拱」，力量弱得多，不能当合论。 */
  function juOf(groups, a, b) {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.indexOf(a) >= 0 && g.indexOf(b) >= 0) {
        return { wx: g[3], full: (a === g[1] || b === g[1]) };
      }
    }
    return null;
  }

  // 地支关系（冲、合、半合、半会、刑、害、自刑，全量）
  function branchRel(a, b) {
    if (!a || !b) return "";
    const r = [];
    if (a === b) r.push(ZIXING.indexOf(a) >= 0 ? "伏吟兼自刑" : "伏吟");
    if (LIUCHONG[a] === b) r.push("相冲");
    if (LIUHE[a] === b) r.push("六合");
    if ((SANHE[a] || []).indexOf(b) >= 0) {
      const j = juOf(SANHE_GROUPS, a, b);
      if (j) r.push(j.full ? ("半合" + j.wx + "局") : ("拱" + j.wx + "（缺旺神，力弱，不作合论）"));
    }
    if (a !== b) {
      const h = juOf(SANHUI_GROUPS, a, b);
      if (h) r.push(h.full ? ("半会" + h.wx + "方") : ("拱" + h.wx + "（缺旺神，力弱）"));
    }
    if (LIUHAI[a] === b) r.push("相害");
    if (a !== b) {
      if (XING_PAIR[a] === b) r.push("相刑");
      else {
        for (let i = 0; i < XING_GROUP.length; i++) {
          if (XING_GROUP[i].indexOf(a) >= 0 && XING_GROUP[i].indexOf(b) >= 0) { r.push("相刑"); break; }
        }
      }
    }
    return r.join("、");
  }

  /* 天干关系：五合（含合化成败判断）与相冲。
     合化的主流条件是「化神得月令」；不得令则是「合而不化」——
     两干互相绊住，各自的十神作用打折，人事上表现为被牵制、决断迟疑。
     moZhi 传月支（判化神有无根）；brief=true 时只给短标签。 */
  function stemRel(a, b, moZhi, brief) {
    if (!a || !b) return "";
    if (a === b) return brief ? "并透" : "并透（同一个十神重复出现，力量叠加）";
    if (GAN_CHONG[a] === b) return brief ? "相冲" : "相冲（两股力量正面对撞，主动荡、主变）";
    if (WUHE[a] !== b) return "";
    const key = (TIANGAN.indexOf(a) < TIANGAN.indexOf(b)) ? (a + b) : (b + a);
    const hua = WUHE_HUA[key] || "";
    const de  = !!(moZhi && (HUA_DEDI[hua] || []).indexOf(moZhi) >= 0);
    if (brief) return de ? ("相合→化" + hua) : "合而不化";
    return de
      ? ("相合（" + key + "→化" + hua + "；月令" + moZhi + "，化神有根，倾向真化：性质转为" + hua + "）")
      : ("相合（" + key + "→化" + hua + "；月令" + moZhi + "，化神无根，合而不化：互相牵绊、决断打折）");
  }

  /* 十二长生：日干在某地支上的生旺死绝。
     阳干顺行、阴干逆行；这是判断「日元在这根支上有没有气」最直接的一把尺。 */
  const CS_NAMES = ["长生","沐浴","冠带","临官","帝旺","衰","病","死","墓","绝","胎","养"];
  const CS_START = { "甲":"亥","丙":"寅","戊":"寅","庚":"巳","壬":"申",
                     "乙":"午","丁":"酉","己":"酉","辛":"子","癸":"卯" };
  const YANG_GAN = ["甲","丙","戊","庚","壬"];
  function changSheng(gan, zhi) {
    const st = CS_START[gan];
    if (!st || !zhi) return "";
    const a = DIZHI.indexOf(st), b = DIZHI.indexOf(zhi);
    if (a < 0 || b < 0) return "";
    const yang = YANG_GAN.indexOf(gan) >= 0;
    const step = yang ? ((b - a) % 12 + 12) % 12 : ((a - b) % 12 + 12) % 12;
    return CS_NAMES[step];
  }

  // 五虎遁：年干 -> 寅月月干
  const YINYUE_GAN = { "甲":"丙","己":"丙","乙":"戊","庚":"戊","丙":"庚","辛":"庚","丁":"壬","壬":"壬","戊":"甲","癸":"甲" };
  function monthGanOf(yearGan, zhi) {
    const base = TIANGAN.indexOf(YINYUE_GAN[yearGan] || "丙");
    const n = ((DIZHI.indexOf(zhi) - 2) % 12 + 12) % 12;
    return TIANGAN[(base + n) % 10];
  }

  /* ---------- 紫微：本题宫位 / 大限 / 流年 / 流月 ---------- */
  function ziweiForecast(chart, dom, t) {
    const ZWE = global.ZiweiEngine;
    const zw = chart.ziwei || {};
    if (!ZWE || !zw.raw || !zw.raw.palaces || zw.raw.palaces.length !== 12) return "";
    const P = zw.raw.palaces;                 // 0=子 … 11=亥
    const NAMES = ZWE.PALACE_NAMES;
    const p = chart.profile;
    const L = [];

    function starsOf(i) {
      const pa = P[i];
      const main = pa.mainStars.length
        ? pa.mainStars.map(function (x) {
            return x.name + "(" + x.brightness + ")" + (x.sihua ? "[化" + x.sihua + "]" : "");
          }).join(" ")
        : ("空宫·借对宫" + (P[(i + 6) % 12].mainStars.map(function (x) { return x.name; }).join("") || "（亦无主星）"));
      const aux = pa.auxStars.map(function (x) {
        return x.name + (x.sihua ? "[化" + x.sihua + "]" : "");
      }).join(" ");
      const pea = pa.peachStars.map(function (x) { return x.name; }).join(" ");
      return main + (aux ? "｜辅煞：" + aux : "") + (pea ? "｜杂曜：" + pea : "");
    }
    function palIdx(name) { for (let i = 0; i < 12; i++) if (P[i].name === name) return i; return -1; }
    function findStarPal(nm) {
      for (let i = 0; i < 12; i++) {
        if (P[i].mainStars.some(function (x) { return x.name === nm; })) return P[i];
        if (P[i].auxStars.some(function (x) { return x.name === nm; })) return P[i];
      }
      return null;
    }
    function sihuaLine(gan) {
      const sh = ZWE.SIHUA[gan];
      if (!sh) return "—";
      return ["禄", "权", "科", "忌"].map(function (k) {
        const pa = findStarPal(sh[k]);
        return sh[k] + "化" + k + "→" + (pa ? "本命【" + pa.name + "】" : "此星不在本盘");
      }).join("　");
    }

    const tIdx = palIdx(dom.palName);
    const kTarget = NAMES.indexOf(dom.palName);

    if (tIdx >= 0) {
      const opp = (tIdx + 6) % 12, s1 = (tIdx + 4) % 12, s2 = (tIdx + 8) % 12;
      L.push("【本题锁定宫位 · 三方四正全貌】（本题属「" + dom.domainLabel + "」）");
      L.push("  ▸ 本宫【" + dom.palName + "】" + P[tIdx].gan + P[tIdx].branch + "：" + starsOf(tIdx));
      L.push("  ▸ 对宫【" + P[opp].name + "】" + P[opp].branch + "：" + starsOf(opp));
      L.push("  ▸ 三合【" + P[s1].name + "】" + P[s1].branch + "：" + starsOf(s1));
      L.push("  ▸ 三合【" + P[s2].name + "】" + P[s2].branch + "：" + starsOf(s2));
      L.push("");
    }

    /* ---- 宫干自化 与 飞化（飞星派核心：生年四化之外的第二层） ---- */
    const SELF_HUA = {
      "禄": "好处留不住：随和、不计较、给得出去也容易被人占便宜，这一宫的福分是过路财",
      "权": "自己撑场面：逞强、硬扛、不肯示弱，权柄抓在手里却常常白忙一场",
      "科": "要面子重于要里子：对外体面、说法周全，实际拿到的有限；但遇事确实容易被化解",
      "忌": "漏 —— 全盘最要紧的一种：付出了却留不下，做了等于没做。感情上是「我对你好你感觉不到」，钱财上是「赚了就散」，而且这一宫的事最容易是自己搞砸的"
    };
    const FLY_MEAN = {
      "禄": "把好处与精力主动投向这里，对这一宫有缘、有情",
      "权": "想在这里说了算、想把这一块掌控住",
      "科": "在这里要名声与体面，节奏偏慢，也容易遇到贵人",
      "忌": "对这里执着、放不下，也最容易在这里吃亏与耗损 —— 这是全盘最重要的一根线"
    };

    const selfs = [];
    for (let i = 0; i < 12; i++) {
      const sh0 = ZWE.SIHUA[P[i].gan];
      if (!sh0) continue;
      ["禄", "权", "科", "忌"].forEach(function (k) {
        const pa = findStarPal(sh0[k]);
        if (pa && pa.index === i) selfs.push({ i: i, k: k, star: sh0[k] });
      });
    }
    let shenIdx = -1;
    for (let i = 0; i < 12; i++) if (P[i].isShen) shenIdx = i;
    if (shenIdx >= 0) {
      const same = (P[shenIdx].name === "命宫");
      L.push("【身宫 —— 后天的着力点（命宫是先天本性，身宫是他后半生实际把力气花在哪）】");
      L.push("  ▸ 身宫落【" + P[shenIdx].name + "】" + P[shenIdx].gan + P[shenIdx].branch + "：" + starsOf(shenIdx));
      L.push(same
        ? "  ▸ 身命同宫：本性和后天用力方向一致，人比较「一以贯之」，但也意味着缺少第二条退路，一条路走到黑。"
        : "  ▸ 命宫管他天生是什么人，身宫管他三十五岁以后实际经营的是什么。两者不同宫时，中年前后会有一次明显的重心转移，从【命宫】那套活法挪到【" + P[shenIdx].name + "】这套上来。");
      L.push("  ▸ 本题若与【" + P[shenIdx].name + "】有关，权重要加大：那是他真正肯投入的地方。");
      L.push("");
    }

    L.push("【宫干自化 —— 离心力（生年四化是向内聚，自化是向外漏，方向相反，绝不能混为一谈）】");
    if (selfs.length) {
      selfs.forEach(function (x) {
        L.push("  ▸ 【" + P[x.i].name + "】宫干" + P[x.i].gan + "，使本宫【" + x.star + "】自化" + x.k + "：" + SELF_HUA[x.k]);
      });
    } else {
      L.push("  ▸ 全盘十二宫皆无自化 —— 各宫能量不外泄，际遇相对稳定、少反复。这本身就是一条可用的判断，不是「没查到」。");
    }
    L.push("");

    const mIdx = palIdx("命宫");
    const flyFrom = [];
    if (tIdx >= 0) flyFrom.push(tIdx);
    if (mIdx >= 0 && mIdx !== tIdx) flyFrom.push(mIdx);
    if (flyFrom.length) {
      L.push("【宫干飞化 —— 这一宫主动去牵动了谁】");
      flyFrom.forEach(function (i) {
        const sh1 = ZWE.SIHUA[P[i].gan];
        if (!sh1) return;
        L.push("  ▸ 【" + P[i].name + "】宫干" + P[i].gan + "：");
        ["禄", "权", "科", "忌"].forEach(function (k) {
          const pa = findStarPal(sh1[k]);
          if (!pa) { L.push("     · 化" + k + "在【" + sh1[k] + "】：此星不在本盘，不论"); return; }
          const isSelf = (pa.index === i);
          L.push("     · 化" + k + "在【" + sh1[k] + "】→ 落【" + pa.name + "·" + pa.branch + "】" +
                 (isSelf ? "＝自化（力量向外漏掉，并没有飞出去牵动别的宫）：" + SELF_HUA[k]
                         : "：" + FLY_MEAN[k]));
        });
      });
      L.push("");
    }

    if (tIdx >= 0) {
      const inJi = [], inLu = [];
      for (let i = 0; i < 12; i++) {
        if (i === tIdx) continue;
        const sh2 = ZWE.SIHUA[P[i].gan];
        if (!sh2) continue;
        const pj = findStarPal(sh2["忌"]);
        if (pj && pj.index === tIdx) inJi.push("【" + P[i].name + "】(宫干" + P[i].gan + "，化忌在" + sh2["忌"] + ")");
        const pl = findStarPal(sh2["禄"]);
        if (pl && pl.index === tIdx) inLu.push("【" + P[i].name + "】(宫干" + P[i].gan + "，化禄在" + sh2["禄"] + ")");
      }
      L.push("【谁在牵动本题宫【" + dom.palName + "】】");
      L.push("  ▸ 化忌飞入：" + (inJi.length
        ? inJi.join("、") + " —— 这几件事会主动来消耗本题，往往才是问题的真正来源，比本宫星曜更该先讲"
        : "无 —— 本题不被其他宫位拖累，问题出在本宫自身"));
      L.push("  ▸ 化禄飞入：" + (inLu.length
        ? inLu.join("、") + " —— 这几个方向会主动来滋养本题，是现成可借的力"
        : "无 —— 本题得不到其他宫位的主动助力，只能靠本宫自己"));
      L.push("");
    }

    // 大限
    const age = t.Y - p.year + 1;
    let dxIdx = -1;
    for (let i = 0; i < 12; i++) {
      if (P[i].daxian && age >= P[i].daxian.start && age <= P[i].daxian.end) dxIdx = i;
    }
    if (dxIdx >= 0) {
      const dx = P[dxIdx].daxian;
      L.push("【当前大限（10年运）】" + dx.start + "–" + dx.end + "岁，本人虚岁" + age +
             "，已走到大限第 " + (age - dx.start + 1) + " 年（共10年）");
      L.push("  ▸ 大限命宫＝本命【" + P[dxIdx].name + "】" + P[dxIdx].gan + P[dxIdx].branch + "：" + starsOf(dxIdx));
      L.push("  ▸ 大限四化（以大限宫干【" + P[dxIdx].gan + "】飞）：" + sihuaLine(P[dxIdx].gan));
      if (kTarget >= 0) {
        const j = ((dxIdx - kTarget) % 12 + 12) % 12;
        L.push("  ▸ 大限" + dom.palName + "＝本命【" + P[j].name + "】" + P[j].branch + "：" + starsOf(j));
      }
      let nxt = -1;
      for (let i = 0; i < 12; i++) if (P[i].daxian && P[i].daxian.start === dx.end + 1) nxt = i;
      if (nxt >= 0) {
        L.push("  ▸ 下一大限：" + P[nxt].daxian.start + "–" + P[nxt].daxian.end + "岁（公历约" +
               (p.year + P[nxt].daxian.start - 1) + "年起）走本命【" + P[nxt].name + "】：" + starsOf(nxt));
      }
      L.push("");
    }

    // 流年（今年起三年）
    L.push("【流年推演 · " + t.Y + "–" + (t.Y + 2) + "】");
    for (let yy = t.Y; yy <= t.Y + 2; yy++) {
      const gz = yearGanZhi(yy), gan = gz.charAt(0), zhi = gz.charAt(1);
      const lm = DIZHI.indexOf(zhi);
      L.push("  ◆ " + yy + "年（" + gz + "，虚岁" + (yy - p.year + 1) + "）流年命宫＝本命【" +
             P[lm].name + "】" + zhi + "：" + starsOf(lm));
      if (kTarget >= 0) {
        const j = ((lm - kTarget) % 12 + 12) % 12;
        L.push("     · 流年" + dom.palName + "＝本命【" + P[j].name + "】" + P[j].branch + "：" + starsOf(j));
      }
      L.push("     · 流年四化（" + gan + "干）：" + sihuaLine(gan));
      if (tIdx >= 0) {
        const rel = branchRel(zhi, P[tIdx].branch);
        L.push("     · 岁支【" + zhi + "】对本题宫支【" + P[tIdx].branch + "】：" + (rel || "无刑冲会合"));
      }
    }
    L.push("");

    // 流月（斗君法，未来六个农历月，公历起始日精确到日）
    const CC = global.CalendarCore;
    const hourZhi = String((chart.bazi || {}).hourPillar || "").charAt(1);
    const birthLM = chart.lunar ? chart.lunar.lMonth : 0;
    if (CC && hourZhi && birthLM) {
      const hIdx = DIZHI.indexOf(hourZhi);
      function douJun(lyear) {                       // 该流年的「斗君」＝正月命宫所在
        const st = DIZHI.indexOf(yearZhi(lyear));
        return ((st - (birthLM - 1) + hIdx) % 12 + 12) % 12;
      }
      try {
        const cur = CC.newMoonOnOrBefore(CC.dayNumber(t.Y, t.M, t.D));
        const rows = [];
        for (let sft = 0; sft < 6; sft++) {
          const dn = CC.newMoonDayNum(cur.k + sft);
          const g = CC.jdToGregorian(dn - 0.5);
          const gd = Math.floor(g.d);
          const lu = CC.solarToLunar(g.y, g.m, gd);
          if (!lu) continue;
          const i = (douJun(lu.lYear) + (lu.lMonth - 1)) % 12;
          const flag = (tIdx >= 0 && i === tIdx) ? "　⚑【流月命宫正落本题宫，本月是关键引动点】" : "";
          rows.push("  · " + (lu.isLeap ? "闰" : "") + lu.lMonthLabel + "（公历" + g.m + "月" + gd + "日 起）：流月命宫＝本命【" +
                    P[i].name + "】" + P[i].branch + "：" + starsOf(i) + flag);
        }
        if (rows.length) {
          L.push("【未来六个月 · 流月命宫（斗君法已精确排定，直接用，勿自行推算）】");
          L.push(rows.join("\n"));
        }
      } catch (e) {}
    }
    return L.join("\n");
  }

  /* ---------- 八字：大运 / 流年 / 流月 ---------- */
  let _dayunCache = { key: "", val: null };
  function computeDayun(chart) {
    const CC = global.CalendarCore;
    const b = chart.bazi, p = chart.profile;
    if (!CC || !b || !b.monthPillar) return null;
    const key = [p.year, p.month, p.day, p.hour, p.minute || 0, p.gender].join("|");
    if (_dayunCache.key === key) return _dayunCache.val;

    const yGan = String(b.yearPillar).charAt(0);
    const yangYear = TIANGAN.indexOf(yGan) % 2 === 0;
    const male = p.gender !== "female";
    const forward = (yangYear === male);            // 阳男阴女顺行，阴男阳女逆行

    const jdBirth = CC.gregorianToJD(p.year, p.month, p.day + (p.hour + (p.minute || 0) / 60) / 24);
    let prevJD = null, nextJD = null;
    for (let yy = p.year - 1; yy <= p.year + 1; yy++) {
      for (let k = 0; k < 24; k += 2) {             // 偶数 k 为「节」
        const j = CC.solarTermJD(yy, k);
        if (j <= jdBirth && (prevJD === null || j > prevJD)) prevJD = j;
        if (j > jdBirth && (nextJD === null || j < nextJD)) nextJD = j;
      }
    }
    if (prevJD === null || nextJD === null) return null;
    const days = forward ? (nextJD - jdBirth) : (jdBirth - prevJD);
    const ageF = days / 3;                          // 三日折一年
    let startY = Math.floor(ageF);
    let startM = Math.round((ageF - startY) * 12);
    if (startM >= 12) { startY += 1; startM = 0; }          // 免得出现「7岁12个月」

    const m60 = idx60(b.monthPillar);
    const list = [];
    for (let s2 = 1; s2 <= 9; s2++) {
      const from = startY + (s2 - 1) * 10;
      list.push({
        gz: gzOf60(m60 + (forward ? s2 : -s2)),
        fromAge: from, toAge: from + 9,
        fromYear: p.year + from, toYear: p.year + from + 9
      });
    }
    const val = { forward: forward, startY: startY, startM: startM, list: list };
    _dayunCache = { key: key, val: val };
    return val;
  }


  /* ---------- 八字专属：日元旺衰 + 喜用忌神 ----------
   * bazi_analyze.js 刻意不做这件事（流派分歧大，判错会污染 RAG 检索）。
   * 这里单独算，只喂给 LLM 当分析起点，并且把打分依据一起交出去，
   * 让它自己复核，而不是盲信一个数字。检索那条路仍然只用无争议的事实。
   */
  const HIDDEN_GAN = {
    "子":["癸"], "丑":["己","癸","辛"], "寅":["甲","丙","戊"], "卯":["乙"],
    "辰":["戊","乙","癸"], "巳":["丙","庚","戊"], "午":["丁","己"], "未":["己","丁","乙"],
    "申":["庚","壬","戊"], "酉":["辛"], "戌":["戊","辛","丁"], "亥":["壬","甲"]
  };
  const GANWX = { "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水" };
  const WXREL = {
    "木":{ "木":"比","火":"泄","土":"耗","金":"克","水":"生" },
    "火":{ "火":"比","土":"泄","金":"耗","水":"克","木":"生" },
    "土":{ "土":"比","金":"泄","水":"耗","木":"克","火":"生" },
    "金":{ "金":"比","水":"泄","木":"耗","火":"克","土":"生" },
    "水":{ "水":"比","木":"泄","火":"耗","土":"克","金":"生" }
  };
  const WX_FANGWEI = { "木":"东方","火":"南方","土":"中部／西南、东北","金":"西方","水":"北方" };
  const WX_COLOR   = { "木":"青、绿","火":"红、橙、紫","土":"黄、咖、米","金":"白、银、金属色","水":"黑、深蓝、灰" };
  const WX_HANGYE  = {
    "木":"教育、出版、文化内容、医药健康、服装、园艺、人事培养类",
    "火":"互联网与电子、能源、传媒演艺、营销品牌、餐饮、美业、一切靠曝光吃饭的",
    "土":"房产建筑、农业食品、仓储物流基建、保险中介、政府事业单位、需要长期扎根的",
    "金":"金融、法律、机械制造、汽车五金、军警、珠宝、硬件与精密制造",
    "水":"贸易外销、物流运输、旅游、咨询顾问、自媒体、外语涉外、流动性强的"
  };

  // 各柱权重：月令最重，其次日支（日元坐下），再是年时支与天干
  const SLOT_W = { moZhi: 3.0, dayZhi: 1.5, yearZhi: 1.0, hourZhi: 1.0,
                   yearGan: 0.8, moGan: 1.0, hourGan: 0.8 };
  // 藏干权重：本气 / 中气 / 余气
  const HID_W = [0.6, 0.25, 0.15];
  // 某五行对日元的帮扶度，范围 [-1, +1]
  const HELP = { "比": 1.0, "生": 0.8, "泄": -0.6, "耗": -0.8, "克": -1.0 };

  function baziStrength(chart) {
    const b = chart.bazi;
    if (!b || !b.dayMaster) return null;
    const dm = b.dayMaster, dmWx = GANWX[dm];
    const P4 = [b.yearPillar, b.monthPillar, b.dayPillar, b.hourPillar].map(function (x) { return String(x); });
    const moZhi = P4[1].charAt(1);

    const why = [];
    let num = 0, den = 0;

    function zhiHelp(z) {                      // 一个地支的综合帮扶度
      const hs = HIDDEN_GAN[z] || [];
      let v = 0, w = 0;
      hs.forEach(function (g, i) {
        const ww = HID_W[i] || 0.15;
        v += ww * HELP[WXREL[dmWx][GANWX[g]]];
        w += ww;
      });
      return w ? v / w : 0;
    }
    function add(slotW, help) { num += slotW * help; den += slotW; }

    // ① 月令（得令与否，权重最大）
    const moBen = (HIDDEN_GAN[moZhi] || [])[0];
    const moRel = moBen ? WXREL[dmWx][GANWX[moBen]] : "";
    add(SLOT_W.moZhi, zhiHelp(moZhi));
    if (moRel) {
      why.push("月令【" + moZhi + "】本气" + moBen + GANWX[moBen] + "，对日元" + dm + dmWx +
               "为「" + moRel + "」→ " + (HELP[moRel] > 0 ? "得令（这一项占三成权重）" : "失令（这一项占三成权重）"));
    }

    // ② 其余三支：日支＝坐下，最贴身
    add(SLOT_W.yearZhi, zhiHelp(P4[0].charAt(1)));
    add(SLOT_W.dayZhi,  zhiHelp(P4[2].charAt(1)));
    add(SLOT_W.hourZhi, zhiHelp(P4[3].charAt(1)));

    const roots = [], POS = ["年", "月", "日", "时"];
    P4.forEach(function (p, i) {
      const z = p.charAt(1);
      (HIDDEN_GAN[z] || []).forEach(function (g, k) {
        const rel = WXREL[dmWx][GANWX[g]];
        if (rel === "比" || rel === "生") {
          roots.push(POS[i] + "支" + z + "藏" + g + (k === 0 ? "" : "（余气）") + "·" + rel);
        }
      });
    });
    why.push(roots.length ? "通根／得生：" + roots.join("、") : "四支之中无一处比劫印星可依（完全不通根）");

    // ③ 三个天干（日干本身不计）
    const ganSlots = [[P4[0].charAt(0), SLOT_W.yearGan, "年"],
                      [P4[1].charAt(0), SLOT_W.moGan, "月"],
                      [P4[3].charAt(0), SLOT_W.hourGan, "时"]];
    const helps = [], drains = [];
    ganSlots.forEach(function (x) {
      const rel = WXREL[dmWx][GANWX[x[0]]];
      add(x[1], HELP[rel]);
      if (rel === "比" || rel === "生") helps.push(x[2] + "干" + x[0] + "·" + rel);
      else drains.push(x[2] + "干" + x[0] + "·" + rel);
    });
    if (helps.length)  why.push("天干帮扶：" + helps.join("、"));
    if (drains.length) why.push("天干耗身：" + drains.join("、"));

    // 归一化到 [-1, 1]。注意五行里只有「比」「生」帮身，天然偏负，
    // 所以判定线不是 0，而是下面这组按真实命盘分布校准出来的分界值。
    const raw = den ? num / den : 0;
    const score = Math.round(raw * 1000) / 1000;

    let verdict;
    if (score >= 0.10) verdict = "身强";
    else if (score >= -0.06) verdict = "偏强";
    else if (score >= -0.24) verdict = "中和";
    else if (score >= -0.40) verdict = "偏弱";
    else verdict = "身弱";

    const strong = (verdict === "身强" || verdict === "偏强");
    const weak = (verdict === "身弱" || verdict === "偏弱");
    function wxOf(rel) {
      return ["木", "火", "土", "金", "水"].filter(function (w) { return WXREL[dmWx][w] === rel; });
    }
    let favor, avoid, rule;
    if (strong) {
      favor = wxOf("泄").concat(wxOf("耗"), wxOf("克"));
      avoid = wxOf("比").concat(wxOf("生"));
      rule = "日元偏旺，宜泄、宜耗、宜克 —— 力气要有地方使出去，再补就过了";
    } else if (weak) {
      favor = wxOf("生").concat(wxOf("比"));
      avoid = wxOf("泄").concat(wxOf("耗"), wxOf("克"));
      rule = "日元偏弱，宜生扶、宜帮身 —— 先把自己撑住，别再被抽";
    } else {
      favor = []; avoid = [];
      rule = "日元中和，扶抑两可 —— 以调候、通关为主，哪头偏了补哪头";
    }

    const wxCount = (chart.bazi.detail && chart.bazi.detail.wuxingCount) || {};
    let tiaohou = "";
    if (["亥", "子", "丑"].indexOf(moZhi) >= 0 && (wxCount["火"] || 0) < 1.2) {
      tiaohou = "生于冬月" + moZhi + "，命局火气不足（火=" + (wxCount["火"] || 0) +
                "）→ 调候急需【火】暖局，这条优先于扶抑喜忌";
    } else if (["巳", "午", "未"].indexOf(moZhi) >= 0 && (wxCount["水"] || 0) < 1.2) {
      tiaohou = "生于夏月" + moZhi + "，命局水气不足（水=" + (wxCount["水"] || 0) +
                "）→ 调候急需【水】润局，这条优先于扶抑喜忌";
    }

    return { dm: dm, dmWx: dmWx, score: score, verdict: verdict, why: why,
             favor: favor, avoid: avoid, rule: rule, tiaohou: tiaohou };
  }

  /* ============================================================
   * 7.1.4b 月令取格（子平正格）
   * 只讲旺衰不讲格局，等于只说了「这个人力气多大」，
   * 没说「他这辈子走的是哪条路」—— 格局才是八字的骨架。
   * 取法（沈氏《子平真诠》一路）：
   *   ① 月令本气透在天干（年/月/时干，不含日干）→ 以它的十神取格
   *   ② 本气不透，中气或余气透 → 以透出者取格
   *   ③ 都不透 → 直接以月令本气的十神取格
   *   ④ 月令本气与日元同类（比肩/劫财）→ 不入八正格，走建禄 / 阳刃
   * 成败只做**能程序化判定**的那几条，判不了的交给模型，并把依据全摊开。
   * ============================================================ */
  const PATTERN_INFO = {
    "正官格": {
      road: "靠规矩、名分与体制立身。适合有明确职级和评价标准的地方，越正规越吃得开",
      check: "官星要清、要有根，同时身要担得起这个官"
    },
    "七杀格": {
      road: "靠压力、竞争与狠劲上位。适合高强度、有对手、见输赢的路",
      check: "有制有化才叫七杀格；无制无化那是杀重身轻，是负担不是本事"
    },
    "正财格": {
      road: "靠稳定积累与实打实的交付赚钱。适合看得见摸得着的生意与手艺",
      check: "财是身的对手盘，身不够强，财再多也拿不住"
    },
    "偏财格": {
      road: "靠信息差、流动与人脉赚钱。适合外拓、多线、来得快也去得快的路",
      check: "偏财喜身强，身强才撑得起大进大出"
    },
    "食神格": {
      road: "靠输出、专长与作品吃饭。节奏偏温和，讲究持续产出",
      check: "食神要有根，且要能生到财或制到杀；光有食神不落地就是空转"
    },
    "伤官格": {
      road: "靠才气、锋芒与不循常规出头。上限高，但容易撞规则",
      check: "伤官必须有出口 —— 要么生财、要么佩印。没有出口就是惹事"
    },
    "正印格": {
      road: "靠学历、资历与体系内的认可立身。起步慢，后劲稳",
      check: "印是靠山；靠山太厚也会压住手脚，要看有没有食伤透出来做事"
    },
    "偏印格": {
      road: "靠偏门技艺、专业壁垒与独特路径。不走大众赛道",
      check: "看有没有东西管得住它 —— 没人管的偏印，会把人困在自己的想法里"
    },
    "建禄格": {
      road: "月令就是自己的禄位。天生自立、不靠家底，一切要自己挣",
      check: "关键不在身旺，而在这股旺气有没有出口"
    },
    "阳刃格": {
      road: "刚烈果决、爆发力强。适合硬碰硬的路，风险也在这里",
      check: "阳刃是把刀，有鞘才是本事，没鞘就是伤"
    },
    "月劫格": {
      road: "同辈、同行、合伙人是这辈子绕不开的一条线。靠人成事，也常因人受损",
      check: "关键看财官食伤有没有透出来 —— 有出口，众人之力为我所用；没出口，就是内耗与分账"
    }
  };

  /* 人元司令分野（《渊海子平》/《三命通会》通行本）
     顺序：余气 → 中气 → 本气，[天干, 占用天数]。
     ⚠️ 天数各家有出入（另有 5/9/16 一说）。这里只把它当作**一条摆出来的信息**，
     不拿它去偷偷改写取格 —— 实测 1500 张盘，用它取格只有 5.6% 会变，
     其中近一半还只是阴阳翻转；分歧本身比收益大，所以交给人判断。 */
  const SILING = {
    "子":[["壬",10],["癸",20]],
    "丑":[["癸",9],["辛",3],["己",18]],
    "寅":[["戊",7],["丙",7],["甲",16]],
    "卯":[["甲",10],["乙",20]],
    "辰":[["乙",9],["癸",3],["戊",18]],
    "巳":[["戊",7],["庚",7],["丙",16]],
    "午":[["丙",10],["己",9],["丁",11]],
    "未":[["丁",9],["乙",3],["己",18]],
    "申":[["戊",7],["壬",7],["庚",16]],
    "酉":[["庚",10],["辛",20]],
    "戌":[["辛",9],["丁",3],["戊",18]],
    "亥":[["戊",7],["甲",7],["壬",16]]
  };

  function silingOf(chart) {
    const CC = global.CalendarCore;
    const p = chart.profile, b = chart.bazi;
    if (!CC || !p || !b || !CC.solarTermDate || !CC.gregorianToJD) return null;
    const moZhi = String(b.monthPillar).charAt(1);
    const seq = SILING[moZhi];
    if (!seq) return null;
    let jd;
    try { jd = CC.gregorianToJD(p.year, p.month, p.day + 0.5); } catch (e) { return null; }
    let best = null;
    for (let yy = p.year - 1; yy <= p.year; yy++) {
      for (let k = 0; k < 24; k += 2) {
        let t;
        try { t = CC.solarTermDate(yy, k); } catch (e) { continue; }
        if (t && t.jd <= jd && (!best || t.jd > best.jd)) best = t;
      }
    }
    if (!best) return null;
    const n = Math.floor(jd - Math.floor(best.jd + 0.5) - 0.5) + 1;
    if (!(n >= 1 && n <= 40)) return null;
    let acc = 0, idx = seq.length - 1;
    for (let i = 0; i < seq.length; i++) { acc += seq[i][1]; if (n <= acc) { idx = i; break; } }
    const LBL = (seq.length === 2) ? ["余气", "本气"] : ["余气", "中气", "本气"];
    return { gan: seq[idx][0], label: LBL[idx], day: n, term: best.name,
             isMain: idx === seq.length - 1 };
  }

  // 月令本气为比劫时的格名（建禄 / 阳刃 / 月劫）
  function luPatternName(dm, moZhi) {
    const cs = changSheng(dm, moZhi);
    if (cs === "临官") return "建禄格";
    if (cs === "帝旺" && YANG_GAN.indexOf(dm) >= 0) return "阳刃格";
    return "月劫格";
  }

  /* ============================================================
   * 7.1.4c 神煞（八字）
   * 神煞只添色彩、只讲「这件事以什么面貌发生」，
   * **不改大方向** —— 大方向是格局与旺衰的事。
   * 原来这里只有 5 个而且全是感情向的（早期恋爱 APP 的遗产），
   * 问事业、问钱、问健康时这一层等于没有。
   * 为了不变成报菜名，只输出与本题相关的那几个。
   * ============================================================ */
  const SANHE_KEY = {          // 地支 -> 所属三合局代号
    "申":"水","子":"水","辰":"水", "寅":"火","午":"火","戌":"火",
    "巳":"金","酉":"金","丑":"金", "亥":"木","卯":"木","未":"木"
  };
  const BY_JU = {              // 以三合局取的神煞
    "驿马": { "水":"寅", "火":"申", "金":"亥", "木":"巳" },
    "桃花": { "水":"酉", "火":"卯", "金":"午", "木":"子" },
    "将星": { "水":"子", "火":"午", "金":"酉", "木":"卯" },
    "华盖": { "水":"辰", "火":"戌", "金":"丑", "木":"未" }
  };
  const TIANYI = { "甲":["丑","未"], "戊":["丑","未"], "乙":["子","申"], "己":["子","申"],
                   "丙":["亥","酉"], "丁":["亥","酉"], "壬":["卯","巳"], "癸":["卯","巳"],
                   "庚":["寅","午"], "辛":["寅","午"] };
  const WENCHANG = { "甲":"巳","乙":"午","丙":"申","戊":"申","丁":"酉","己":"酉",
                     "庚":"亥","辛":"子","壬":"寅","癸":"卯" };
  const JINYU    = { "甲":"辰","乙":"巳","丙":"未","丁":"申","戊":"未",
                     "己":"申","庚":"戌","辛":"亥","壬":"丑","癸":"寅" };
  const YANGREN  = { "甲":"卯","丙":"午","戊":"午","庚":"酉","壬":"子" };  // 只论阳干
  const XUNKONG  = { "甲子":["戌","亥"], "甲戌":["申","酉"], "甲申":["午","未"],
                     "甲午":["辰","巳"], "甲辰":["寅","卯"], "甲寅":["子","丑"] };
  const SS_MEAN = {
    "天乙贵人": "一生逢难有人搭手；是全盘最有分量的吉神",
    "文昌贵人": "考试、文书、执照、写东西这条路顺；也主脑子转得快",
    "驿马":     "走动、调岗、出差、搬家、跨城跨国；坐不住，动了反而顺",
    "桃花":     "异性缘与被喜欢的能力；也主人缘与镜头感，不限于感情",
    "将星":     "带队、扛事、被推到台前；有实权感",
    "华盖":     "偏艺术、玄学、研究、独处；才气高但容易孤",
    "金舆":     "配偶或婚姻带来的实际助益；也主坐享其成的那部分",
    "羊刃":     "冲劲与爆发力，也是意外、争执、血光的来源；要有官杀管住",
    "空亡":     "看着有、其实抓不住；这一柱的事容易落空或反复"
  };
  const PILLAR_MEAN = {
    "年": "祖上与早年（约 0–16 岁），也管家世背景与你出身的那个环境",
    "月": "父母兄弟与青年（约 17–32 岁），也管事业的起步阶段",
    "日": "你自己与配偶、中年（约 33–48 岁）—— 落在这里最贴身",
    "时": "子女与晚年（约 49 岁后），也管你的退路和最后的落脚点"
  };
  // 本题只看这几个，其余不列（防止堆砌）
  const SS_BY_DOMAIN = {
    "感情婚恋":     ["桃花", "天乙贵人", "金舆", "空亡", "华盖"],
    "事业发展":     ["将星", "天乙贵人", "驿马", "羊刃", "文昌贵人"],
    "财运置业":     ["天乙贵人", "驿马", "金舆", "羊刃", "空亡"],
    "变动与远行":   ["驿马", "空亡", "天乙贵人", "华盖"],
    "身心健康":     ["羊刃", "空亡", "华盖"],
    "内在状态与心性": ["华盖", "空亡", "桃花"],
    "家庭与长辈":   ["天乙贵人", "空亡", "华盖"],
    "子女与创造":   ["文昌贵人", "华盖", "空亡"],
    "人际与合作":   ["将星", "天乙贵人", "桃花", "羊刃"],
    "学业考试":     ["文昌贵人", "天乙贵人", "华盖", "空亡"],
    "综合运势":     ["天乙贵人", "驿马", "将星", "空亡", "羊刃"]
  };
  const SS_DEFAULT = ["天乙贵人", "驿马", "空亡", "羊刃"];

  function shenshaOf(chart, domainLabel) {
    const b = chart.bazi;
    if (!b || !b.dayMaster) return null;
    const dm = b.dayMaster;
    const slots = [
      { k: "年", gz: String(b.yearPillar) },
      { k: "月", gz: String(b.monthPillar) },
      { k: "日", gz: String(b.dayPillar) },
      { k: "时", gz: String(b.hourPillar) }
    ];
    const zhiOf = function (x) { return x.gz.charAt(1); };
    const yrZhi = zhiOf(slots[0]), dayZhi = zhiOf(slots[2]);

    // 以三合局取的：年支与日支两套都查（通行做法），去重
    const jus = [];
    [yrZhi, dayZhi].forEach(function (z) {
      const j = SANHE_KEY[z];
      if (j && jus.indexOf(j) < 0) jus.push(j);
    });

    // 旬空：以日柱所在旬定
    let kong = [];
    const i60 = idx60(String(b.dayPillar));
    const xunHead = gzOf60(i60 - (i60 % 10));
    kong = XUNKONG[xunHead] || [];

    const hits = {};   // 名称 -> [柱位]
    const push = function (nm, k) {
      if (!hits[nm]) hits[nm] = [];
      if (hits[nm].indexOf(k) < 0) hits[nm].push(k);
    };
    slots.forEach(function (sp) {
      const z = zhiOf(sp);
      if ((TIANYI[dm] || []).indexOf(z) >= 0) push("天乙贵人", sp.k);
      if (WENCHANG[dm] === z) push("文昌贵人", sp.k);
      if (JINYU[dm] === z)    push("金舆", sp.k);
      if (YANGREN[dm] === z)  push("羊刃", sp.k);
      if (kong.indexOf(z) >= 0 && sp.k !== "日") push("空亡", sp.k);   // 日柱本身不论空
      jus.forEach(function (j) {
        Object.keys(BY_JU).forEach(function (nm) {
          if (BY_JU[nm][j] === z) push(nm, sp.k);
        });
      });
    });

    const want = SS_BY_DOMAIN[domainLabel] || SS_DEFAULT;
    const shown = [], others = [];
    Object.keys(hits).forEach(function (nm) {
      (want.indexOf(nm) >= 0 ? shown : others).push(nm);
    });
    shown.sort(function (a, c) { return want.indexOf(a) - want.indexOf(c); });
    return { hits: hits, shown: shown, others: others, dm: dm, kong: kong, xun: xunHead };
  }

  function derivePattern(chart) {
    const b = chart.bazi;
    const AC = global.AstrologyCore;
    if (!b || !b.dayMaster || !AC || !AC.getTenGod) return null;
    const dm = b.dayMaster;
    const god = function (g) { return AC.getTenGod(dm, g); };
    const yG = String(b.yearPillar).charAt(0);
    const mG = String(b.monthPillar).charAt(0);
    const hG = String(b.hourPillar).charAt(0);
    const zhis = [String(b.yearPillar).charAt(1), String(b.monthPillar).charAt(1),
                  String(b.dayPillar).charAt(1), String(b.hourPillar).charAt(1)];
    const moZhi = zhis[1];
    const otherGans = [yG, mG, hG].filter(Boolean);     // 取格只看年月时干，不含日干
    const hid = HIDDEN_GAN[moZhi] || [];
    const LBL = ["本气", "中气", "余气"];
    const steps = [];

    steps.push("月令【" + moZhi + "】藏干：" +
      hid.map(function (h, i) { return LBL[i] + h + "＝" + god(h); }).join("　"));

    let picked = -1;
    for (let i = 0; i < hid.length; i++) {
      if (otherGans.indexOf(hid[i]) >= 0) { picked = i; break; }
    }
    const src = picked >= 0 ? hid[picked] : hid[0];
    if (!src) return null;
    steps.push(picked >= 0
      ? ("月令" + LBL[picked] + "【" + src + "】透在天干 → 以它取格")
      : ("月令藏干一个都没透出天干 → 退一步按本气【" + src + "】取格"));

    const g0 = god(src);
    let name = "";
    if (g0 === "比肩" || g0 === "劫财") {
      // 临官＝建禄；帝旺且日元为阳干＝阳刃（阴干不论刃）；其余（如戊日生辰月＝冠带）归月劫
      name = luPatternName(dm, moZhi);
      steps.push("月令本气与日元同类（" + g0 + "），不入八正格；日元在月令为【" +
                 changSheng(dm, moZhi) + "】→ 取【" + name + "】");
    } else {
      name = g0 + "格";
      steps.push("→ 取【" + name + "】");
    }

    // 透干的十神（年月时干）与含藏干的十神，分开统计：透干才有力
    const tou = {}, all = {};
    otherGans.forEach(function (g) { tou[god(g)] = (tou[god(g)] || 0) + 1; all[god(g)] = (all[god(g)] || 0) + 1; });
    zhis.forEach(function (z) {
      (HIDDEN_GAN[z] || []).forEach(function (g) { all[god(g)] = (all[god(g)] || 0) + 1; });
    });
    const T = function (n) { return !!tou[n]; };
    const A = function (n) { return !!all[n]; };

    const st = baziStrength(chart);
    const strong = !!(st && (st.verdict === "身强" || st.verdict === "偏强"));
    const weak   = !!(st && (st.verdict === "身弱" || st.verdict === "偏弱"));
    const broken = [], saved = [], notes = [];

    if (name === "正官格") {
      if (T("伤官")) broken.push("天干透【伤官】—— 伤官见官，这是正官格头一条大忌");
      if (T("七杀")) broken.push("天干同时透【七杀】—— 官杀混杂，格局不清");
      if (T("正印")) saved.push("透【正印】—— 官印相生，既护身又护官，是正官格最好的配置");
      if (T("正财") || T("偏财")) saved.push("透【财】—— 财生官，官星有源头");
      if (weak && !A("正印") && !A("偏印") && !A("比肩") && !A("劫财"))
        broken.push("身弱且四柱无印无比劫 —— 担不起这个官，官反而成了压力");
    } else if (name === "七杀格") {
      if (T("食神")) saved.push("透【食神】—— 食神制杀，七杀格最正的一种成法");
      if (T("正印") || T("偏印")) saved.push("透【印】—— 杀生印、印生身，凶转为用");
      if (T("正财") || T("偏财")) broken.push("透【财】—— 财党杀，把七杀喂得更凶" + (weak ? "（身弱时尤其危险）" : ""));
      if (T("正官")) broken.push("天干同时透【正官】—— 官杀混杂");
      if (!A("食神") && !A("正印") && !A("偏印"))
        broken.push("全局无食神也无印 —— 杀无制无化，这是负担不是本事");
      if (weak) notes.push("身弱遇杀，首要是活下来：先找印、比劫，别急着拿食伤去硬拼");
    } else if (name === "正财格" || name === "偏财格") {
      if (strong) saved.push("身旺担得起财 —— 这是财格成立的前提");
      if (T("食神") || T("伤官")) saved.push("透【食伤】—— 食伤生财，财有源头，不是死钱");
      if (T("比肩") || T("劫财")) broken.push("天干透【比劫】—— 比劫夺财，合伙、分账、借钱这几件事上最容易栽");
      if (weak) broken.push("身弱而财旺 —— 财多身弱，钱会反过来压人；先补身，别先谈扩张");
      if (name === "正财格" && T("正官")) saved.push("透【正官】—— 财生官，路能从赚钱走到有位置");
    } else if (name === "食神格") {
      if (T("偏印")) broken.push("天干透【偏印】—— 枭神夺食，这是食神格头一条大忌，专把人的输出掐掉");
      if (T("正财") || T("偏财")) saved.push("透【财】—— 食神生财，才气能换成钱");
      if (A("七杀") && A("食神")) saved.push("局中有杀有食 —— 食神制杀，压力能被本事顶回去");
      if (weak) notes.push("身弱而食神重，输出是在抽自己，要控制节奏");
    } else if (name === "伤官格") {
      if (T("正官")) {
        if (T("正印")) saved.push("虽有伤官见官，但透【印】能制伤 —— 有救");
        else if (T("正财") || T("偏财")) saved.push("虽有伤官见官，但透【财】能通关（伤生财、财生官）—— 有救");
        else broken.push("天干透【正官】而无财无印 —— 伤官见官，无通关，这一条最伤");
      }
      if (T("正财") || T("偏财")) saved.push("透【财】—— 伤官生财，这是伤官最实用的出路");
      if (T("正印")) saved.push("透【正印】—— 伤官佩印，才华被约束住反而成器");
      if (!A("正财") && !A("偏财") && !A("正印") && !A("偏印"))
        broken.push("既不生财也不佩印 —— 伤官没有出口，才气会变成是非");
      if (weak) notes.push("身弱而伤官重，是在透支自己换掌声");
    } else if (name === "正印格" || name === "偏印格") {
      if (T("正官") || T("七杀")) saved.push("透【官杀】—— 官杀生印，靠山有来路");
      if (T("正财") || T("偏财")) {
        if (weak) broken.push("身弱又透【财】—— 财破印，把靠山拆了");
        else saved.push("身不弱而透【财】—— 财能制住过旺的印，反而是好事");
      }
      if (name === "偏印格" && A("食神") && T("偏印"))
        broken.push("偏印透而局中有食神 —— 枭神夺食，自己掐自己的输出");
      if (!A("食神") && !A("伤官"))
        notes.push("全局无食伤 —— 印重而无泄，容易想得多做得少，落地是弱项");
    } else if (name === "建禄格") {
      const hasOut = T("正财") || T("偏财") || T("正官") || T("七杀") || T("食神") || T("伤官");
      if (hasOut) saved.push("天干透出了财／官／食伤 —— 旺气有出口，这是建禄格成立的关键");
      else broken.push("天干无财、无官、无食伤 —— 一身旺气使不出去，人会困住");
    } else if (name === "阳刃格") {
      if (T("正官") || T("七杀")) saved.push("透【官杀】制刃 —— 刀有鞘，这是阳刃格最好的配置");
      else broken.push("无官杀制刃 —— 刃旺无制，冲动起来没有刹车");
      if (T("食神") || T("伤官")) saved.push("透【食伤】泄秀 —— 锋芒有地方使");
    } else if (name === "月劫格") {
      const hasOut2 = T("正财") || T("偏财") || T("正官") || T("七杀") || T("食神") || T("伤官");
      if (hasOut2) saved.push("天干透出了财／官／食伤 —— 这股同类之气有地方使");
      else broken.push("天干无财、无官、无食伤 —— 比劫成群却没有出口，最容易在分账与内耗上折损");
      if (T("正官") || T("七杀")) saved.push("透【官杀】—— 有人管得住这群人，秩序就立得起来");
    }

    let tier;
    if (!broken.length && saved.length) tier = "成格，且配置到位 —— 层次偏高";
    else if (!broken.length) tier = "成格，但没有明显的相神护着 —— 中等，看大运给不给力";
    else if (saved.length) tier = "成中有破，好在还有救应 —— 中等偏下";
    else tier = "破格且暂无救应 —— 层次偏低。重点看大运有没有把缺的那一味补进来";

    if (st && st.score >= 0.72)
      notes.push("⚠️ 帮扶度 " + st.score + " 已经极端。这有可能是专旺／从强格，不能照普通扶抑看。" +
                 "你要自己复核：若四柱几乎全是比劫印星、且没有有力的官杀财来克，就该顺其旺势，而不是去克泄。判反了整篇就废了。");
    if (st && st.score <= -0.78)
      notes.push("⚠️ 帮扶度 " + st.score + " 已经极端。这有可能是从财／从杀／从儿格。" +
                 "你要自己复核：若日元完全无根、无印无比劫，就该顺从旺神 —— 此时原本的「忌神」反而是用神。这一条判反，整篇结论全部颠倒。");

    // ── 人元司令：另一种取法，有分歧就如实摆出来，不替用户选边 ──
    let siling = null;
    const sl = silingOf(chart);
    if (sl) {
      const slGod = god(sl.gan);
      const slName = (slGod === "比肩" || slGod === "劫财")
        ? luPatternName(dm, moZhi) : (slGod + "格");
      siling = {
        gan: sl.gan, god: slGod, label: sl.label, day: sl.day, term: sl.term,
        tou: otherGans.indexOf(sl.gan) >= 0,
        altName: slName,
        diverges: (slName !== name)
      };
    }

    const info = PATTERN_INFO[name] || {};
    return { name: name, src: src, srcGod: g0, steps: steps, siling: siling,
             road: info.road || "", check: info.check || "",
             broken: broken, saved: saved, notes: notes, tier: tier };
  }

  function baziForecast(chart, dom, t) {
    const b = chart.bazi || {};
    const p = chart.profile;
    const dg = b.dayMaster;
    const CC = global.CalendarCore;
    const AC = global.AstrologyCore;
    if (!dg || !AC || !AC.getTenGod) return "";
    const god = function (g) { return AC.getTenGod(dg, g); };
    const dayZhi = String(b.dayPillar).charAt(1);
    const yrZhi = String(b.yearPillar).charAt(1);
    const moZhi = String(b.monthPillar).charAt(1);
    const yrGan = String(b.yearPillar).charAt(0);
    const moGan = String(b.monthPillar).charAt(0);
    const L = [];

    L.push("【本题切入口】" + dom.domainLabel + " —— 重点看：" + dom.baziAspect +
           "（日元【" + dg + b.wuxing + "】｜日支婚姻宫【" + dayZhi + "】｜月令【" + moZhi + "】）");
    L.push("");

    const st = baziStrength(chart);
    if (st) {
      L.push("【日元旺衰（扶抑法打分，依据已列出，你要自己复核一遍再下结论）】");
      L.push("  ▸ 结论：日元 " + st.dm + st.dmWx + " → 【" + st.verdict + "】（归一化帮扶度 " + st.score + "，范围 -1 ~ +1）");
      st.why.forEach(function (w) { L.push("     · " + w); });
      L.push("  ▸ 取用原则：" + st.rule);
      if (st.favor.length) {
        L.push("  ▸ 喜用五行：【" + st.favor.join("、") + "】");
        st.favor.forEach(function (w) {
          L.push("     · " + w + "：方位 " + WX_FANGWEI[w] + "｜颜色 " + WX_COLOR[w] + "｜行业 " + WX_HANGYE[w]);
        });
      }
      if (st.avoid.length) L.push("  ▸ 忌神五行：【" + st.avoid.join("、") + "】（这几类环境、行业、人少碰）");
      if (st.tiaohou) L.push("  ▸ ⚠️ 调候：" + st.tiaohou);
      const hZhi = String(b.hourPillar).charAt(1);
      L.push("  ▸ 日元【" + dg + "】的十二长生（这根支上日元有没有气，一眼可判）：" +
             "年支" + yrZhi + "＝" + changSheng(dg, yrZhi) + "　月令" + moZhi + "＝" + changSheng(dg, moZhi) +
             "　日支" + dayZhi + "＝" + changSheng(dg, dayZhi) + "　时支" + hZhi + "＝" + changSheng(dg, hZhi));
      L.push("     · 临官／帝旺＝当令有力；长生／冠带＝有气可用；衰病死墓绝＝无气，别硬说他这块强");
      L.push("");
    }

    const pat = derivePattern(chart);
    if (pat) {
      L.push("【格局（月令取格）—— 这是骨架，比旺衰更能决定他走哪条路】");
      pat.steps.forEach(function (x) { L.push("  · " + x); });
      L.push("  ▸ 结论：【" + pat.name + "】" + (pat.road ? "　—— " + pat.road : ""));
      if (pat.check) L.push("  ▸ 成败看什么：" + pat.check);
      if (pat.saved.length) pat.saved.forEach(function (x) { L.push("  ✅ " + x); });
      if (pat.broken.length) pat.broken.forEach(function (x) { L.push("  ❌ " + x); });
      L.push("  ▸ 层次判断：" + pat.tier);
      if (pat.siling) {
        const sg = pat.siling;
        L.push("  ▸ 人元司令：生于" + sg.term + "后第 " + sg.day + " 天，此时当令的是【" +
               sg.gan + "】（" + sg.label + "，十神为" + sg.god + "）" +
               (sg.tou ? "，且它确实透在天干" : "，但它没有透出天干"));
        if (sg.diverges) {
          L.push("  ⚖️ 【两派取法在这张盘上会分家】按上面的「本气优先透干」取【" + pat.name +
                 "】；若按「人元司令为主」则取【" + sg.altName + "】。");
          L.push("     这不是 bug，是子平本身的流派分歧（分野天数各家也有 7/7/16 与 5/9/16 之别）。");
          L.push("     \u26a0\ufe0f 这是给你内部定夺用的：自己选一个（看谁在这张盘上更有力、更贴他的实际经历），");
          L.push("     然后就按那一个往下写。**不要把流派分歧写给用户看** —— 他问的是怎么办，不是子平学术史。");
          L.push("     唯一的例外：两种取法会导出**相反的行动建议**时，用一句话说明你为什么选了这一边。");
        } else {
          L.push("     两种取法在这张盘上结论一致，格局判定是稳的。");
        }
      }
      pat.notes.forEach(function (x) { L.push("  " + x); });
      L.push("  ▸ 以上取格依据是给你复核用的。不同意就按你自己的取法写，但这段推导过程一个字都不要出现在回答里。");
      L.push("");
    }

    const ss = shenshaOf(chart, dom.domainLabel);
    if (ss) {
      L.push("【神煞 · 只列与本题相关的（落在哪一柱，决定它管人生的哪一段）】");
      if (ss.shown.length) {
        ss.shown.forEach(function (nm) {
          const ks = ss.hits[nm];
          L.push("  · 【" + nm + "】在 " + ks.map(function (k) { return k + "柱"; }).join("、") +
                 " —— " + SS_MEAN[nm]);
          ks.forEach(function (k) { L.push("      · " + k + "柱＝" + PILLAR_MEAN[k]); });
        });
      } else {
        L.push("  · 与本题相关的神煞一个都没查到 —— 这本身就是一条信息：这件事上没有现成的外力，得靠格局本身那套逻辑走。");
      }
      if (ss.others.length) {
        L.push("  · 另外查到但与本题无关，**不要在回答里提**：" + ss.others.join("、"));
      }
      L.push("  ⚠️ 神煞只添色彩、只说「这件事以什么面貌发生」，**不改大方向**。");
      L.push("     跟格局或喜忌打架时，一律以格局与喜忌为准。");
      L.push("     \u26a0\ufe0f **默认一个神煞都不要写进回答**。只有当某一个神煞真的改变了你的结论、"
             + "或改变了他该做的动作时，才提它。");
      L.push("     而且只提那一个，用大白话说它会带来什么，神煞名字收进〔〕依据句里。禁止罗列一堆。");
      L.push("");
    }

    L.push("【怎么读下面的刑冲会合 —— 用错了比不用更糟】");
    L.push("  · 冲＝正面撞击，主变动、分离、提速；刑＝内部消耗、纠缠反复、是非口舌；害＝暗处受损、被拖累、关系里的隐性伤");
    L.push("  · 六合＝被绊住（不一定是好事，也可能是想走走不掉）；半合／半会＝真成局，那个五行力量明显变强");
    L.push("  · 拱＝缺旺神的虚局，力弱，只能作辅助线索，不许当成合局下结论");
    L.push("  · 天干合而不化＝两边互相牵制，那个十神的作用打折，人事上表现为被人拉扯、决断变慢");
    L.push("  · 天干真化＝性质真的转成化神那一行，要按新五行重新看喜忌");
    L.push("  · 伏吟＝同一件事重演一遍；冲（反吟）＝整个翻过来");
    L.push("  · ⚠️ 一个字上同时挂多个关系时（例如既冲又刑），必须说清楚哪个主导，不许两个都罗列了事");
    L.push("");

    const dy = computeDayun(chart);
    let curDy = null;
    if (dy) {
      const realAge = t.Y - p.year;
      L.push("【大运】" + (dy.forward ? "顺行" : "逆行") + "，起运 " + dy.startY + " 岁 " + dy.startM +
             " 个月（约公历 " + (p.year + dy.startY) + " 年上运），每十年一换");
      dy.list.forEach(function (d) {
        if (realAge >= d.fromAge && realAge <= d.toAge) curDy = d;
      });
      dy.list.slice(0, 9).forEach(function (d) {
        if (d.toYear < t.Y - 10 || d.fromYear > t.Y + 20) return;
        const mark = (d === curDy) ? "★当前" : "  ";
        const g2 = String(d.gz).charAt(0), z2 = String(d.gz).charAt(1);
        const rels = [];
        const r1 = branchRel(z2, dayZhi); if (r1) rels.push("与日支" + dayZhi + r1);
        const r2 = branchRel(z2, yrZhi);  if (r2) rels.push("与年支" + yrZhi + r2);
        const r3 = branchRel(z2, moZhi);  if (r3) rels.push("与月支" + moZhi + r3);
        const gRels = [];
        const q1 = stemRel(g2, dg, moZhi);    if (q1) gRels.push("与日元" + dg + q1);
        const q2 = stemRel(g2, moGan, moZhi, true); if (q2) gRels.push("与月干" + moGan + q2);
        const q3 = stemRel(g2, yrGan, moZhi, true); if (q3) gRels.push("与年干" + yrGan + q3);
        L.push("  " + mark + " " + d.gz + "运（" + d.fromYear + "–" + d.toYear + "，" + d.fromAge + "–" + d.toAge +
               "岁）｜运干" + g2 + "＝【" + god(g2) + "】" +
               (gRels.length ? "｜天干：" + gRels.join("，") : "") + "｜运支" + z2 +
               "（日元在此＝" + changSheng(dg, z2) + "）" +
               (rels.length ? "：" + rels.join("，") : "：与原局无刑冲会合"));
      });
      if (curDy) {
        L.push("  ▸ 本人目前走在【" + curDy.gz + "运】第 " + (t.Y - curDy.fromYear + 1) + " 年（共10年），" +
               (t.Y - curDy.fromYear + 1 >= 6 ? "已进入后五年（运支主事）" : "尚在前五年（运干主事）"));
      }
      L.push("");
    }

    L.push("【流年推演 · " + t.Y + "–" + (t.Y + 2) + "】");
    for (let yy = t.Y; yy <= t.Y + 2; yy++) {
      const gz = yearGanZhi(yy), g2 = gz.charAt(0), z2 = gz.charAt(1);
      const rels = [];
      const r1 = branchRel(z2, dayZhi); if (r1) rels.push("与日支" + dayZhi + r1);
      const r2 = branchRel(z2, yrZhi);  if (r2) rels.push("与年支" + yrZhi + r2);
      const r3 = branchRel(z2, moZhi);  if (r3) rels.push("与月支" + moZhi + r3);
      if (curDy) {
        const r4 = branchRel(z2, String(curDy.gz).charAt(1));
        if (r4) rels.push("与大运支" + String(curDy.gz).charAt(1) + r4);
      }
      const gRels = [];
      const q1 = stemRel(g2, dg, moZhi);          if (q1) gRels.push("与日元" + dg + q1);
      const q2 = stemRel(g2, moGan, moZhi, true); if (q2) gRels.push("与月干" + moGan + q2);
      if (curDy) {
        const dgz = String(curDy.gz).charAt(0);
        const q3 = stemRel(g2, dgz, moZhi, true); if (q3) gRels.push("与运干" + dgz + q3);
      }
      L.push("  ◆ " + yy + "年 " + gz + "（虚岁" + (yy - p.year + 1) + "）｜年干" + g2 + "＝【" + god(g2) +
             "】" + (gRels.length ? "｜天干：" + gRels.join("，") : "") +
             "｜年支" + z2 + "（日元在此＝" + changSheng(dg, z2) + "）" +
             (rels.length ? "：" + rels.join("，") : "：与原局无刑冲会合"));
    }
    L.push("");

    // 流月：未来六个节气月（起始日精确到日）
    if (CC) {
      try {
        const nowJD = CC.gregorianToJD(t.Y, t.M, t.D + (t.H + t.Min / 60) / 24);
        const terms = [];
        for (let yy = t.Y; yy <= t.Y + 1; yy++) {
          for (let k = 0; k < 24; k += 2) {
            const d = CC.solarTermDate(yy, k);
            terms.push({ k: k, y: yy, jd: d.jd, m: d.m, d: d.d, name: d.name });
          }
        }
        terms.sort(function (a, c) { return a.jd - c.jd; });
        let st = 0;
        for (let i = 0; i < terms.length; i++) if (terms[i].jd <= nowJD) st = i;
        const rows = [];
        for (let i = st; i < st + 6 && i + 1 < terms.length; i++) {
          const cu = terms[i], nx = terms[i + 1];
          const zi = ((cu.k / 2) + 1) % 12;
          const z2 = DIZHI[zi];
          const lyY = (cu.k === 0) ? cu.y - 1 : cu.y;       // 小寒(丑月)仍属上一命理年
          const g2 = monthGanOf(ganOfYear(lyY), z2);
          const rels = [];
          const r1 = branchRel(z2, dayZhi); if (r1) rels.push("与日支" + dayZhi + r1);
          const r2 = branchRel(z2, moZhi);  if (r2) rels.push("与月令" + moZhi + r2);
          const r3 = branchRel(z2, yrZhi);  if (r3) rels.push("与年支" + yrZhi + r3);
          if (curDy) {
            const dz = String(curDy.gz).charAt(1);
            const r4 = branchRel(z2, dz);
            if (r4) rels.push("与大运支" + dz + r4);
          }
          const mq = stemRel(g2, dg, moZhi, true);
          rows.push("  · " + g2 + z2 + "月（" + cu.name + " " + cu.m + "/" + cu.d + " – " + nx.name + " " + nx.m + "/" + nx.d +
                    "）｜月干" + g2 + "＝【" + god(g2) + "】" + (mq ? "（与日元" + dg + mq + "）" : "") +
                    (rels.length ? "｜" + rels.join("，") : ""));
        }
        if (rows.length) {
          L.push("【未来六个节气月（公历起讫已算好，给时间点必须落到这些区间里）】");
          L.push(rows.join("\n"));
        }
      } catch (e) {}
    }
    return L.join("\n");
  }

  function ganOfYear(y) { return TIANGAN[((((y - 4) % 10) + 10) % 10)]; }

  // 用户本轮是不是在问时间；是的话流月表必须留着
  const TIME_QUESTION = /\u65f6\u95f4|\u4ec0\u4e48\u65f6\u5019|\u557a\u65f6\u5019|\u54ea\u5e74|\u54ea\u4e2a\u6708|\u51e0\u6708|\u51e0\u53f7|\u591a\u4e45|\u4f55\u65f6|\u5e74\u5e95|\u8fd1\u671f|\u6700\u8fd1|\u4eca\u5e74|\u660e\u5e74|\u540e\u5e74|\u4e0b\u534a\u5e74|\u4e0a\u534a\u5e74|\u7a97\u53e3|\u8282\u70b9/;

  // 同一张盘里，流月表每轮都一模一样 —— 模型看到它就会再拄一遍。
  // 追问轮只要不是在问时间，就把这块撑掉。
  function trimDeskForFollowup(body, question, ctx) {
    if (!ctx || !(ctx.turn > 1)) return body;
    if (TIME_QUESTION.test(String(question || ""))) return body;
    const src = String(body).split("\n");
    const out = [];
    let skipping = false, dropped = 0;
    for (let i = 0; i < src.length; i++) {
      const ln = src[i];
      if (/^\u3010\u672a\u6765\u516d\u4e2a/.test(ln)) { skipping = true; dropped++; continue; }
      if (skipping) {
        if (/^\u3010/.test(ln)) skipping = false;
        else { dropped++; continue; }
      }
      out.push(ln);
    }
    if (!dropped) return body;
    return out.join("\n") +
      "\n\u3010\u6d41\u6708\u8868\u672c\u8f6e\u5df2\u6491\u6389\u3011\u672a\u6765\u516d\u4e2a\u6708\u7684\u6392\u5e03\u4e0a\u51e0\u8f6e\u5df2\u7ecf\u7ed9\u8fc7\u7528\u6237\u4e86\u3002" +
      "\u672c\u8f6e\u7981\u6b62\u518d\u5217\u6708\u4efd\u8868\u3001\u7981\u6b62\u9010\u6708\u70b9\u8bc4\uff1b\u786e\u6709\u5fc5\u8981\u5f15\u7528\u67d0\u4e2a\u6708\u65f6\uff0c\u4e00\u53e5\u8bdd\u5e26\u8fc7\u3002";
  }

  function buildForecastDesk(chart, question, mode, ctx) {
    try {
      const t = getCurrentTimeAnchor();
      const dom = resolveDomainAndPalace(question, chart);
      let body = (mode === "bazi") ? baziForecast(chart, dom, t) : ziweiForecast(chart, dom, t);
      if (!body) return "";
      body = trimDeskForFollowup(body, question, ctx);
      const yTable = [];
      for (let k = -1; k <= 10; k++) yTable.push((t.Y + k) + "=" + yearGanZhi(t.Y + k));
      return "\n════════ 【🧮 预推演台：以下岁运数据已由排盘引擎精确算出，直接引用，严禁自行心算或改动】 ════════\n" +
             "【公历年 ↔ 流年干支对照表】" + yTable.join("　") +
             "\n  ❗ 写到任何一年时，干支只能照这张表抄。写错一个干支，整篇就作废了。\n" +
             body +
             "\n══════════════════════════════════════════════════════════════════\n";
    } catch (e) { return ""; }
  }

  /* ---------- 7.2 系统提示词（含典籍 RAG） ---------- */
    function buildReasoningSteps(question, chart, kbMode = "ziwei") {
    const dom = resolveDomainAndPalace(question, chart);
    const b = chart.bazi || {};
    const zw = chart.ziwei || {};
    const t = getCurrentTimeAnchor();
    const mingPal = (zw.palaces || []).find(p => p.name === "命宫") || {};
    const mingStar = (mingPal.mainStars || []).map(s => s.name).join("·") || "借对宫主星";

    let step1Text = "";
    let step2Text = "";
    let step3Text = "";
    if (kbMode === "ziwei") {
      step1Text = `当前时间：${t.solarDateOnly}（${t.lunarStr} · ${t.yPillar}年${t.mPillar}月）｜锁定本人紫微【${dom.palName}】（坐${dom.starDesc}）与对宫【${dom.opp.name || "对宫"}】（坐${dom.oppDesc}）。`;
      step2Text = `内部检索紫微斗数知识库规则，剖析【${dom.starDesc}】在${dom.palName}的庙旺利陷、性格底色及三方四正交互机制。`;
      step3Text = `结合当前流年流月（${t.yPillar}年${t.mPillar}月）四化引动，推演${dom.domainLabel}当下的核心矛盾与接下来几个月的转折窗口。`;
    } else {
      step1Text = `当前时间：${t.solarDateOnly}（${t.lunarStr} · ${t.yPillar}年${t.mPillar}月）｜锁定本人八字四柱：${b.yearPillar} · ${b.monthPillar} · ${b.dayPillar} · ${b.hourPillar}（日元【${b.dayMaster}${b.wuxing}】）。`;
      step2Text = `内部检索子平八字知识库规则，分析日元【${b.dayMaster}${b.wuxing}】生于【${b.monthPillar}月】的寒暖燥湿、格局强弱与喜忌用神。`;
      step3Text = `结合当前岁运（${t.yPillar}年${t.mPillar}月${t.dPillar}日）与原局十神生克冲合，推演近期运势起伏与关键发力月份。`;
    }

    const step4Text = `内化底层命理规则，过滤晦涩术语与引文，直接输出清晰、客观的大白话分析结论与行动建议。`;

    return [
      { badge: "步骤一 · 时间与实盘定标", text: step1Text, quote: "" },
      { badge: "步骤二 · 命理规则内化推演", text: step2Text, quote: "" },
      { badge: "步骤三 · 实时岁运走势研判", text: step3Text, quote: "" },
      { badge: "步骤四 · 结论与策略凝练", text: step4Text, quote: "" }
    ];
  }


  /**
   * 极简「思考便签」：给聊天气泡上方那条折叠的思考条用。
   * 只写真实算出来的关键坐标，每条尽量 ≤ 26 字，4–5 条即可。
   * 和旧的四步仪式感文案不同 —— 这里不写「正在检索古籍」这种废话。
   */
  function buildThinkingNotes(question, chart, kbMode) {
    const out = [];
    try {
      const t = getCurrentTimeAnchor();
      const dom = resolveDomainAndPalace(question, chart);
      const p = chart.profile;
      if (kbMode === "bazi") {
        const b = chart.bazi || {};
        out.push("四柱 " + b.yearPillar + " " + b.monthPillar + " " + b.dayPillar + " " + b.hourPillar);
        out.push("日元" + b.dayMaster + b.wuxing + "生" + String(b.monthPillar).charAt(1) + "月，看" + dom.baziAspect);
        const dy = computeDayun(chart);
        if (dy) {
          const realAge = t.Y - p.year;
          let cur = null;
          dy.list.forEach(function (d) { if (realAge >= d.fromAge && realAge <= d.toAge) cur = d; });
          if (cur) {
            out.push("大运 " + cur.gz + "（" + cur.fromYear + "–" + cur.toYear + "），走到第 " +
                     (t.Y - cur.fromYear + 1) + " 年");
          }
        }
        const yg = yearGanZhi(t.Y);
        out.push("流年 " + yg + "：年干" + yg.charAt(0) + "为" +
                 (global.AstrologyCore ? global.AstrologyCore.getTenGod(b.dayMaster, yg.charAt(0)) : "—"));
        out.push("比对未来六个节气月与大运、日支的冲合");
      } else {
        const zw = chart.ziwei || {};
        const mp = (zw.palaces || []).find(function (x) { return x.name === "命宫"; });
        if (mp) {
          out.push("命宫 " + mp.gan + mp.branch + "：" +
                   (mp.mainStars.map(function (x) { return x.name; }).join("") || "空宫借对宫"));
        }
        out.push("本题锁定【" + dom.palName + "】" + dom.starDesc.replace(/\[化(.)\]/g, "化$1"));
        out.push("对宫【" + (dom.opp.name || "对宫") + "】" + dom.oppDesc.replace(/\[化(.)\]/g, "化$1"));
        const ZWE = global.ZiweiEngine;
        if (ZWE && zw.raw && zw.raw.palaces) {
          const P2 = zw.raw.palaces;
          const age = t.Y - p.year + 1;
          for (let i = 0; i < 12; i++) {
            if (P2[i].daxian && age >= P2[i].daxian.start && age <= P2[i].daxian.end) {
              out.push("大限 " + P2[i].daxian.start + "–" + P2[i].daxian.end + "岁走【" + P2[i].name + "】");
              break;
            }
          }
          const yg = yearGanZhi(t.Y);
          const li = DIZHI.indexOf(yg.charAt(1));
          if (li >= 0) out.push("流年 " + yg + "：流年命宫入本命【" + P2[li].name + "】");
        }
        out.push("推未来六个月流月命宫落点");
      }
    } catch (e) {}
    return out.filter(function (x) { return x && x.length; }).slice(0, 6);
  }


  /* ---------- 追问去重：把上几轮已经讲过的东西挑出来，禁止再讲一遍 ---------- */
  const PALACE_VOCAB = ["命宫","兄弟宫","夫妻宫","子女宫","财帛宫","疾厄宫",
                        "迁移宫","交友宫","官禄宫","田宅宫","福德宫","父母宫"];
  const STAR_VOCAB = ["紫微","天机","太阳","武曲","天同","廉贞","天府","太阴","贪狼","巨门",
                      "天相","天梁","七杀","破军","左辅","右弼","文昌","文曲","天魁","天钺",
                      "擎羊","陀罗","火星","铃星","地空","地劫","红鸾","天喜","天姚","咸池"];
  const GOD_VOCAB = ["比肩","劫财","食神","伤官","正财","偏财","正官","七杀","正印","偏印"];

  function collectCovered(history) {
    const txt = (history || [])
      .filter(function (h) { return h.role === "ai" || h.role === "assistant"; })
      .map(function (h) { return String(h.content || ""); })
      .join("\n");
    if (!txt.trim()) return null;
    const uniq = function (a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); };
    const hit = function (arr) { return arr.filter(function (w) { return txt.indexOf(w) >= 0; }); };
    return {
      palaces: hit(PALACE_VOCAB),
      stars: hit(STAR_VOCAB).slice(0, 12),
      gods: hit(GOD_VOCAB),
      dates: uniq(txt.match(/\d{1,2}月\d{1,2}日/g) || []).slice(0, 10),
      years: uniq(txt.match(/20\d\d年/g) || []).slice(0, 6)
    };
  }

  // 词表拦不住「同一个结论换个说法再说一遍」——
  // 必须把上一轮的判断句原样摆给模型看。
  const CONCLUSIVE = /[\u4f1a\u8981\u522b\u5e94\u8be5\u9002\u5408\u4e0d\u5b9c\u6700\u597d\u5efa\u8bae\u6ce8\u610f\u5bb9\u6613\u5fc5\u987b\u4e00\u5b9a\u53ef\u4ee5\u4e0d\u80fd\u96be\u7a33\u52a8\u51b2\u65fa\u5f31\u5148\u522b\u7b49]/;

  function recentClaims(history) {
    const ais = (history || []).filter(function (h) { return h.role === "ai" || h.role === "assistant"; });
    if (!ais.length) return [];
    const last = String(ais[ais.length - 1].content || "");
    if (!last.trim()) return [];
    const evid = new RegExp("(" + PALACE_VOCAB.concat(STAR_VOCAB, GOD_VOCAB).join("|") +
                            "|20\\d\\d\u5e74|\\d{1,2}\u6708)");
    const sents = last
      .replace(/^#{1,6}.*$/gm, "")
      .replace(/[*`>\-\u2014\u3001]/g, "")
      .split(/[\u3002\uff01\uff1f\n]/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length >= 10 && x.length <= 60; });
    const strong = sents.filter(function (x) { return CONCLUSIVE.test(x) && evid.test(x); });
    return (strong.length ? strong : sents).slice(0, 5);
  }

  function claimsBlock(claims) {
    if (!claims || !claims.length) return "";
    return "\n\u3010\ud83d\udd01 \u4f60\u4e0a\u4e00\u8f6e\u5df2\u7ecf\u4e0b\u8fc7\u8fd9\u51e0\u4e2a\u5224\u65ad\uff08\u7528\u6237\u521a\u770b\u5b8c\uff09\u3011\n" +
      claims.map(function (c, i) { return "  " + (i + 1) + ". " + c; }).join("\n") +
      "\n  \u2757 \u4e0d\u8bb8\u628a\u4e0a\u9762\u4efb\u4f55\u4e00\u6761\u6362\u4e2a\u8bf4\u6cd5\u518d\u8bf4\u4e00\u904d\uff0c\u4e5f\u4e0d\u8bb8\u5148\u590d\u8ff0\u4e00\u904d\u518d\u5f80\u4e0b\u8bb2\u3002\n" +
      "  \u672c\u8f6e\u8981\u4e48\u7ed9\u5168\u65b0\u7684\u5224\u65ad\uff0c\u8981\u4e48\u660e\u786e\u4fee\u6b63\uff0f\u63a8\u7ffb\u5176\u4e2d\u67d0\u4e00\u6761\u5e76\u8bf4\u6e05\u695a\u4e3a\u4ec0\u4e48\u3002\n";
  }

  // 上一轮是从哪个入口切进去的（用于强制换镜头）
  function lastFocusOf(history, mode) {
    const ais = (history || []).filter(function (h) { return h.role === "ai" || h.role === "assistant"; });
    if (!ais.length) return "";
    const last = String(ais[ais.length - 1].content || "");
    // 八字答案里未必出现十神名，再兼容一批柱位词
    const vocab = (mode === "bazi")
      ? GOD_VOCAB.concat(["\u65e5\u5143","\u6708\u4ee4","\u5e74\u67f1","\u6708\u67f1","\u65e5\u67f1","\u65f6\u67f1","\u5927\u8fd0"])
      : PALACE_VOCAB;
    const found = vocab.filter(function (w) { return last.indexOf(w) >= 0; })
                       .sort(function (x, y) { return last.indexOf(x) - last.indexOf(y); });
    return found.length ? found[0] : "";
  }

  function coveredBlock(cov) {
    if (!cov) return "";
    const L = [];
    if (cov.palaces.length) L.push("  · 已经分析过的宫位：" + cov.palaces.join("、"));
    if (cov.stars.length)   L.push("  · 已经点过的星曜：" + cov.stars.join("、"));
    if (cov.gods.length)    L.push("  · 已经讲过的十神：" + cov.gods.join("、"));
    if (cov.dates.length)   L.push("  · 已经给过的具体日期：" + cov.dates.join("、"));
    if (cov.years.length)   L.push("  · 已经提过的年份：" + cov.years.join("、"));
    if (!L.length) return "";
    return "\n【⛔ 这些你在本窗口已经讲过了，不许再讲第二遍】\n" + L.join("\n") +
           "\n  上面这些内容用户已经看过。要用到就一句话带过（例如「还是那个 11 月的节点」），" +
           "把篇幅全部让给这个新问题带来的新东西。\n";
  }

  function buildSystemPrompt(chart, question, kbMode = "ziwei", ctx = {}) {
    ctx = ctx || {};
    const mode = kbMode === "bazi" ? "bazi" : "ziwei";
    const t = getCurrentTimeAnchor();
    const age = t.Y - chart.profile.year + 1;

    // 严格隔离两套知识库（仅作为AI内部推演的底层依据，严禁向用户展示引文）
    let kbBlock = "";
    if (mode === "ziwei" && global.ZiweiKBRetriever) {
      // 把本题锁定的宫位一并传进去 —— 以前检索器只看关键词，
      // 问事业也会先塞一堆夫妻宫断语，真正相关的反而被预算砍掉。
      let _focusPal = "";
      try { _focusPal = resolveDomainAndPalace(question || "", chart).palName || ""; } catch (e) {}
      const hits = global.ZiweiKBRetriever.retrieve(chart, question || "", 2800, _focusPal);
      if (hits.length) {
        kbBlock =
`\n════════ 【内部底层推演依据：紫微斗数知识库（仅供你内部推理遵循，严禁在回答中展示引文或书名）】 ════════
${global.ZiweiKBRetriever.toPromptBlock(hits)}
════════════════════════════════════════════════════════════════════════════════════════
`;
      }
    }

    let baziKbBlock = "";
    if (mode === "bazi" && global.BaziKBRetriever && chart.bazi && chart.bazi.detail) {
      const res = global.BaziKBRetriever.retrieve(
        chart.bazi.detail, question || "", chart.profile.gender);
      const blk = global.BaziKBRetriever.toPromptBlock(res, 2400);
      if (blk) {
        baziKbBlock =
`\n════════ 【内部底层推演依据：子平八字知识库（仅供你内部推理遵循，严禁在回答中展示引文或书名）】 ════════
${blk}
════════════════════════════════════════════════════════════════════════════════════════
`;
      }
    }

    const roomIdentity = mode === "ziwei"
      ? `你是【🔮 紫微斗数专席】的分析师。100% 基于下方紫微十二宫实盘推演，内部遵循检索到的紫微规则。

【本席的职责边界 —— 这决定了你和隔壁八字席的区别，必须守住】
紫微斗数是「宫位 + 星曜」的体系，它的长处是把事情讲**具体**：
  ✅ 你要交付的是：**人、场景、事象**。
     —— 这件事会以什么方式发生、由谁引动、对方是个什么样的人（气质／行业感／年龄差／性格）、
        会在什么场合遇到、卡点具体卡在哪一环、什么星飞进来把它带动起来。
  ✅ 判断一律落在：具体宫位 + 具体星曜 + 庙旺 + 四化飞入 + 三方四正的牵制。
  ❌ 严禁越界：不要谈五行喜忌、用神、身强身弱、调候、补什么颜色／方位／行业、大运。
     那些是隔壁八字席的活，你讲了就和它重复了，用户会觉得两个窗口没区别。
  ❌ 不要写成"五行生克"式的道理，要写成**画面**。`
      : `你是【📜 四柱八字专席】的子平分析师。100% 基于下方四柱实盘推演，内部遵循检索到的八字规则。

【本席的职责边界 —— 这决定了你和隔壁紫微席的区别，必须守住】
子平八字是「五行 + 十神」的能量体系，它的长处是讲**格局与方向**：
  ✅ 你要交付的是：**这个人是什么料、什么对他有利、这十年是顺是逆**。
     —— 日元旺衰与格局层次、喜用忌神、有利的五行对应的方位／行业／该靠近什么样的人、
        十神结构决定的行为驱动（为什么他总这么选）、大运十年的顺逆与换运转折。
  ✅ 判断一律落在：具体干支柱 + 十神 + 藏干 + 旺衰喜忌 + 冲合刑害 + 大运流年。
  ❌ 严禁越界：不要出现「宫位」「命宫」「夫妻宫」「星曜」「紫微／天府／贪狼」等星名、
     「四化」「大限」「三方四正」等紫微概念。那是隔壁紫微席的活。
  ❌ 不要去描写"对方长什么样、在哪认识的"这类具体人物画像 —— 那是紫微的强项，不是你的。`;

    const timeBase = `\`> 🕒 推演时间基准：公历${t.solarDateOnly}（${t.lunarStr} · ${t.yPillar}年${t.mPillar}月${t.dPillar}日）\``;
    const commonTiming =
`- 时间窗口**只讲最关键的 2 个**（多了就是报菜名）。每个写成：
  「几月到几月（带公历起讫） ＋ 这段时间你会遇到什么 ＋ 该做什么」。
  被什么引动的，收进〔〕依据句里一句话带过；除非那个原因会改变用户的动作，否则不必展开。
- 月份与干支必须照抄【🧮 预推演台】，不许自己心算。
- 只给「今年年底」「明年」这种粗颗粒＝不合格。

【⚖️ 应期的精度红线 —— 这条比「讲得细」更重要】
- **应期的默认粒度是「月」**（节气月，带公历起讫日）。这是命理本身能支撑的极限。
- 只有当盘上真有**硬引动**（流月冲动本题宫、四化飞入本题宫、流月干支合冲用神或忌神）时，
  才可以收窄到**「上旬 / 中旬 / 下旬」**，而且必须把那个引动写出来。
- ❌ **禁止直接断到某一天**（例如「11 月 9 日之前要表态」）。
  命盘给不出这个精度，写出来就是编的。预推演台里的公历日期是**节气月的起讫边界**，
  用途是告诉你「这个月从哪天算到哪天」，**不是让你把那一天当成应期。**
- ✅ 正确：「公历 11 月 7 日入己亥月，这个月是窗口；其中中旬最重，因为……」
- ❌ 错误：「11 月 9 日之前必须定下来」
- 未来三年若有明显转折年，直接点名是哪一年、因为什么。`;

    const turn = ctx.turn || 1;
    const followUp = turn > 1;
    const fullSpec = mode === "ziwei" ?
`### 🎯 一、直断
- 第一行：${timeBase}
- 接着 2–3 句大白话把话说死：这件事成不成、卡在哪、哪个月见分晓。

### 🔭 二、宫位怎么演：人、场景、事象
- 先用大白话讲清这个宫位呈现的是什么「象」；宫干支、主星、庙旺、四化收进〔〕依据句里。
- **必须落到具体的人和画面**：对方大概是什么类型的人（气质、行业感、年龄差、性格短板）、
  这件事一般以什么方式发生（谁牵的线、什么场合、什么导火索）、你自己在其中惯性的动作是什么。
  这一段是紫微的看家本事，写不出画面就是失败。
- 点出三方四正的拉扯：对宫在扯什么后腿、三合位能补上什么。
- **必须用上推演台的【宫干飞化】与【宫干自化】**。只讲生年四化＝只看了一半，是外行做法：
  · 先看【谁化忌飞入本题宫】—— 问题的真正来源常常不在本宫，而在那个把忌飞进来的宫（是那件事在消耗这件事）。若有，这一条要比本宫星曜先讲。
  · 再看【本题宫干化忌飞去哪】—— 那是你自己放不下、主动往里投、也最容易在那儿栽跟头的地方。
  · 本题宫若有**自化**，必须点破「留不住／白忙／做了等于没做」这一层。自化和生年四化方向相反，讲反了就是硬伤。
  · ❌ 不许把「X宫化忌入Y宫」原样抄一遍了事，必须翻译成一句人话的事象（谁、在什么事上、怎么消耗你）。
- ❌ 这一段里不许出现五行喜忌、用神、身强身弱、该穿什么颜色 —— 那是隔壁的活。

### 📅 三、引动点：大限 / 流年 / 流月
${commonTiming}
- （内部推理用）自己要清楚是哪颗星飞进哪个宫把它带起来的，但写给用户时收进〔〕里一句话带过。
- 最后给 2 条能照做的动作（写清什么时间、对谁、做什么）。禁止“多沟通”“提升自我”这类空话。`
    :
`### 🎯 一、直断
- 第一行：${timeBase}
- 接着 2–3 句大白话把话说死：这件事成不成、卡在哪、哪一年见分晓。

### ⚖️ 二、格局与喜忌：你是什么料，什么对你有利
- **第一句必须先落格局，但要说成人话**：他是什么料、适合走哪条路、这条路现在是通的还是堵的。
  格局名（正财格／阳刃格之类）收进〔〕依据句，不要拿它当句子的主语。
  格局是骨架，旺衰只是力气大小 —— **顺序反了就是本末倒置**。
  · 成格的，要说清是靠哪个字成的（相神）、这个字怕什么；
  · 破格的，要说清破在哪一个字上、以及大运里哪一步能补回来。
  · 推演台若标了「疑似从格／专旺」，你必须正面回应：要么确认、要么否定并说明理由。
    这一条判反，整篇的喜忌全是反的。
- 旺衰用**一句人话**说清就够了（有劲／没劲／刚刚好，以及这意味着他能扛多少事），
  得令／通根／透干这些依据收进〔〕里一句话带过，**不要摊开讲**。
  如果你复核后不同意推演台那个打分，在心里改过来按你的判断写，不必向用户解释这个分歧。
- 再给**喜用神与忌神**，然后翻译成能落地的东西：有利的五行 → 该往哪个方位走、
  适合什么性质的工作、该多接触什么样的人、什么环境会消耗你。调候若更急，优先讲调候。
- 用**十神结构**解释他做决定的底层驱动：为什么总是这么选、这种驱动在这件事上会带来什么后果。
- **下面这几条是你推理时必须想到的，不是要你写出来**（写出来就违反说人话铁律）：
  · 「合而不化」＝那个十神被绊住、作用打折，人事上是被人拉扯、决断变慢 —— 这经常就是他卡住的真正原因。
  · 「真化」＝性质真的转成化神那一行，喜忌必须按新五行重算，不能还照原来的十神讲。
  · **日元被合要单独点出来**（尤其被财、被官合）：那是「他被谁牵着走」，比任何地支关系都更贴身。
- ❌ 这一段里不许出现宫位、星曜、四化 —— 那是隔壁的活。

### 🌊 三、大运与流年的顺逆
- 先定调：**当前大运**对日元是帮还是耗（运干十神＋运支与原局的冲合），这十年整体顺不顺，现在走到第几年。
- 再说**下一步大运**哪一年换、是往上走还是往下走，换运前后要准备什么。
${commonTiming}
- （内部推理用，不要写进回答）一个字上同时挂多个关系时，自己先判断哪个主导，只按主导的那个下结论；
  标了「拱」的是虚局力弱，只能当辅助线索，不许当成合局下结论。
- 最后给 2 条趋避动作，必须带上喜用五行对应的具体做法（方位／行业／该找什么人／避开什么）。
  禁止“多沟通”“提升自我”这类空话。`;

    // 同一个窗口里的第 2 句话开始，就不要再把命盘从头介绍一遍了 ——
    // 这是用户反馈「一直出现重复的内容、反复强调」的根因。
    const followSpec =
`【本窗口第 ${turn} 轮 · 追问模式】
用户已经看过你对这张盘的完整分析了，他现在问的是一个新问题，不是让你复述。
- ❌ **不要**再写「🕒 推演时间基准」那一行。
- ❌ **不要**再用三段式标题（一、二、三），直接说人话。
- ❌ **不要**重新介绍这张盘的总体格局${mode === "ziwei" ? "（命宫、主星、整体性格）" : "（日元旺衰、喜用忌神、格局层次）"} ——
     除非用户这次问的正好就是这个。
- ❌ **不要**把上几轮点过的时间窗口再抄一遍。
- ✅ 只回答**这个新问题**，只讲它带来的**新东西**：新的${mode === "ziwei" ? "宫位、星曜、四化" : "干支、十神、冲合"}、新的角度、新的结论。
- ✅ 开门见山第一句就给答案，然后讲依据，最后给 1 条能照做的动作。
- ✅ 如果这个问题的答案和上一轮其实是同一件事，就**直接说「这个和刚才那个是同一回事」并只补充增量**，不要硬凑篇幅。
${ctx.lastFocus
  ? "- \ud83d\udd04 **换个镜头**：上一轮你是从【" + ctx.lastFocus + "】切进去的。这一轮如果问题还落在同一块，\n" +
    "     必须换一个入口（" + (mode === "ziwei" ? "三方四正的另一宫、或大限四化飞入的那一宫" : "另一柱、另一个十神、或下一步大运") + "），\n" +
    "     不许站在同一个位置再讲一遍。"
  : ""}`;

    // 追问预判：这一行会被前端拆成按钮，不会原样显示给用户
    const nextSpec =
`【最后一行 · 追问预判（这是给用户点的按钮，不是正文）】
正文写完后另起一行，输出且只输出这一行，格式固定：
⟦NEXT⟧问题一｜问题二｜问题三
- 要猜中他**看完你这段话之后最想追着问的下一句**，让他觉得「对，我正想问这个」。
- 必须**紧扣你这次真的写了什么**：点名你提到过的那个具体${mode === "ziwei" ? "宫位／星曜／四化" : "干支／十神／大运"}、那个时间窗口、或那条建议。
  反例（拿掉你这段分析也成立，禁止）：“我的感情运势如何？”“我适合做什么工作？”
${mode === "ziwei"
  ? "  正例（接得上话）：“太阴化忌是不是没法避？”“借星的夫妻宫是不是永远靠不住？”"
  : "  正例（接得上话）：“伤官太重能不能用印来制？”“交下一步大运那年我该动吗？”"}
- 三条要岤开，不许是同一个问题的三种说法：
${mode === "ziwei"
  ? "  · 一条往**深**问：那颗星、那个四化为什么会造成这个局，能不能拆。\n" +
    "  · 一条往**实**问：你点的那个大限／流年月节点，到时候具体怎么做。\n" +
    "  · 一条往**旁**问：这事会牽到哪一宫（钱、工作、家里、身体、某个人）。"
  : "  · 一条往**深**问：那个十神／旺衰格局的根子在哪，能不能调。\n" +
    "  · 一条往**实**问：你点的那步大运／流年／节气月，落到行动上是什么。\n" +
    "  · 一条往**旁**问：喜用忌神连到的另一块（钱、行业、方位、身体、伙伴）。"}
- 每条 ≤ 18 字，第一人称，像真人打字那样口语，不要写成书面标题。
- ❌ 不许出现塔罗、抽牌、算卦。
- ❌ 不许问你上面已经答过的东西。
- ❌ 这一行不要加标题、不要解释、不要放进代码块、不要加粗。`;

    const sectionSpec = followUp ? followSpec : fullSpec;

    return `${roomIdentity}

════════ 【\u{1F310} 语言铁律 —— 最优先，先于下面一切规则】 ════════
全程只用简体中文，**包括你自己的思考／推演过程（reasoning）在内**。
这个产品会把你的思考过程直接展示给用户看，所以它不是草稿，是成品的一部分：
- 思考时不许切换成英文。哪怕只是内部推敲，也用中文想。
- 命理术语一律用中文本名：正官、七杀、化忌、大限、月令、用神。
  禁止写成 Officer Star / Transformation into Ji / Major Limit 之类的英文或音译。
- 不要出现 "Let me think" "First, " "The user is asking" 这类英文引导句。
- 数字、年份、干支照常写，不受此条限制。
════════════════════════════════════════════════════════════════════════════

════════ 【⏰ 当前真实绝对时间与天文历法基准（回答必须100%以此为准）】 ════════
- 当前公历时间：${t.solarStr}（北京时间）
- 当前农历日期：${t.lunarStr}
- 当前节气与四柱干支：流年【${t.yPillar}年】 · 流月【${t.mPillar}月（当前节气：${t.termName}）】 · 流日【${t.dPillar}日】 · 流时【${t.hPillar}时】
- 提问者当前实足虚岁：${age}岁（出生于公历 ${chart.profile.year}年${chart.profile.month}月${chart.profile.day}日）
- ⚠️ 本条系统提示里的出生数据与排盘结果是唯一权威来源。若对话历史里出现过不同的出生日期、时辰或四柱，说明用户已经改过命盘，一律以本条为准，并彻底丢弃历史中基于旧盘得出的任何结论。
⚠️ 绝对时间铁律：
1. 今天就是【公历 ${t.solarDateOnly}，${t.lunarStr}，${t.yPillar}年${t.mPillar}月${t.dPillar}日】！若问及日期，必须直接准确报出！
2. 分析流年、流月或近期趋势时，必须以【当前已经是 ${t.Y}年${t.M}月（${t.lunarStr}，${t.mPillar}月）】为时间起点！今年前八个月已过去，分析“接下来/近期/今年剩余时间”必须聚焦于【当下本月（${t.lMonthLabel}·${t.mPillar}月）及接下来的秋冬月份（农历九月戊戌、十月己亥、十一月庚子、十二月辛丑）与明年（${t.Y + 1}年）】！
════════════════════════════════════════════════════════════════════════════

════════ 本人真实排盘数据（天文历法精确排出，严禁篡改） ════════
${buildChartDossier(chart, mode)}
══════════════════════════════════════════════════════════════════
${buildForecastDesk(chart, question, mode, ctx)}${kbBlock}${baziKbBlock}${coveredBlock(ctx.covered)}${claimsBlock(ctx.claims)}

【绝对命令 · 表达风格与排版准则（违反即为严重错误）】
0. **中文到底**：正文与思考过程全程简体中文，不许夹英文句子或英文术语（见开头的语言铁律）。
1. **严禁展示任何古籍引用或书名**：
   - 用户明确要求：“回复当中我不需要知道引用了什么，这个是你需要知道的，不用展示给我”。
   - **严禁在回答中出现《紫微斗数全书》《穷通宝鉴》《渊海子平》《滴天髓》等任何书名！**
   - **严禁在回答中抄录任何文言文原句或写“根据古籍记载”、“已调取知识库”之类的话！**
   - 你必须把上方知识库里的命理规律**完全消化内化**，直接用**现代、通透、犀利、一针见血的大白话**告诉用户结论与原因！
2. **严禁使用装腔作势称谓与心理安慰废话**：
   - 严禁自称“师父/师傅/老夫”，不要称呼用户为“命主”，直接用第二人称“你”客观分析。
   - 不要任何心理铺垫开场白，开门见山直接给干货。
3. **本席的回答必须严格采用下面这套章节结构（和隔壁窗口不一样，别串）**：
${sectionSpec}
【\u{1F5E3} 说人话铁律 —— 全篇最高优先级，与下面任何规则冲突时以这条为准】
读你回答的人不懂命理。他要的是「我该怎么办」，不是一份干支解析报告。
1. **每个判断写成两句，顺序不许颠倒：**
   ① **结论句** —— 纯大白话，**一个术语都不许有**。
      干支、十神、宫位、星曜、庙旺、四化、神煞、格局名、十二长生、刑冲合会，
      这些词一个都不许出现在结论句里。不懂命理的人读完就能照着做决定。
   ② **依据句** —— 用〔〕括起来，**最多一句**，交代这是从盘上哪里看出来的。术语只准出现在这里。
   照这个样子写：
     **今年宜守。** 你今年的劲头会比平时大一截，容易把该谈的条件谈崩、该等的时机等不住。
     〔盘上：今年那股火跟你本命同一股又叠了一层，你本来就缺的那点水更不够用。〕
   ❌ 反面教材（现在就是这么写的，禁止再出现）：
     「你现在走乙卯运，运干乙为正印，运支卯与日支戌六合、与年支酉相冲。2026 丙午年，
       年干丙与日元丙并透，比肩力量叠加……」—— 这是抄表，不是分析。
2. **术语预算：整篇正文里不同的术语不超过 8 个**（同一个词重复只算一次）。
   超了就说明你在报菜名，删到只剩最能定案的那几个。
3. **〔〕依据句每段最多一条，全篇最多 4 条。** 没有依据句的段落是允许的、也是正常的。
4. **【\u{1F9EE} 预推演台】是你的工作底稿，不是给用户看的清单。**
   里面的打分、括号注释、以及"你若复核后不同意可以…"这类写给你的话，**一个字都不许出现在回答里**。
   不许把推演台按条翻译成段落 —— 那不叫分析，那叫抄表。
5. **色彩层默认不提**：神煞、十二长生、拱局、流派分歧、知识库出处 —— 默认一个字都不写。
   只有当它**真的改变了结论或改变了用户该做的动作**时才提，并且仍然照第 1 条的两句式写。

【❗具体性铁律】
1. **每一个判断背后都必须有具体盘面证据**（紫微席：宫位／星曜／庙旺／四化／飞入哪一宫；
   八字席：干支柱／十神／冲合刑害／大运流年）。
   但**证据是用来支撑结论的，不是用来填满句子的** —— 按上面【说人话铁律】收进〔〕依据句里。
   凡是拿掉盘面也照样成立的空话（例如"你感情上会有波折""要注意人际关系"），一律视为废话，禁止出现。
2. **禁止反问用户、禁止索要更多信息**。信息不足就按盘面分情况给结论，不要把问题抛回去。
3. **禁止免责式表达**：不要写“仅供参考”“命运掌握在自己手里”“具体还要看个人努力”。
4. **禁止空泛的正能量收尾**。最后一句必须是一个可执行动作或一个明确判断。
5. 上方【🧮 预推演台】的数据是精确排出来的，**你必须用，而且不能改**；不要自己另算流年流月，算错了就是硬伤。
6. **守住本席边界**。用户会同时开着另一个窗口用另一套体系问同一个问题；如果你越界去讲对方的内容，
   两边就会给出雷同的回答，这是本产品最严重的失败。宁可在本体系内挖深，也不要往外扩。
7. **同一件事只说一次 —— 这一条用户专门提过意见，违反了就是不合格**。
   - 各段之间严禁互相复述：第一段给结论，第二段给依据，第三段给时间与动作，**同一个论点不许出现两次**。
   - 不要"先预告再展开再总结"。没有总结段，讲完就停。
   - 写之前先想清楚：这段要说的东西，上面是不是已经说过了？说过就删掉，换新的说。
   - 同一个星曜／干支如果要在两处提到，第二处只写它带来的新结论，不要把它的含义再解释一遍。

8. **命理看不了的事，直说看不了 —— 这是对前面「禁止回避」的合法例外**。
   前面禁止反问、禁止免责，指的是「盘面明明能答却含糊其辞」，**不是让你硬编**。
   下面三类是红线，碰了就是事故：
   - ⏳ **寿元与生死**：「我能活多久」「我什么时候死」「我家人过得了这关吗」—— **一字不推。**
   - 🏥 **疾病诊断与治疗**：「我这是什么病」「要不要做手术」「能不能治好」—— **不允许给医学判断。**
     只能讲盘上的「哪个系统偏弱、哪段时间要多留意」，并明确说这替代不了看医生。
   - 🔏 **他人隐私与具体数字**：别人背着你干了什么、彩票号码、股票代码、考试分数、
     官司判决结果 —— **命盘里没有这些，不允许编。**
   遇到这三类，照这个格式走：先用**一句话**说清楚这个盘看不了（不要大段免责），
   紧接着**直接开始回答一个你真能看的相邻问题**，把篇幅全放在那上面。
   示例：「病能不能治好，盘上看不了，这得看医生。但你这两年的精力走势能看，说的是……」
   ❌ 不要写「建议咨询专业人士」就没下文了 —— 那等于没回答。

${followUp ? "篇幅 250–450 字，短而准。宁可短，也绝不重复已经说过的话。" : "篇幅 500–700 字。宁可少讲一个点，也不要把一个点翻来覆去说三遍，更不要为了凑字数去解释术语。"}全篇现代大白话，客观锋利，不掉书袋。

${nextSpec}`;
  }

  /* ---------- 7.2.5 上游请求：本地代理 或 浏览器直连（静态网站模式） ---------- */
  // 各服务商 OpenAI 兼容端点（与 server.py 保持一致）
  const PROVIDER_ENDPOINTS = {
    deepseek: ["https://api.deepseek.com/chat/completions", "deepseek-chat"],
    qwen:     ["https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen-plus"],
    zhipu:    ["https://open.bigmodel.cn/api/paas/v4/chat/completions", "glm-4-flash"],
    moonshot: ["https://api.moonshot.cn/v1/chat/completions", "moonshot-v1-8k"],
    doubao:   ["https://ark.cn-beijing.volces.com/api/v3/chat/completions", "doubao-pro-32k"],
    openai:   ["https://api.openai.com/v1/chat/completions", "gpt-4o-mini"]
  };

  // 是否存在本地 Python 代理（首次探测后缓存；纯静态部署时自动走浏览器直连）
  let _proxyAvailable = null;

  // 推理模型：会额外返回 reasoning_content（真正的思考过程），且不接受 temperature
  function isReasoningModel(model) {
    return /reasoner|reasoning|deepseek-r1|(^|[^a-z])r1([^a-z]|$)|qwq|-z1|thinking/i.test(String(model || ""));
  }

  /* ---------- 7.2b 超时、重试与可读的失败原因 ----------
   * 原来的 fetch 没有任何超时：上游一卡住，前端就无限转圈，直到浏览器自己放弃（Chrome 约 5 分钟）。
   * 实测国内访问 api.deepseek.com 会出现「TCP/TLS 握手时间逐次拉长，最后彻底超时」的退化，
   * 所以既要有超时，也要有一次自动重试 —— 第一次连不上、第二次就通的情况很常见。
   * ---------------------------------------------------- */
  const NET_HEAD_TIMEOUT  = 45000;   // 发出请求 → 拿到响应头
  const NET_STALL_TIMEOUT = 60000;   // 流式过程中两段数据之间允许的最长静默

  function hostOf(url) {
    try { return String(url).split("/")[2] || String(url); } catch (e) { return String(url); }
  }

  // 把浏览器那句一视同仁的 "Failed to fetch" 翻译成用户能据此行动的话
  function netError(e, url) {
    const host = hostOf(url);
    if (e && e.name === "AbortError") {
      return new Error("等了 " + Math.round(NET_HEAD_TIMEOUT / 1000) + " 秒，" + host +
        " 一直没有响应。稍后重试，或在「⚙ 设置」里换一个厂商。");
    }
    const msg = String((e && e.message) || e || "");
    if ((typeof TypeError !== "undefined" && e instanceof TypeError) || /fetch|network|load failed/i.test(msg)) {
      return new Error("连不上 " + host + "。这台设备到这家厂商的链路不通或不稳定 —— " +
        "先点「⚙ 设置 → 测试连接」看一眼，换一个厂商通常就好了。");
    }
    return (e instanceof Error) ? e : new Error(msg);
  }

  async function fetchWithTimeout(url, opts, ms) {
    if (typeof AbortController === "undefined") return fetch(url, opts);
    const ac = new AbortController();
    const timer = setTimeout(function () { ac.abort(); }, ms);
    try {
      // 注意：只在 await 结束（= 响应头到手）时清掉定时器，
      // 后面的流式读取由 readWithStall 单独看着，不受这个 abort 影响
      return await fetch(url, Object.assign({}, opts, { signal: ac.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  // 流式读取：两段数据之间静默太久就判定断线，而不是无限等下去
  function readWithStall(reader) {
    return new Promise(function (resolve, reject) {
      const t = setTimeout(function () {
        try { reader.cancel(); } catch (e) {}
        reject(new Error("接口中途断了：已经 " + Math.round(NET_STALL_TIMEOUT / 1000) + " 秒没收到新内容。"));
      }, NET_STALL_TIMEOUT);
      reader.read().then(
        function (r) { clearTimeout(t); resolve(r); },
        function (e) { clearTimeout(t); reject(e); }
      );
    });
  }

  /* 设置面板里的「测试连接」：发一个最小请求，把到底卡在哪一环如实报出来 */
  async function testConnection(config) {
    const cfg = Object.assign({}, config || {});
    if (cfg.apiKey && (!cfg.provider || cfg.provider === "builtin")) cfg.provider = "deepseek";
    const picked = buildUpstreamBody(cfg, []);
    const host = hostOf(picked.url);
    const key = (cfg.apiKey || "").trim();
    if (!key) return { ok: false, ms: 0, host: host, model: picked.model, detail: "还没填 API Key" };

    const body = { model: picked.model, messages: [{ role: "user", content: "ping" }], stream: false };
    if (!isReasoningModel(picked.model)) body.max_tokens = 4;   // 推理模型不吃这个参数

    const t0 = Date.now();
    try {
      const resp = await fetchWithTimeout(picked.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify(body)
      }, 20000);
      const ms = Date.now() - t0;
      if (resp.ok) return { ok: true, ms: ms, host: host, model: picked.model, detail: "通了" };
      let detail = "返回 " + resp.status;
      try {
        const j = await resp.json();
        const m = j && j.error && (j.error.message || (typeof j.error === "string" ? j.error : ""));
        if (m) detail += "，" + m;
      } catch (e) {}
      if (resp.status === 401) detail = "Key 无效或已过期（401）";
      if (resp.status === 402) detail = "余额不足（402）";
      return { ok: false, ms: ms, host: host, model: picked.model, detail: detail };
    } catch (e) {
      return { ok: false, ms: Date.now() - t0, host: host, model: picked.model,
               detail: netError(e, picked.url).message };
    }
  }

  function buildUpstreamBody(config, messages) {
    const prov = config.provider || "deepseek";
    const def = PROVIDER_ENDPOINTS[prov] || PROVIDER_ENDPOINTS.deepseek;
    const typed = (config.modelName || "").trim();
    let model = typed || def[1];
    // 打开「深度思考」且没手动指定模型时，自动换成该厂商的推理模型
    if (config.deepThink && !typed) {
      if (prov === "deepseek") model = "deepseek-reasoner";
      else if (prov === "qwen") model = "qwq-plus";
      else if (prov === "zhipu") model = "glm-z1-flash";
    }
    return {
      url: (config.apiEndpoint || "").trim() || def[0],
      model: model
    };
  }

  async function directFetch(config, messages, retried) {
    const { url, model } = buildUpstreamBody(config, messages);
    const key = (config.apiKey || "").trim();
    if (!key) throw new Error("尚未填写 API Key，请点击左下角「⚙ 设置」填入你的密钥。");

    let resp;
    try {
      resp = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key
        },
        body: JSON.stringify(
          isReasoningModel(model)
            ? { model, messages, stream: true }             // 推理模型不接受 temperature
            : { model, messages, temperature: 0.75, stream: true })
      }, NET_HEAD_TIMEOUT);
    } catch (e) {
      if (!retried) return directFetch(config, messages, true);   // 连接层失败，静默重试一次
      throw netError(e, url);
    }

    if (!resp.ok) {
      let msg = `模型接口返回 ${resp.status}`;
      try {
        const j = await resp.json();
        if (j.error) msg = (typeof j.error === "string") ? j.error : (j.error.message || msg);
      } catch (e) {}
      if (resp.status === 401) msg = "API Key 无效或已过期，请在「⚙ 设置」中重新填写。";
      if (resp.status === 402) msg = "账户余额不足，请先充值后再试。";
      throw new Error(msg);
    }
    return resp;
  }

  async function requestUpstream(config, messages) {
    // 已确认没有本地代理 → 直接走浏览器直连
    if (_proxyAvailable === false) return directFetch(config, messages);

    try {
      const picked = buildUpstreamBody(config, messages);
      const body = {
        provider: config.provider || "deepseek",
        apiKey: config.apiKey || "",
        model: picked.model,
        endpoint: config.apiEndpoint || "",
        messages,
        stream: true
      };
      if (!isReasoningModel(picked.model)) body.temperature = 0.75;
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      // 静态托管（GitHub Pages / Netlify 等）会返回 404/405 等，此时回退到直连
      if (resp.status === 404 || resp.status === 405 || resp.status === 501) {
        _proxyAvailable = false;
        return directFetch(config, messages);
      }

      _proxyAvailable = true;
      if (!resp.ok) {
        let msg = `接口返回 ${resp.status}`;
        try { const j = await resp.json(); if (j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      return resp;
    } catch (e) {
      // fetch 本身抛错（静态站点上 /api/chat 不存在或跨域）→ 回退直连
      if (_proxyAvailable === null) {
        _proxyAvailable = false;
        return directFetch(config, messages);
      }
      throw e;
    }
  }

  /* ---------- 7.3 流式调用 ---------- */
  /**
   * @param {Function} onDelta 每收到一段文本回调 (deltaText, fullTextSoFar)
   * @returns {Promise<string>} 完整回答
   */
  async function callLiveAPIStream(question, chart, history, config, onDelta, onReason) {
    const hist = history || [];
    const turn = hist.filter(function (h) { return h.role === "ai" || h.role === "assistant"; }).length + 1;
    const ctx = {
      turn: turn,
      covered: collectCovered(hist),
      claims: recentClaims(hist),
      lastFocus: lastFocusOf(hist, config.kbMode || "ziwei")
    };
    const messages = [{ role: "system", content: buildSystemPrompt(chart, question, config.kbMode || "ziwei", ctx) }];
    // 最近 3 轮对话（6 条），保留追问上下文
    history.slice(-6).forEach(function (h) {
      messages.push({
        role: (h.role === "ai" || h.role === "assistant") ? "assistant" : "user",
        content: String(h.content || "").slice(0, 2000)
      });
    });
    messages.push({ role: "user", content: question });

    const resp = await requestUpstream(config, messages);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "", full = "", reason = "", isDone = false;

    while (!isDone) {
      let chunk;
      try {
        chunk = await readWithStall(reader);
      } catch (e) {
        // 流中途断了：已经收到像样的一段就先交给用户，别整篇丢掉换成模板
        if (full.trim().length >= 200) {
          full += "\n\n> \u26a0\ufe0f 接口中途断开，上面是已经收到的部分。";
          if (onDelta) onDelta("", full);
          return full;
        }
        throw e;
      }
      const done = chunk.done, value = chunk.value;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();                      // 最后一行可能不完整，留到下轮
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") {
          isDone = true;
          break;
        }
        try {
          const j = JSON.parse(payload);
          const choice = j.choices && j.choices[0];
          const delta = choice && choice.delta;
          // DeepSeek / 多数兼容端点把思维链放在 reasoning_content
          const rPiece = delta && (delta.reasoning_content || delta.reasoning);
          if (rPiece) { reason += rPiece; if (onReason) onReason(rPiece, reason); }
          const piece = delta && delta.content;
          if (piece) { full += piece; if (onDelta) onDelta(piece, full); }
          if (choice && choice.finish_reason && choice.finish_reason !== "null") {
            isDone = true;
          }
        } catch (e) { /* 忽略心跳/空行 */ }
      }
    }
    try { await reader.cancel(); } catch (e) {}
    if (!full.trim()) throw new Error("模型返回了空内容");
    return full;
  }

  /* ---------- 7.4 非流式（备用） ---------- */
  async function callLiveAPI(question, chart, history, config) {
    return callLiveAPIStream(question, chart, history, config, null);
  }

  /* ---------- 7.6 出厂检查：模型有没有编干支 ----------
   * 预推演台已经把正确的干支算好喂进去了，但没有任何机制拦截模型写错。
   * 用户看到一个错干支，整篇的信任就没了 —— 所以回答收完后必须对一遍。
   */
  const GZ_PAT = "[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]";

  function auditAnswer(text, chart, mode) {
    const t = String(text || "");
    if (!t.trim() || !chart) return [];
    const b = chart.bazi || {};
    const p = chart.profile || {};
    const issues = [];
    const seen = {};
    // internal=true 的条目只用于内部质量监控，不显示给用户（避免界面出现元信息噪音）
    const add = function (kind, claim, actual, hint, internal) {
      if (!actual || claim === actual) return;
      const k = kind + "|" + claim;
      if (seen[k]) return;
      seen[k] = 1;
      issues.push({ kind: kind, claim: claim, actual: actual, hint: hint || "", internal: !!internal });
    };

    let m;

    /* ① 「2027年丁未」—— 公历年配错年干支 */
    const reYear = new RegExp("(20\\d\\d)\\s*年[\\s、，,（(的是为流岁干支【]{0,6}(" + GZ_PAT + ")", "g");
    while ((m = reYear.exec(t)) !== null) {
      const tail = t.charAt(m.index + m[0].length);
      if (tail === "月" || tail === "日" || tail === "时" || tail === "运") continue;  // 那是月柱/日柱/大运
      const y = parseInt(m[1], 10);
      add("year", m[1] + "年" + m[2], m[1] + "年" + yearGanZhi(y),
          "流年干支按公历年推，" + y + " 年是 " + yearGanZhi(y));
    }

    /* ② 「丁未年」单独出现 —— 找附近的公历年来校验 */
    const reGzY = new RegExp("(" + GZ_PAT + ")年", "g");
    while ((m = reGzY.exec(t)) !== null) {
      // 中文里几乎总是「2025 年是乙巳年」这个语序，所以**优先往前找最近的一个**。
      // 单纯比距离会出错：「2025年是乙巳年，2026年是丙午年」里，
      // 离「乙巳」最近的反而是后面那个 2026。
      let y = 0;
      const back = t.slice(Math.max(0, m.index - 20), m.index);
      const bs = back.match(/20\d\d/g);
      if (bs && bs.length) {
        y = parseInt(bs[bs.length - 1], 10);
      } else {
        const fwd = t.slice(m.index, m.index + 12).match(/20\d\d/);
        if (fwd) y = parseInt(fwd[0], 10);
      }
      if (!y) continue;
      const real = yearGanZhi(y);
      if (m[1] !== real) {
        add("year", m[1] + "年（文中指 " + y + "）", real + "年",
            y + " 年的流年干支是 " + real);
      }
    }

    /* ③ 四柱写错 */
    const POS = { "年": b.yearPillar, "月": b.monthPillar, "日": b.dayPillar, "时": b.hourPillar };
    const rePillar = new RegExp("(年|月|日|时)柱[是为：:【\\s]{0,3}(" + GZ_PAT + ")", "g");
    while ((m = rePillar.exec(t)) !== null) {
      const real = POS[m[1]];
      if (real) add("pillar", m[1] + "柱 " + m[2], m[1] + "柱 " + real, "本盘四柱不可更改");
    }

    /* ④ 日元写错 */
    const reDm = /日元[是为：:\s]{0,3}([甲乙丙丁戊己庚辛壬癸])/g;
    while ((m = reDm.exec(t)) !== null) {
      if (b.dayMaster && m[1] !== b.dayMaster) {
        add("daymaster", "日元" + m[1], "日元" + b.dayMaster, "日元就是日柱天干");
      }
    }

    /* ⑤ 大运干支不在本人的大运序列里（只查八字席） */
    if (mode === "bazi") {
      const dy = computeDayun(chart);
      if (dy && dy.list && dy.list.length) {
        const ok = {};
        dy.list.forEach(function (d) { ok[d.gz] = d; });
        const legal = dy.list.map(function (d) { return d.gz + "（" + d.fromAge + "-" + d.toAge + "岁）"; }).join("、");
        const reDy = new RegExp("(" + GZ_PAT + ")\\s*(?:大运|运)|大运[是为：:\\s]{0,3}(" + GZ_PAT + ")", "g");
        while ((m = reDy.exec(t)) !== null) {
          const gz = m[1] || m[2];
          if (gz && !ok[gz] && gz !== b.monthPillar) {
            add("dayun", gz + "大运", "不在你的大运序列里", "你的九步大运是：" + legal);
          }
        }
        /* ⑥ 大运岁数对不上 */
        const reAge = new RegExp("(" + GZ_PAT + ")\\s*(?:大)?运[^。；\\n]{0,10}?(\\d{1,2})\\s*[-–~至到]\\s*(\\d{1,2})\\s*岁", "g");
        while ((m = reAge.exec(t)) !== null) {
          const d = ok[m[1]];
          if (!d) continue;
          const a1 = parseInt(m[2], 10), a2 = parseInt(m[3], 10);
          if (a1 !== d.fromAge || a2 !== d.toAge) {
            add("dayunAge", m[1] + "运 " + a1 + "-" + a2 + "岁",
                m[1] + "运 " + d.fromAge + "-" + d.toAge + "岁",
                "起运 " + dy.startY + " 岁 " + dy.startM + " 个月，每十年一换");
          }
        }
      }
    }

    /* ⑦ 年龄写错 */
    const tAnchor = getCurrentTimeAnchor();
    const realAge = tAnchor.Y - p.year + 1;
    const reAgeNow = /(?:你今年|现在你|你现在|今年你)[^。；\n]{0,6}?(\d{1,3})\s*岁/g;
    while ((m = reAgeNow.exec(t)) !== null) {
      const n = parseInt(m[1], 10);
      if (n !== realAge && n !== realAge - 1) {
        add("age", "今年 " + n + " 岁", "今年 " + realAge + " 岁（虚岁）", "");
      }
    }

    /* ⑧ 紫微：星曜落宫说错 —— 这是紫微 AI 最高发的幻觉 */
    if (mode === "ziwei" && chart.ziwei && chart.ziwei.raw && chart.ziwei.raw.palaces) {
      const PZ = chart.ziwei.raw.palaces;
      const homeOf = {};
      PZ.forEach(function (pa) {
        (pa.mainStars || []).forEach(function (x) { homeOf[x.name] = pa.name; });
        (pa.auxStars  || []).forEach(function (x) { homeOf[x.name] = pa.name; });
      });
      const reStar = new RegExp("(" + STAR_VOCAB.join("|") + ")(?:星)?[】\\]]?\\s*(?:独)?(?:坐守|坐镇|坐|落在|落入|入驻|入|守|在)\\s*(?:于)?\\s*[【\\[]?(" +
                                PALACE_VOCAB.join("|") + ")[】\\]]?", "g");
      while ((m = reStar.exec(t)) !== null) {
        const star = m[1], said = m[2], real = homeOf[star];
        // 「对宫」「三合」「大限夫妻宫」这类说法是另一套坐标，不误报
        const pre = t.slice(Math.max(0, m.index - 9), m.index);
        if (/对宫|三合|三方|大限|流年|流月|借|会照|冲照/.test(pre)) continue;
        const mid = t.slice(m.index, m.index + m[0].length);
        if (/大限|流年|流月/.test(mid)) continue;
        if (!real) {
          add("starMissing", star, "本盘无此星", "这张盘里根本没有【" + star + "】，不能拿它下判断");
        } else if (real !== said) {
          add("starPalace", star + "在" + said, star + "在" + real, "本盘【" + star + "】坐【" + real + "】");
        }
      }
    }

    /* ⑨ 应期被断到「某一天」—— 命盘给不出这个精度 */
    const reDay = /(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(之前|以前|前后|左右|当天|当日|这天|那天|之后|以后)/g;
    while ((m = reDay.exec(t)) !== null) {
      add("dayPrecision", "「" + m[1] + "月" + m[2] + "日" + m[3] + "」这个精度", "靠不住",
          "命盘能支撑的应期上限是「月」，有硬引动时最多到上/中/下旬。精确到某一天是模型自己加的，别当真");
    }

    /* ⑩ 八字：旺衰讲反了（与扶抑打分矛盾） */
    if (mode === "bazi") {
      const st = baziStrength(chart);
      if (st && st.verdict) {
        const strongSide = (st.verdict === "身强" || st.verdict === "偏强");
        const weakSide   = (st.verdict === "身弱" || st.verdict === "偏弱");
        if (strongSide && /日元(?:偏)?(?:身)?弱|身弱|日主(?:偏)?弱/.test(t)) {
          add("strength", "说日元弱", "推演台判【" + st.verdict + "】",
              "帮扶度 " + st.score + "。你若真要推翻这个打分，必须写明理由，不能直接反着讲");
        }
        if (weakSide && /日元(?:偏)?(?:身)?强|身强|日主(?:偏)?强/.test(t)) {
          add("strength", "说日元强", "推演台判【" + st.verdict + "】",
              "帮扶度 " + st.score + "。你若真要推翻这个打分，必须写明理由，不能直接反着讲");
        }
      }
    }

    /* ⑪ 越界：两席串台是本产品最严重的失败（用户专门提过「两个窗口看着差不多」） */
    if (mode === "ziwei") {
      // 注意：「七杀」「贪狼」「破军」在紫微里是正经主星，绝不能当越界词
      const bad = ["用神", "忌神", "喜用", "身强", "身弱", "日元", "调候", "十神", "正官", "偏财", "正财", "食神", "伤官", "比肩", "劫财", "正印", "偏印"];
      for (let i = 0; i < bad.length; i++) {
        if (t.indexOf(bad[i]) >= 0) {
          add("crossTalk", "紫微席写了「" + bad[i] + "」", "这是八字席的概念",
              "两席串台会让两个窗口的回答雷同，这是本产品最严重的失败", true);
          break;
        }
      }
    } else if (mode === "bazi") {
      const bad2 = ["命宫", "夫妻宫", "官禄宫", "财帛宫", "迁移宫", "福德宫", "田宅宫", "疾厄宫",
                    "紫微", "天府", "贪狼", "破军", "七杀星", "化禄", "化忌", "大限", "三方四正"];
      for (let i = 0; i < bad2.length; i++) {
        if (t.indexOf(bad2[i]) >= 0) {
          add("crossTalk", "八字席写了「" + bad2[i] + "」", "这是紫微席的概念",
              "两席串台会让两个窗口的回答雷同，这是本产品最严重的失败", true);
          break;
        }
      }
    }

    return issues.slice(0, 6);
  }

  /* ---------- 7.5 追问预判：从回答末尾拆出 3 个按钮 ---------- */
  const NEXT_MARK = "\u27E6NEXT\u27E7";

  // 正文里把标记及其后面的内容切掉；
  // 流式输出时还要切掉「正在打一半的标记」，否则用户会看到 ⟦NE 这种乱码
  function stripNextBlock(s) {
    let t = String(s || "");
    const i = t.indexOf(NEXT_MARK);
    if (i >= 0) {
      t = t.slice(0, i);
    } else {
      const m = t.match(/\u27E6(?:N(?:E(?:X(?:T)?)?)?)?$/);
      if (m) t = t.slice(0, t.length - m[0].length);
    }
    // 模型偶尔会把这一行包进代码块，切完会剩一个孤零零的 ```
    return t.replace(/\s*`{3,}\s*$/, "").replace(/\s+$/, "");
  }

  function splitFollowups(s) {
    const t = String(s || "");
    const i = t.indexOf(NEXT_MARK);
    let list = [];
    if (i >= 0) {
      const raw = t.slice(i + NEXT_MARK.length).replace(/\u27E6\/?NEXT\u27E7/g, "");
      const seen = {};
      list = raw.split(/[\n|\uFF5C]/)
        .map(function (x) {
          return String(x)
            .replace(/^[\s\-\*\u00b7\u3001\d\.\)\uff09]+/, "")
            .replace(/[`*\u3010\u3011]/g, "")
            .trim();
        })
        .filter(function (x) {
          if (x.length < 4 || x.length > 30) return false;
          if (seen[x]) return false;
          seen[x] = 1;
          return true;
        })
        .slice(0, 3);
    }
    return { text: stripNextBlock(t), followups: list };
  }

  // 傅模型没听话或走内置引擎时的兼容方案：
  // 不再给预设的套话，而是从「刚才真的答了什么」里抽关键词拼出来
  const LATERAL = [
    [/\u94b1|\u8d22|\u6536\u5165|\u85aa/,        "\u8fd9\u4e8b\u4f1a\u5f71\u54cd\u6211\u7684\u94b1\u5417\uff1f"],
    [/\u5de5\u4f5c|\u4e8b\u4e1a|\u804c|\u516c\u53f8|\u8df3\u69fd/, "\u5de5\u4f5c\u4e0a\u63a5\u4e0b\u6765\u8981\u6ce8\u610f\u4ec0\u4e48\uff1f"],
    [/\u5bb6|\u7236\u6bcd|\u957f\u8f88|\u5a5a/,    "\u5bb6\u91cc\u4eba\u4f1a\u727d\u626f\u8fdb\u6765\u5417\uff1f"],
    [/\u8eab\u4f53|\u5065\u5eb7|\u75be\u5384|\u7761/, "\u8eab\u4f53\u4e0a\u6211\u8981\u7559\u610f\u4ec0\u4e48\uff1f"],
    [/\u4eba\u9645|\u670b\u53cb|\u5408\u4f5c|\u5c0f\u4eba/, "\u8eab\u8fb9\u4eba\u91cc\u8c01\u6700\u5f71\u54cd\u6211\uff1f"]
  ];

  function followupsFor(question, chart, answerText, kbMode) {
    const ans = String(answerText || "");
    // 旧调用方式（只传问题）：退回主题词表，但把已下线的塔罗选项滤掉
    if (!ans) {
      const intent = analyzeQuestion(question);
      return (FOLLOWUPS[intent.topic.id] || FOLLOWUPS.general)
        .filter(function (x) { return x.indexOf("\u5854\u7f57") < 0; });
    }
    const mode = kbMode === "bazi" ? "bazi" : "ziwei";
    // 按在回答里出现的先后排，而不是按词表顺序 ——
    // 最先被点名的那个才是这段回答的主角，追问应该盯住它
    const hit = function (vocab) {
      return vocab.filter(function (w) { return ans.indexOf(w) >= 0; })
                  .sort(function (x, y) { return ans.indexOf(x) - ans.indexOf(y); });
    };
    const pals = hit(PALACE_VOCAB), stars = hit(STAR_VOCAB), gods = hit(GOD_VOCAB);
    const uniq = function (a) {
      const o = {}, r = [];
      (a || []).forEach(function (x) { const k = String(x).replace(/\s/g, ""); if (!o[k]) { o[k] = 1; r.push(k); } });
      return r;
    };
    const years  = uniq(ans.match(/20\d{2}\s*\u5e74/g));
    const months = uniq(ans.match(/\d{1,2}\s*\u6708/g));

    const out = [];
    const push = function (x) { if (x && out.indexOf(x) < 0 && out.length < 3) out.push(x); };

    // ① 往深：盯住它刚点名的那颗星／那个十神
    if (mode === "ziwei" && stars.length) push(stars[0] + "\u7684\u5f71\u54cd\u80fd\u538b\u4e0b\u53bb\u5417\uff1f");
    else if (mode === "bazi" && gods.length) push(gods[0] + "\u91cd\uff0c\u5230\u5e95\u662f\u597d\u662f\u574f\uff1f");
    else if (pals.length) push(pals[0] + "\u4e3a\u4ec0\u4e48\u4f1a\u662f\u8fd9\u4e2a\u5c40\uff1f");
    else push("\u8fd9\u4e2a\u7ed3\u8bba\u7684\u6839\u5b50\u5230\u5e95\u5728\u54ea\uff1f");

    // ② 往实：扣住它给的时间窗口
    if (years.length)       push(years[0] + "\u90a3\u4e2a\u8282\u70b9\u6211\u5177\u4f53\u8be5\u505a\u4ec0\u4e48\uff1f");
    else if (months.length) push(months[0] + "\u4e4b\u524d\u6211\u8981\u5148\u51c6\u5907\u4ec0\u4e48\uff1f");
    else                    push("\u8fd9\u4e8b\u5927\u6982\u4ec0\u4e48\u65f6\u5019\u4f1a\u52a8\uff1f");

    // ③ 往旁：挑一个它这次没讲到的方向
    for (let i = 0; i < LATERAL.length && out.length < 3; i++) {
      if (!LATERAL[i][0].test(ans)) push(LATERAL[i][1]);
    }
    push("\u8fd9\u4e24\u5e74\u6574\u4f53\u662f\u5f80\u4e0a\u8fd8\u662f\u5f80\u4e0b\uff1f");
    return out;
  }

  global.ChatEngine = {
    generateChatResponse, composeAnswer, analyzeQuestion, TOPICS,
    callLiveAPI, callLiveAPIStream, buildSystemPrompt, buildChartDossier,
    followupsFor, splitFollowups, stripNextBlock,
    auditAnswer,
    collectCovered, recentClaims, lastFocusOf,   // 供测试与调试使用
    buildReasoningSteps, buildThinkingNotes, getCurrentTimeAnchor,
    testConnection,                             // 设置面板的「测试连接」
    derivePattern, baziStrength                 // 供入口卡片写「这是你的盘」副标题
  };
})(typeof window !== "undefined" ? window : global);
