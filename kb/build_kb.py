#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_kb.py —— 从《紫微斗數全書》原文构建结构化知识库

语料来源：中文维基文库 zh.wikisource.org/wiki/紫微斗數全書
         （明·陳希夷傳，清刻本；公有领域）
输出：    ../knowledge_base.js  (global.ZiweiKB)

⚠️ 重要：本知识库**只用于解读**，不用于排盘算法。
   原文存在转录讹误（如「丙丁猪狗位」应为「丙丁猪鸡位」、「免蛇」应为「兔蛇」），
   故所有安星/定局算法一律以经官方天文数据校验的代码为准。
"""
import re, json, os

HERE = os.path.dirname(os.path.abspath(__file__))

# 繁 → 简（仅限本项目用到的星曜与术语）
T2S = {
    "紫微":"紫微","天機":"天机","太陽":"太阳","武曲":"武曲","天同":"天同","廉貞":"廉贞",
    "天府":"天府","太陰":"太阴","貪狼":"贪狼","巨門":"巨门","天相":"天相","天梁":"天梁",
    "七殺":"七杀","破軍":"破军","文昌":"文昌","文曲":"文曲","左輔":"左辅","右弼":"右弼",
    "天魁":"天魁","天鉞":"天钺","祿存":"禄存","天馬":"天马","擎羊":"擎羊","陀羅":"陀罗",
    "火星":"火星","鈴星":"铃星","化祿":"化禄","化權":"化权","化科":"化科","化忌":"化忌",
}
MAIN14 = ["紫微","天机","太阳","武曲","天同","廉贞","天府","太阴",
          "贪狼","巨门","天相","天梁","七杀","破军"]
AUX = ["文昌","文曲","左辅","右弼","天魁","天钺","禄存","天马",
       "擎羊","陀罗","火星","铃星","化禄","化权","化科","化忌"]

PALACE_MAP = {
    "一 命宫":"命宫", "二兄弟":"兄弟宫", "三妻妾":"夫妻宫", "四子女":"子女宫",
    "五财帛":"财帛宫", "六疾厄":"疾厄宫", "七迁移":"迁移宫", "八奴仆":"交友宫",
    "九官禄":"官禄宫", "十田宅":"田宅宫", "十一福德":"福德宫", "十二父母":"父母宫",
}


def clean(s: str) -> str:
    """清理 wikitext 标记"""
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"</?(poem|onlyinclude|noinclude|ref|div|span)[^>]*>", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = s.replace("'''", "").replace("''", "")
    s = re.sub(r"^\s*[=]{2,}.*?[=]{2,}\s*$", "", s, flags=re.M)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def to_simplified(s: str) -> str:
    for t, v in T2S.items():
        s = s.replace(t, v)
    return s


def sections(text):
    """返回 [(level, title, body)]"""
    out, marks = [], list(re.finditer(r"^(={2,4})\s*(.+?)\s*\1\s*$", text, re.M))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        out.append((len(m.group(1)), m.group(2).strip(), text[m.end():end]))
    return out


def build():
    entries = []

    def add(eid, etype, keys, source, body):
        body = clean(body)
        if len(body) < 12:
            return
        entries.append({
            "id": eid, "type": etype, "keys": keys,
            "source": source, "text": to_simplified(body)
        })

    # ---------- 卷一：諸星問答論 + 賦文 ----------
    v1 = open(os.path.join(HERE, "卷一.txt"), encoding="utf-8").read()
    for lvl, title, body in sections(v1):
        t = to_simplified(title)
        m = re.match(r"^[問问](.+?)(?:星)?所主(?:若何|如何|為何|为何)[？?]?$", t)
        if m:
            star = to_simplified(m.group(1)).replace("星", "")
            if star in MAIN14 or star in AUX:
                add(f"star.{star}.general", "star_general", [star],
                    "《紫微斗數全書》卷一·諸星問答論", body)
            continue
        if ("賦" in t or "赋" in t or "論" in t or "论" in t or "準繩" in t or "彀率" in t) \
           and not t.startswith("紫微斗"):
            add(f"classic.{t}", "classic_verse", [t],
                f"《紫微斗數全書》卷一·{title}", body)

    # ---------- 卷二：十二宫断语 ----------
    v2 = open(os.path.join(HERE, "卷二.txt"), encoding="utf-8").read()
    for lvl, title, body in sections(v2):
        pal = PALACE_MAP.get(title.strip())
        if not pal:
            continue
        cleaned = clean(body)
        # 整章保存
        add(f"palace.{pal}.all", "palace_all", [pal],
            f"《紫微斗數全書》卷二·{title}", body)
        # 再按「以星曜开头的行」拆成单条，便于精确召回
        for line in cleaned.split("\n"):
            line = to_simplified(line.strip())
            if len(line) < 8:
                continue
            for star in MAIN14 + AUX:
                if line.startswith(star):
                    add(f"palace.{pal}.{star}", "palace_star", [pal, star],
                        f"《紫微斗數全書》卷二·{title}", line)
                    break

    # ---------- 卷三：格局与论断 ----------
    v3 = open(os.path.join(HERE, "卷三.txt"), encoding="utf-8").read()
    for lvl, title, body in sections(v3):
        t = to_simplified(title)
        if t.startswith("紫微斗数全书"):
            continue
        add(f"treatise.{t}", "treatise", [t],
            f"《紫微斗數全書》卷三·{title}", body)

    return entries


if __name__ == "__main__":
    es = build()
    out = os.path.join(HERE, "..", "knowledge_base.js")
    header = (
        "/* ==========================================================================\n"
        " * knowledge_base.js —— 紫微斗数典籍知识库（自动生成，请勿手改）\n"
        " *\n"
        " * 语料：《紫微斗數全書》（明·陳希夷傳，清刻本）\n"
        " * 出处：中文维基文库 https://zh.wikisource.org/wiki/紫微斗數全書\n"
        " * 版权：公有领域\n"
        " * 生成：kb/build_kb.py\n"
        " *\n"
        " * ⚠️ 本知识库仅用于【解读】。原文存在转录讹误\n"
        " *    （如「丙丁猪狗位」应为「猪鸡位」、「免蛇藏」应为「兔蛇藏」），\n"
        " *    因此一切【排盘算法】均以经官方天文数据校验的代码为准，不取本文。\n"
        " * ========================================================================== */\n"
    )
    body = "(function (g) {\n  g.ZiweiKB = " + json.dumps(es, ensure_ascii=False, indent=1) + ";\n})(typeof window !== \"undefined\" ? window : this);\n"
    open(out, "w", encoding="utf-8").write(header + body)

    from collections import Counter
    c = Counter(e["type"] for e in es)
    print(f"知识库条目：{len(es)}")
    for k, v in c.most_common():
        print(f"  {k:<16} {v}")
    print(f"文件大小：{os.path.getsize(out)/1024:.1f} KB")
