# -*- coding: utf-8 -*-
"""
build_bazi_kb.py —— 八字知识库构建脚本

输入（同目录）：
    渊海子平.txt   —— 明·杨淙《淵海子平》      wikitext
    穷通宝鉴.txt   —— 《窮通寶鑑》（栏江网）   wikitext
    滴天髓.txt     —— 题刘基《滴天髓》辑要      wikitext
输出：
    ../bazi_kb.js  —— global.BaziKB = [...]

★ 分层原则（与 build_kb.py 一致，勿改）：
  古籍文本存在转录讹误，**只能用于「解读」，绝不能用于「算法」**。
  排盘、藏干、十神、月令等计算一律走已验证的代码（bazi_analyze.js），
  本知识库仅提供文字依据。

★ 检索 key 的选取原则：
  只用**无争议的确定值**做 key —— 日干、月令、命中十神、五行分布。
  刻意不用「身强身弱」「用神」做 key，因为那是流派分歧最大的判断，
  判错会导致整条检索链失效。
"""
import re, os, json, io

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "..", "bazi_kb.js")

# ---------------------------------------------------------------- 清理
def clean(t):
    # 先剥掉 {| ... |} 命例表格（只有干支、无解读，对 RAG 是噪音）
    t = re.sub(r"\{\|.*?\|\}", "", t, flags=re.S)
    t = re.sub(r"-\{[TZ]?\|?([^}]*)\}-", r"\1", t)      # -{...}- 繁简标记
    t = re.sub(r"\{\{[^{}]*\}\}", "", t)                 # 模板
    t = re.sub(r"\{\{[^{}]*\}\}", "", t)
    t = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", t)   # [[a|b]] -> b
    t = re.sub(r"\[\[([^\]]*)\]\]", r"\1", t)            # [[a]] -> a
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)                        # HTML
    t = t.replace("'''", "").replace("''", "")
    t = re.sub(r"^[\*#:;]+\s*", "", t, flags=re.M)       # 列表符号
    t = re.sub(r"\|+", "", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

def paras(t):
    return [p.strip() for p in re.split(r"\n\s*\n", t) if p.strip()]

def pack(ps, limit=520):
    """把段落贪心打包成 <=limit 字的块"""
    out, cur = [], ""
    for p in ps:
        if not cur:
            cur = p
        elif len(cur) + len(p) + 1 <= limit:
            cur += "\n" + p
        else:
            out.append(cur); cur = p
        while len(cur) > limit * 1.6:          # 单段过长则硬切
            out.append(cur[:limit]); cur = cur[limit:]
    if cur: out.append(cur)
    return out

ENTRIES = []
def add(typ, keys, source, text):
    text = text.strip()
    if len(text) < 12:
        return
    ENTRIES.append({
        "id": "b%03d" % (len(ENTRIES) + 1),
        "type": typ,
        "keys": keys,
        "source": source,
        "text": text
    })

def read(fn):
    with io.open(os.path.join(HERE, fn), encoding="utf-8") as f:
        return f.read()

# ================================================================
# 1. 窮通寶鑑 —— 调候，按「日干 + 月令」组织（本库的主力）
# ================================================================
CN_NUM = {"正":1,"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,
          "七":7,"八":8,"九":9,"十":10,"十一":11,"十二":12}

def parse_months(label):
    """从『正二月甲木』『十一月丁火』中取出月份数字列表"""
    m = re.match(r"^([正一二三四五六七八九十]+)月", label)
    if not m:
        return []
    s = m.group(1)
    if s in CN_NUM:
        return [CN_NUM[s]]
    # 十一 / 十二
    if s.startswith("十") and len(s) == 2 and s[1] in "一二":
        return [CN_NUM[s]]
    # 连写：正二 / 五六 / 二三 / 十一二（=十一月、十二月）
    out = []
    i = 0
    while i < len(s):
        if s[i] == "十" and i + 1 < len(s) and s[i+1] in "一二":
            out.append(CN_NUM[s[i:i+2]]); i += 2
        elif s[i] in CN_NUM:
            d = CN_NUM[s[i]]
            # 「十一二」中的「二」承接前一个 11，应读作 12 而非 2
            if out and out[-1] >= 10 and d in (1, 2):
                d = 10 + d
            out.append(d); i += 1
        else:
            i += 1
    return out

MONTH_CN = ["正月","二月","三月","四月","五月","六月",
            "七月","八月","九月","十月","十一月","十二月"]
SEASON_MONTHS = {"三春":[1,2,3], "三夏":[4,5,6], "三秋":[7,8,9], "三冬":[10,11,12]}

def build_qiongtong():
    raw = read("穷通宝鉴.txt")
    # 五行总论 / 论木论火… （== 论木 == 这一级）
    for m in re.finditer(r"^==\s*(论[木火土金水])\s*==\s*\n(.*?)(?=^==[^=]|\Z)",
                         raw, flags=re.M | re.S):
        name, body = m.group(1), m.group(2)
        # 去掉下属 === 小节，只留本级总论
        body = re.split(r"^===", body, flags=re.M)[0]
        wx = name[-1]
        for i, ck in enumerate(pack(paras(clean(body)))):
            add("wuxing_general", ["五行总论:" + wx],
                "《窮通寶鑑》" + name + ("·%d" % (i+1) if i else ""), ck)

    # === 三春甲木 === 这一级
    season_re = re.compile(
        r"^===\s*(三[春夏秋冬])([甲乙丙丁戊己庚辛壬癸])([木火土金水])\s*===\s*\n(.*?)(?=^==|\Z)",
        flags=re.M | re.S)
    n_month = 0
    for m in season_re.finditer(raw):
        season, gan, wx, body = m.group(1), m.group(2), m.group(3), m.group(4)
        dm = gan + wx                      # 如「甲木」
        # 用加粗月份标记切段
        marks = list(re.finditer(r"'''\s*([^'\n]{2,14}?)\s*'''", body))
        # 季节引言：首个月份标记之前的内容；若该季完全不分月，则整段皆为季节内容
        intro = clean(body[:marks[0].start()] if marks else body)
        # 季节条目同时挂上本季三个月的 fallback key，
        # 保证任何「日干+月令」组合都至少检索得到季节级依据
        s_keys = ["调候季节:" + season + dm] + \
                 ["调候月fallback:" + dm + "|" + MONTH_CN[mo-1] for mo in SEASON_MONTHS[season]]
        if intro:
            for i, ck in enumerate(pack(paras(intro))):
                add("tiaohou_season", s_keys,
                    "《窮通寶鑑》" + season + dm + ("·%d" % (i+1) if i else ""), ck)
        carry = ""      # 悬挂在段尾、实际属于下一段的连接词（或/若/如…）
        for j, mk in enumerate(marks):
            label = mk.group(1)
            months = parse_months(label)
            if not months:
                carry = ""
                continue
            end = marks[j+1].start() if j + 1 < len(marks) else len(body)
            seg_raw = body[mk.end():end]
            # 原文形如「…方妙。（空行）或'''八月'''一派辛金」——
            # 段尾的「或」其实是下一段的起头，必须移交，否则会被误算进本月。
            mtail = re.search(r"([或若如凡倘更]+)\s*$", seg_raw)
            nxt_carry = ""
            if mtail:
                nxt_carry = mtail.group(1)
                seg_raw = seg_raw[:mtail.start()]
            seg = clean(carry + seg_raw)
            carry = nxt_carry
            if not seg:
                continue
            # 补回月份标签：原文标签写在加粗标记内，清理后会丢失
            if not seg.startswith(label):
                seg = seg.lstrip("，,")
                # 承接来的连接词（八月「或」一派辛金）前补个逗号，读起来才通顺
                sep = "，" if seg[:1] in "或若如凡倘更" else ""
                seg = label + sep + seg
            keys = ["调候:" + dm + "|" + MONTH_CN[mo-1] for mo in months if 1 <= mo <= 12]
            if not keys:
                continue
            n_month += 1
            for i, ck in enumerate(pack(paras(seg))):
                add("tiaohou", keys,
                    "《窮通寶鑑》" + season + dm + "·" + label + ("·%d" % (i+1) if i else ""), ck)
    return n_month

# ================================================================
# 2. 淵海子平 —— 十神论、六亲论、性情、疾病、女命
# ================================================================
SHISHEN_MAP = {
    "论伤官":["十神:伤官"], "伤官说":["十神:伤官"],
    "论食神":["十神:食神"],
    "论正财":["十神:正财","十神:偏财"],
    "正官论":["十神:正官"],
    "论七杀":["十神:七杀"],
    "论官星太过":["十神:正官"],
    "论官杀混杂要制伏":["十神:正官","十神:七杀"],
    "论印綬":["十神:正印"],
    "论倒食":["十神:偏印"],
    "论劫财":["十神:劫财","十神:比肩"],
    "论阳刃":["神煞:阳刃"],
    "论日刃":["神煞:阳刃"],
    "论魁罡":["神煞:魁罡"],
    "论金神":["神煞:金神"],
    "论日贵":["神煞:日贵"],
    "论日德":["神煞:日德"],
}
LIUQIN_MAP = {
    "六亲总篇":["六亲:总"],
    "论父":["六亲:父"], "论母":["六亲:母"],
    "论兄弟姊妹":["六亲:兄弟"],
    "论妻妾":["六亲:配偶"],
    "论子息":["六亲:子女"],
    "论小儿":["六亲:子女"],
}
NVMING = ["论妇人总诀","阴命赋","女命总断歌","女命富贵贫贱篇",
          "滚浪桃花","女命贵格","女命贱格"]
OTHER_MAP = {
    "论性情":("xingqing", ["主题:性情"]),
    "论疾病":("jibing",   ["主题:疾病"]),
    "论大运":("yunxian",  ["主题:大运"]),
    "论太岁吉凶":("yunxian", ["主题:流年"]),
    "论征太岁":("yunxian", ["主题:流年"]),
    "论日为主":("jichu",  ["基础:日主"]),
    "论月令":("jichu",    ["基础:月令"]),
    "论天干地支暗藏总诀":("jichu", ["基础:藏干"]),
}

def build_yuanhai():
    raw = read("渊海子平.txt")
    secs = re.findall(r"^==\s*([^=\n]+?)\s*==\s*\n(.*?)(?=^==[^=]|\Z)",
                      raw, flags=re.M | re.S)
    for title, body in secs:
        body = clean(body)
        if not body:
            continue
        if title in SHISHEN_MAP:
            typ, keys = "shishen", SHISHEN_MAP[title]
        elif title in LIUQIN_MAP:
            typ, keys = "liuqin", LIUQIN_MAP[title]
        elif title in NVMING:
            typ, keys = "nvming", ["性别:女命"]
        elif title in OTHER_MAP:
            typ, keys = OTHER_MAP[title]
        else:
            typ, keys = "treatise", ["通论"]
        for i, ck in enumerate(pack(paras(body))):
            add(typ, keys, "《淵海子平》" + title + ("·%d" % (i+1) if i else ""), ck)

# ================================================================
# 3. 滴天髓 —— 义理，按篇
# ================================================================
def build_ditian():
    raw = read("滴天髓.txt")
    body = clean(raw)
    # 该文件是 19 篇拼接，用「原注」「任注」无法切；按段打包成通论
    for i, ck in enumerate(pack(paras(body), 480)):
        add("treatise", ["通论"], "《滴天髓》辑要·%d" % (i+1), ck)

# ================================================================
if __name__ == "__main__":
    nm = build_qiongtong()
    build_yuanhai()
    build_ditian()

    from collections import Counter
    c = Counter(e["type"] for e in ENTRIES)

    js = ("/* bazi_kb.js —— 自动生成，请勿手改。重新生成： cd kb && python3 build_bazi_kb.py\n"
          " *\n"
          " * 语料：《淵海子平》《窮通寶鑑》《滴天髓》（中文维基文库，公有领域）\n"
          " *\n"
          " * ★ 古籍文本存在转录讹误，本库**只用于解读**，绝不参与排盘计算。\n"
          " *   排盘 / 藏干 / 十神 / 月令 一律以 bazi_analyze.js 的计算结果为准。\n"
          " */\n"
          "(function(global){\n  global.BaziKB = ")
    js += json.dumps(ENTRIES, ensure_ascii=False, separators=(",", ":"))
    js += ";\n})(typeof window!==\"undefined\"?window:global);\n"

    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write(js)

    print("条目总数: %d" % len(ENTRIES))
    for k, v in c.most_common():
        print("  %-18s %4d" % (k, v))
    print("调候月份段落数: %d" % nm)
    print("输出: %s (%.1f KB)" % (os.path.abspath(OUT), os.path.getsize(OUT) / 1024.0))
