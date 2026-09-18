// 点到 - 塔罗牌库及感情婚恋深度解析数据
const TAROT_DATA = [
  {
    id: "fool",
    num: 0,
    name: "愚人",
    enName: "The Fool",
    suit: "major",
    element: "风",
    icon: "🎒",
    symbol: "🌀",
    color: "#64b5f6",
    keywords: {
      upright: ["新的开端", "纯真热烈", "一见钟情", "不问结果的爱"],
      reversed: ["冲动盲目", "承诺缺失", "缺乏责任感", "短暂露水情缘"]
    },
    love_upright: "一段全新的感情即将开启，或者现有关系将迎来轻松愉快的崭新起点。你们之间的吸引力源于最纯粹的好奇与心动，适合放下一切过往的包袱，享受当下的快乐。",
    love_reversed: "恋爱中可能存在不切实际的幻想，或是对方在感情上逃避现实、不愿给予稳定的长远承诺。盲目投入可能会导致情绪受伤，需保持三分理智。",
    advice: "跟随直觉勇敢迈出第一步，但切记在奔赴浪漫时，不要彻底忽视现实基础。",
    matchScore: 85
  },
  {
    id: "magician",
    num: 1,
    name: "魔术师",
    enName: "The Magician",
    suit: "major",
    element: "风",
    icon: "🪄",
    symbol: "♾️",
    color: "#ba68c8",
    keywords: {
      upright: ["魅力四射", "主动出击", "沟通无碍", "掌握爱情主导权"],
      reversed: ["甜言蜜语", "套路欺骗", "沟通不畅", "虚荣假象"]
    },
    love_upright: "你或对方目前散发着极强的吸引力，能够用智慧和言辞轻松化解隔阂。这是一个极具创造力和推动力的时期，只要主动出击，关系就会迅速升温。",
    love_reversed: "需要警惕关系中是否存在“画大饼”、言行不一或套路多于真心的情况。小心被表面的浪漫表象蒙蔽，沟通中存在隐瞒或误导。",
    advice: "真诚是最好的必杀技。用你的智慧去经营关系，而不是依赖算计与套路。",
    matchScore: 92
  },
  {
    id: "high_priestess",
    num: 2,
    name: "女祭司",
    enName: "The High Priestess",
    suit: "major",
    element: "水",
    icon: "🌙",
    symbol: "✨",
    color: "#4dd0e1",
    keywords: {
      upright: ["灵魂共鸣", "直觉敏锐", "被动克制", "精神吸引"],
      reversed: ["内心情感压抑", "冷暴力", "疑心病", "看不透的秘密"]
    },
    love_upright: "两人之间有着强烈的直觉感应与精神共振，但感情往往内敛、含蓄、不显于形。适合慢下来倾听彼此内心深处的声音，属于细水长流的心有灵犀。",
    love_reversed: "内心的猜忌与情感阻隔正在蔓延。有人把心事深藏，拒绝坦诚沟通，甚至演变成无声的冷战。也可能暗示关系中潜藏着尚未公开的秘密。",
    advice: "相信你的第一第六感，但不要用沉默筑起高墙，试着给爱一个流淌的出口。",
    matchScore: 80
  },
  {
    id: "empress",
    num: 3,
    name: "女皇",
    enName: "The Empress",
    suit: "major",
    element: "土",
    icon: "👑",
    symbol: "♀",
    color: "#81c784",
    keywords: {
      upright: ["丰饶圆满", "母性包容", "婚姻美满", "享受被爱与滋养"],
      reversed: ["过度控制", "溺爱窒息", "缺乏安全感", "家庭阻力"]
    },
    love_upright: "象征着无条件的爱、呵护与丰盛的情感回馈。恋爱中充满温馨与体贴，非常有利于走向订婚、结婚或迎来家庭新成员，是感情步入成熟收获期的吉兆。",
    love_reversed: "可能在感情中扮演了“过度付出”或“过分索求”的角色，给彼此造成了窒息的心理压力。或是过于沉溺物质享受而忽略了心灵的平等契合。",
    advice: "在爱别人之前先充分爱自己。学会享受美好，但也给予彼此适度自由的空间。",
    matchScore: 96
  },
  {
    id: "emperor",
    num: 4,
    name: "皇帝",
    enName: "The Emperor",
    suit: "major",
    element: "火",
    icon: "🏰",
    symbol: "♈",
    color: "#e57373",
    keywords: {
      upright: ["踏实可靠", "责任担当", "稳定基石", "传统婚姻长久"],
      reversed: ["大男子主义", "固执专断", "情感冷漠", "掌控欲过强"]
    },
    love_upright: "感情关系非常稳固、有担当。对方通常是成熟、有事业心且能遮风挡雨的依靠。虽然缺少一点花哨的浪漫，但能给你实打实的安全感与未来保障。",
    love_reversed: "关系里存在明显的权力失衡，一方可能过于强势霸道，习惯发号施令，缺少温情互动，让另一方感到被压抑与不被尊重。",
    advice: "坚固的关系需要规则，更需要温情。适当放下控制欲，试着用温柔打破僵局。",
    matchScore: 88
  },
  {
    id: "hierophant",
    num: 5,
    name: "教皇",
    enName: "The Hierophant",
    suit: "major",
    element: "土",
    icon: "🕊️",
    symbol: "🗝️",
    color: "#ffb74d",
    keywords: {
      upright: ["长辈祝福", "明媒正娶", "三观相契", "道德准则与誓约"],
      reversed: ["世俗反对", "教条束缚", "貌合神离", "不被认可的关系"]
    },
    love_upright: "一段受到社会世俗认可与亲友祝福的正缘良配。双方三观一致，彼此尊重，极有希望携手步入合法受保护的婚姻殿堂，亦可能有良师益友撮合相助。",
    love_reversed: "可能面临来自家庭观念、传统伦理或世俗门第的巨大压力；或是两个人表面相敬如宾，实际上内心早已失去火花，仅靠外界眼光维系。",
    advice: "遵循内心的良知与承诺，遇到分歧时，寻求德高望重的朋友或专业长辈的指引。",
    matchScore: 90
  },
  {
    id: "lovers",
    num: 6,
    name: "恋人",
    enName: "The Lovers",
    suit: "major",
    element: "风",
    icon: "💖",
    symbol: "♊",
    color: "#f06292",
    keywords: {
      upright: ["天赐良缘", "心意相通", "甜蜜结合", "重大爱的抉择"],
      reversed: ["面临诱惑", "选择困难", "价值冲突", "三角关系危机"]
    },
    love_upright: "感情占卜中最吉利的大牌之一！代表着灵魂深处的高度默契、激情与忠诚的完美结合。不仅是相互吸引，更是人生路上并肩作战的真正伴侣。",
    love_reversed: "面临感情上的严峻十字路口——例如在两个追求者间徘徊、在现实与爱情中撕扯，或是外界诱惑正在动摇原本的忠诚底线。",
    advice: "真正的爱情不仅是心跳的感觉，更是在诱惑面前依然坚定选择彼此的责任。",
    matchScore: 99
  },
  {
    id: "chariot",
    num: 7,
    name: "战车",
    enName: "The Chariot",
    suit: "major",
    element: "水",
    icon: "🛡️",
    symbol: "♋",
    color: "#4fc3f7",
    keywords: {
      upright: ["克服阻碍", "坚定追寻", "感情大迈进", "排除万难在一起"],
      reversed: ["失控冲突", "情绪暴躁", "方向迷失", "两败俱伤"]
    },
    love_upright: "感情正处于高速推进阶段。无论目前有异地、家庭反对还是现实差距，只要两人心意坚定，凭借强大的意志力和行动力，就能冲破一切险阻迎来胜利。",
    love_reversed: "双方脾气火爆，互不相让，争吵容易升级导致关系失控；或是用力过猛，在错误的方向上一味强求，反而让彼此精疲力竭。",
    advice: "缰绳在你的手中。控制好情绪的双轮，既要有冲破难关的勇气，也要懂得适时减速。",
    matchScore: 84
  },
  {
    id: "strength",
    num: 8,
    name: "力量",
    enName: "Strength",
    suit: "major",
    element: "火",
    icon: "🦁",
    symbol: "♌",
    color: "#ff8a65",
    keywords: {
      upright: ["以柔克刚", "坚定包容", "深层驯服", "用爱化解戾气"],
      reversed: ["软弱妥协", "失去耐心", "情绪失控", "内耗自卑"]
    },
    love_upright: "真正的力量在于温柔与耐心。你或对方能够用无限的包容与理解，抚平对方内心的创伤与不安。这段关系能够让你变得更加坚强自信，彼此成就。",
    love_reversed: "对这段关系感到力不从心，在对方的坏脾气或冷淡面前逐渐耗尽了耐心；也可能因自我怀疑而过度妥协让步，失去了自我尊严。",
    advice: "不要试图硬碰硬。温柔而坚定的态度才是化解一切坚冰的唯一密码。",
    matchScore: 91
  },
  {
    id: "hermit",
    num: 9,
    name: "隐士",
    enName: "The Hermit",
    suit: "major",
    element: "土",
    icon: "🏮",
    symbol: "♍",
    color: "#aed581",
    keywords: {
      upright: ["独处沉淀", "看清真心", "慢热深情", "精神探索期"],
      reversed: ["孤立隔绝", "拒绝沟通", "自怨自艾", "逃避现实感情"]
    },
    love_upright: "目前可能处于感情的冷静期或寻觅真我的阶段。对于单身者，需要先理清自己真正需要什么样的伴侣；对于有伴侣者，适合给予彼此安静思考的空间，不宜步步紧逼。",
    love_reversed: "把自己封闭在内心的孤岛上，用冷漠阻挡别人的善意靠近。过度挑剔与防御机制，可能会让你错失原本真挚的缘分。",
    advice: "提灯照亮自己的内心。唯有先找回完整的自己，才能吸引那个与你灵魂同频的人。",
    matchScore: 72
  },
  {
    id: "wheel_of_fortune",
    num: 10,
    name: "命运之轮",
    enName: "Wheel of Fortune",
    suit: "major",
    element: "火",
    icon: "☸️",
    symbol: "✡️",
    color: "#ffd54f",
    keywords: {
      upright: ["命中注定", "峰回路转", "转角遇爱", "宿命般的邂逅"],
      reversed: ["时机未到", "反复拉扯", "运势低谷", "抗拒命运变化"]
    },
    love_upright: "命运的齿轮已经悄然转动！感情将迎来重大转机，极有可能经历意料之外的戏剧性进展（如突如其来的表白、命中注定的相遇或冰释前嫌的契机）。顺应这股顺风吧！",
    love_reversed: "事情的发展似乎总是阴差阳错，明明有缘却总是碰不上对的时机。当下不宜强行推进重要决定，静待运气回暖方为上策。",
    advice: "接受无常，抓住每一个微妙的巧合。属于你的缘分，终将在最恰当的时刻到来。",
    matchScore: 95
  },
  {
    id: "justice",
    num: 11,
    name: "正义",
    enName: "Justice",
    suit: "major",
    element: "风",
    icon: "⚖️",
    symbol: "♎",
    color: "#90caf9",
    keywords: {
      upright: ["公平对等", "理性衡量", "法定契约", "因果报应清晰"],
      reversed: ["失衡计较", "偏见冷酷", "法律纠纷", "付出得不到回报"]
    },
    love_upright: "追求绝对平等与相互尊重的健康关系。两人付出与索取相当，没有谁委屈附和。有利于涉及民政登记、婚前协议、明确未来共同权责等重大契约事务。",
    love_reversed: "关系天平严重倾斜，有人总在暗暗计算谁付出更多谁亏了，甚至因现实利益产生尖锐纠纷。冷酷的理性往往会刺伤柔软的真心。",
    advice: "感情不能像做买卖一样斤斤计较。用诚实公正对待彼此，给彼此一份心安理得。",
    matchScore: 82
  },
  {
    id: "hanged_man",
    num: 12,
    name: "倒吊人",
    enName: "The Hanged Man",
    suit: "major",
    element: "水",
    icon: "🧘",
    symbol: "⚓",
    color: "#80cbc4",
    keywords: {
      upright: ["换位思考", "甘愿付出", "沉潜等待", "打破旧有执念"],
      reversed: ["无谓牺牲", "作茧自缚", "自我感动", "陷入死循环"]
    },
    love_upright: "虽然当下的感情看似陷入停滞或等待，但这是一种充满智慧的沉淀。换一个角度看待对方的缺点或当下的困局，你会发现意想不到的顿悟与转机。",
    love_reversed: "陷入了不健康的“圣母/受害者”情结，明知对方不珍惜却依然盲目付出、感动自己。这种无意义的自我牺牲只会让关系愈发廉价。",
    advice: "悬挂不是终点，而是换个视角看世界。停止无底线的退让，重新拿回自己的重心。",
    matchScore: 75
  },
  {
    id: "death",
    num: 13,
    name: "死神",
    enName: "Death",
    suit: "major",
    element: "水",
    icon: "🥀",
    symbol: "♏",
    color: "#b0bec5",
    keywords: {
      upright: ["告别过去", "彻底蜕变", "斩断孽缘", "置之死地而后生"],
      reversed: ["拖泥带水", "执念不化", "抗拒放手", "消耗式苟延残喘"]
    },
    love_upright: "旧的篇章必须彻底翻过去，新的生命才能破土而出。一段病态、痛苦或早已名存实亡的关系即将迎来终结；或是你们两人的相处模式将迎来脱胎换骨的根本性转变。",
    love_reversed: "明明知道无法挽回，却依然死抓着执念不肯松手。沉溺在过期的回忆中自我折磨，只会阻碍真正属于你的新缘分到来。",
    advice: "结束是开始的序曲。勇敢对有毒的执念说再见，你才腾得出双手拥抱真正的幸福。",
    matchScore: 68
  },
  {
    id: "temperance",
    num: 14,
    name: "节制",
    enName: "Temperance",
    suit: "major",
    element: "火",
    icon: "🏺",
    symbol: "♐",
    color: "#81d4fa",
    keywords: {
      upright: ["水乳交融", "情感调和", "细水长流", "治愈与平衡"],
      reversed: ["失调失衡", "沟通脱节", "急功近利", "情绪极端化"]
    },
    love_upright: "极具治愈力与包容感的情感状态。两个人如同水乳交融，彼此尊重各自的独特性，又能完美互补。通过温和耐心的日常交流，感情正稳步向深层次递进。",
    love_reversed: "沟通严重断层，双方都在各自的频道自说自话，缺乏真正的同理心；或是情绪大起大落，破坏了原本平和的关系节奏。",
    advice: "耐心地调和彼此的差异。爱情不是改变对方，而是共同调制出一杯温润香醇的甘露。",
    matchScore: 94
  },
  {
    id: "devil",
    num: 15,
    name: "恶魔",
    enName: "The Devil",
    suit: "major",
    element: "土",
    icon: "⛓️",
    symbol: "♑",
    color: "#ff7043",
    keywords: {
      upright: ["致命吸引", "肉体欲望", "宿命羁绊", "难以自拔的执迷"],
      reversed: ["摆脱枷锁", "看清真相", "走出执念", "重获内心自由"]
    },
    love_upright: "充满荷尔蒙激荡与极度强烈的宿命引力，两人之间有着无可抗拒的身体吸引与占有欲。但需警惕这是否是一段伴随控制、嫉妒与依赖的“危险关系”。",
    love_reversed: "终于从一段令你痛苦上瘾的毒性关系中清醒过来。你看清了对方的真实面目，决意斩断捆绑已久的心理枷锁，夺回属于自己的人格独立。",
    advice: "锁链其实是虚掩的。问问自己：你究竟是在享受爱，还是在沉溺被束缚的安全感？",
    matchScore: 78
  },
  {
    id: "tower",
    num: 16,
    name: "高塔",
    enName: "The Tower",
    suit: "major",
    element: "火",
    icon: "⚡",
    symbol: "💥",
    color: "#e53935",
    keywords: {
      upright: ["突发变故", "幻象破灭", "剧烈震荡", "旧结构的坍塌"],
      reversed: ["大难不死", "危机关头", "勉强避过", "暗流涌动的余震"]
    },
    love_upright: "关系即将面临意想不到的冲击（如秘密被揭发、突如其来的争吵或外界不可抗力）。虽然看似残酷，但这道闪电将劈碎一切建立在谎言上的虚假安全感。",
    love_reversed: "一场酝酿已久的危机正在逼近，虽然暂时没有彻底爆发，但已经危机四伏。如果继续视而不见，更大的震荡仍在后头。",
    advice: "唯有摧毁建立在沙滩上的高塔，你才能在真正坚固的花岗岩上重建崭新的幸福。",
    matchScore: 60
  },
  {
    id: "star",
    num: 17,
    name: "星星",
    enName: "The Star",
    suit: "major",
    element: "风",
    icon: "✨",
    symbol: "♒",
    color: "#80deea",
    keywords: {
      upright: ["充满希望", "心灵慰藉", "理想爱情", "风雨后的曙光"],
      reversed: ["失望落空", "期望过高", "悲观消极", "暗淡无光"]
    },
    love_upright: "经历了前期的困惑与波折后，感情终于迎来了澄澈清明的希望之星！你们对彼此怀揣着最美好的憧憬，关系充满纯洁、治愈与宁静的美感。",
    love_reversed: "对未来的憧憬可能脱离了现实支撑，把对方神化后容易陷入失望；或是近期受挫后陷入自我封闭，对爱情失去了原本的信心与光芒。",
    advice: "只要心怀希望，黑暗中就总有星光引路。保持积极纯粹的心念，好运会随之而来。",
    matchScore: 93
  },
  {
    id: "moon",
    num: 18,
    name: "月亮",
    enName: "The Moon",
    suit: "major",
    element: "水",
    icon: "🌔",
    symbol: "♓",
    color: "#9fa8da",
    keywords: {
      upright: ["不安焦虑", "迷茫未明", "隐秘情绪", "潜意识猜忌"],
      reversed: ["真相浮现", "拨云见日", "走出阴霾", "恐惧渐消"]
    },
    love_upright: "目前的感情蒙上了一层浓雾，让你感到强烈的不安与患得患失。周围可能存在隐瞒或模糊不清的界限，你的敏感与焦虑可能正在放大事情的负面面。",
    love_reversed: "笼罩在心头的迷雾正在缓缓散开。隐藏的真相即将浮出水面，你不再被莫名其妙的恐惧裹挟，开始能理性冷静地直面现实了。",
    advice: "在光线昏暗的月光下不要做重大裁决。给时间一点时间，等待太阳升起看清全貌。",
    matchScore: 70
  },
  {
    id: "sun",
    num: 19,
    name: "太阳",
    enName: "The Sun",
    suit: "major",
    element: "火",
    icon: "☀️",
    symbol: "🌞",
    color: "#ffca28",
    keywords: {
      upright: ["无比光明", "热情喜悦", "修成正果", "充满生命力与爱"],
      reversed: ["暂时乌云", "热情微降", "小有虚荣", "光芒稍隐"]
    },
    love_upright: "塔罗中最为温暖明亮的一张大吉牌！充满毫不掩饰的快乐、自信与生机勃勃的爱意。双方坦诚相待，毫无保留，婚恋必定光明灿烂、幸福美满！",
    love_reversed: "大体方向依然是向好的，但可能因为暂时的琐事争吵或工作压力，让彼此的热情稍有回落。多给予对方阳光般的鼓励即可迅速回暖。",
    advice: "大大方方地去爱与被爱吧！你的自信和笑容就是最强大的桃花磁场。",
    matchScore: 98
  },
  {
    id: "judgement",
    num: 20,
    name: "审判",
    enName: "Judgement",
    suit: "major",
    element: "水",
    icon: "📯",
    symbol: "🎺",
    color: "#ce93d8",
    keywords: {
      upright: ["旧情复燃", "重大转折", "内心觉醒", "终局裁决与新生"],
      reversed: ["犹豫悔恨", "错过时机", "抗拒召唤", "重蹈覆辙"]
    },
    love_upright: "感情即将迎来至关重要的关键分水岭！如果是测算复合，此牌代表极高的“旧情复燃与冰释前嫌”几率；两个人终于解开心结，做出无悔的终身决定。",
    love_reversed: "在关键的转折关头犹豫不决，或是明知过去行不通却依然重蹈覆辙；对曾经犯下的过错难以释怀，陷入无休止的自责或责怪对方。",
    advice: "倾听灵魂深处的号角。过去的经验是为了滋养你，而不是惩罚你。勇敢拥抱新生。",
    matchScore: 90
  },
  {
    id: "world",
    num: 21,
    name: "世界",
    enName: "The World",
    suit: "major",
    element: "土",
    icon: "🌍",
    symbol: "👑",
    color: "#80cbc4",
    keywords: {
      upright: ["大圆满", "修成正果", "旅程终点", "无缺的幸福"],
      reversed: ["临门一脚", "未竟之愿", "稍欠火候", "原地踏步"]
    },
    love_upright: "感情达到了最高阶段的圆满与和谐！象征着长跑修成正果、步入婚姻殿堂，或是彼此找到了此生最契合的人生伴侣，所有的付出都得到了完美的奖赏。",
    love_reversed: "距离最终的完满似乎总是差了“临门一脚”，可能由于现实中的某个小小阻碍未能彻底解决，导致关系卡在一个看似接近成功却始终无法落地的状态。",
    advice: "你已经走过了漫长的旅程。别在最后一步松懈，补齐最后一块拼图，迎接属于你的圆满。",
    matchScore: 99
  },
  // 精选经典小阿卡纳感情牌
  {
    id: "cups_2",
    num: 22,
    name: "圣杯二",
    enName: "Two of Cups",
    suit: "minor",
    element: "水",
    icon: "🥂",
    symbol: "🍷",
    color: "#f48fb1",
    keywords: {
      upright: ["两情相悦", "灵魂伴侣", "平等契约", "深深被爱"],
      reversed: ["产生隔阂", "信任危机", "误解冷落", "步调不一"]
    },
    love_upright: "金风玉露一相逢，胜却人间无数。双方不仅是外在的互相喜欢，更是灵魂层面的互相认可与托付。每一次对视都有化不开的深情，非常适合确立关系或谈婚论嫁。",
    love_reversed: "双方似乎有些沟通断层，原先的默契受到了误会或外界干扰的挑战。如果不能坦诚交心，小小的裂痕可能演变为深刻的信任危机。",
    advice: "举起你们心中的爱之杯。珍惜眼前那个懂你悲欢的人，坦诚沟通能化解一切干戈。",
    matchScore: 97
  },
  {
    id: "swords_3",
    num: 23,
    name: "宝剑三",
    enName: "Three of Swords",
    suit: "minor",
    element: "风",
    icon: "💔",
    symbol: "🗡️",
    color: "#ef9a9a",
    keywords: {
      upright: ["心碎阵痛", "言语伤害", "第三方隔阂", "清醒的刺痛"],
      reversed: ["伤口愈合", "走出阵痛", "释放宽恕", "痛定思痛"]
    },
    love_upright: "感情正经历着令人心碎的刺痛时刻。可能是一句无情的话语、一次无意的欺瞒，或是第三方的介入。虽然痛苦难熬，但唯有看清真相，才能免受更长久的蒙蔽。",
    love_reversed: "最痛苦的黑暗时刻正在逐渐过去，扎在心头的宝剑正在被慢慢拔出。你开始学会原谅自己、释怀过去，心灵正逐步走入疗愈周期。",
    advice: "接纳痛苦是疗愈的必经之路。允许自己悲伤，但请记住：心碎的地方，也是光照进来的地方。",
    matchScore: 55
  },
  {
    id: "wands_4",
    num: 24,
    name: "权杖四",
    enName: "Four of Wands",
    suit: "minor",
    element: "火",
    icon: "💐",
    symbol: "🏡",
    color: "#ffe082",
    keywords: {
      upright: ["筑巢安居", "喜庆婚典", "亲友欢迎", "稳固幸福乐园"],
      reversed: ["家庭摩擦", "筹备分歧", "表面热闹", "安全感小波动"]
    },
    love_upright: "象征着建立稳固幸福的爱巢与家庭庆典！双方感情得到了家庭与朋友的热烈祝福，极易迎来订婚、乔迁同居、盛大婚礼等欢庆时刻，充满归属感。",
    love_reversed: "可能在筹备婚事、处理双方家庭琐事时出现微小的意见分歧，或者由于外界应酬过多忽略了两人内部的温馨交流。",
    advice: "家是心灵的港湾。与爱人携手筑造属于你们的坚实城池，尽情庆祝这份难得的安宁与喜悦。",
    matchScore: 95
  }
];

// 塔罗牌阵定义
const SPREADS = {
  single: {
    id: "single",
    name: "单张神谕签",
    badge: "即时解惑",
    desc: "适合快速测算今日爱情运势、某个具体困惑或是否做决定的直觉裁决",
    cardCount: 1,
    slots: [
      { id: "slot_1", name: "神谕核心", desc: "揭示当下最关键的能量状态与天赐指引" }
    ]
  },
  triangle: {
    id: "triangle",
    name: "圣三角爱情牌阵",
    badge: "因果透视",
    desc: "经典牌阵，全面透视感情的过去因缘、现状困局与未来3-6个月演变走向",
    cardCount: 3,
    slots: [
      { id: "slot_1", name: "因缘过去", desc: "导致当前感情局面的根源与潜意识心结" },
      { id: "slot_2", name: "当下真相", desc: "此刻两个人真实的相处状态与隐秘阻力" },
      { id: "slot_3", name: "未来走向", desc: "顺应当前能量发展，未来情感的最终归宿" }
    ]
  },
  venus: {
    id: "venus",
    name: "爱恋双人维纳斯",
    badge: "深度合盘",
    desc: "深度探测双方心意！解构你的心态、对方真实想法、核心阻力与破局方案",
    cardCount: 4,
    slots: [
      { id: "slot_1", name: "你的心境", desc: "你潜意识里对这段关系的真实渴求与隐忧" },
      { id: "slot_2", name: "对方心思", desc: "对方目前对你的真实感情、态度与隐藏想法" },
      { id: "slot_3", name: "现实阻碍", desc: "阻碍关系更进一步的现实环境或性格死穴" },
      { id: "slot_4", name: "结局走向", desc: "破局之后的最终发展趋势与命运启示" }
    ]
  }
};
