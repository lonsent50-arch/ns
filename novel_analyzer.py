#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Novel Studio — 分析引擎独立模块
关键词表 + 4 个纯函数分析引擎，无 Flask 依赖，无副作用
"""

import re

# ===== 冲突密度实时分析 =====

CONFLICT_KEYWORDS = [
    '杀', '死', '血', '战', '剑', '刀', '枪', '箭', '爆炸', '毁灭',
    '对抗', '冲突', '争斗', '搏斗', '激战', '决斗', '厮杀',
    '怒吼', '咆哮', '威胁', '逼问', '质问', '冷笑', '怒', '恨', '仇',
    '危险', '危机', '陷阱', '暗算', '偷袭',
]

SUSPENSE_KEYWORDS = [
    '突然', '忽然', '竟然', '谁知', '没想到', '不料', '奇怪', '诡异',
    '神秘', '秘密', '隐藏', '暗中', '黑影', '悄悄', '偷偷',
    '谜', '疑', '似乎', '仿佛', '隐约', '莫名',
    '未知', '未解', '悬', '伏笔',
]

PLEASURE_KEYWORDS = [
    '笑', '乐', '喜', '悦', '爽', '得意', '满足', '欣慰',
    '收获', '突破', '升级', '成长', '领悟', '成功',
    '奖励', '宝物', '机缘', '奇遇',
]

INFO_KEYWORDS = [
    '说', '道', '讲', '告诉', '解释', '说明', '描述',
    '世界', '设定', '规则', '系统', '功法', '修为',
    '因为', '所以', '原来', '从前', '历史', '传说',
    '介绍', '记载', '典籍',
]

# ===== 生存逻辑与写实度雷达 — 关键词表 =====

POWER_FANTASY_MARKERS = [
    '秒杀', '碾压', '横扫', '无敌', '一招', '瞬间击杀',
    '倒头便拜', '纳头便拜', '虎躯一震', '王霸之气', '霸气侧漏',
    '轻松击败', '毫不费力', '抬手间', '翻手', '灰飞烟灭',
    '蝼蚁', '废物', '不知死活', '自寻死路', '蚍蜉撼树',
    '随手', '一挥', '轰杀', '镇压', '弹指间',
    '轻描淡写', '不屑', '嗤笑', '冷喝', '区区',
]

ENVIRONMENT_PRESSURE_MARKERS = [
    '饿', '饥', '渴', '冷', '热', '冻', '伤口', '流血', '骨折',
    '疲惫', '力竭', '喘', '汗', '晕', '虚', '踉跄', '发抖',
    '泥泞', '风沙', '暴雨', '暴雪', '烈日', '酷寒', '潮湿',
    '腐臭', '血腥味', '汗味', '霉味', '铁锈味',
    '粮食', '干粮', '水源', '水袋', '药', '绷带', '包扎',
    '喘息', '颤抖', '发白', '冷汗', '脱力', '虚脱',
    '擦伤', '淤青', '化脓', '肿胀', '烧伤', '冻伤',
    '腐肉', '蛆', '霉', '锈', '渍', '垢',
]

COGNITIVE_GAP_MARKERS = [
    '以为', '误以为', '并不知道', '并未察觉', '浑然不知',
    '毫不知情', '还被蒙在', '尚不知', '被误导',
    '判断失误', '误解', '错误推断', '信息不全',
    '殊不知', '却不知', '完全没想到', '始料未及',
    '各自', '双方都不', '谁也不', '彼此不知',
    '猜错了', '想错了', '估计错', '看走眼',
    '还当', '仍以', '只道是', '哪知', '怎料',
]

# ===== 断章钩子密度分析器 — 关键词表 =====

CLIFFHANGER_HIGH_MARKERS = [
    '突然', '就在这时', '猛然', '瞬间', '刹那',
    '门开了', '门外', '背后传来', '回头一看', '抬头一看',
    '竟', '赫然', '猛地', '陡然', '骤然',
    '秘密', '真相', '原来', '其实', '不是别人',
    '竟然是', '怎么会', '不可能', '怎么是你',
    '危险', '杀意', '杀气', '寒光', '死亡',
    '来不及', '晚了', '陷阱', '冷箭', '毒',
    '匕首', '血', '倒', '断',
    '终于来了', '等你很久了', '你来了',
    '被人', '挡', '拦住', '堵',
    '却', '然而', '但', '可', '谁知',
]

CLIFFHANGER_LOW_MARKERS = [
    '回去了', '离开', '告辞', '告别', '往回走',
    '休息', '睡觉', '躺下', '闭眼', '晚安', '明天',
    '天色已晚', '夜幕降临', '夜幕', '天色渐暗',
    '一天', '告一段落', '结束', '完毕',
    '吃饭', '用餐', '喝茶', '喝酒', '享',
    '回顾', '总结', '总之', '不管怎样', '无论如何',
    '虽然', '但毕竟', '也罢',
    '接下来', '然后', '接着', '之后', '不久',
    '片刻', '一会儿', '不久之后',
]

# ===== 去 AI 味高级滤镜引擎 =====

DEAI_CLICHE_BANK = {
    'despair': {
        'label': '绝望感/抽象套话',
        'icon': '🌫️',
        'words': [
            '仿佛', '那一刻', '史诗般', '如同一场饕餮盛宴', '博弈', '拉满',
            '如同', '宛若', '仿佛间', '恍若', '恰似', '犹如',
            '盛宴', '饕餮', '史诗', '级', '天花板', '降维打击',
            '维度', '底层逻辑', '闭环', '赋能', '抓手',
        ],
    },
    'action': {
        'label': '动作/表情套话',
        'icon': '🎭',
        'words': [
            '嘴角微微上扬', '眼神闪过一丝阴翳', '倒吸一口凉气',
            '眼中闪过一抹', '瞳孔微缩', '眉头微蹙', '眸光一黯',
            '嘴角勾起', '眼中寒光一闪', '面色一沉', '眼神一凛',
            '嘴角微扬', '眼中闪过一丝', '嘴角一抽', '眉头一皱',
            '微微一愣', '面色微变', '心中一沉', '心头一紧',
            '眼中掠过', '嘴角泛起', '眼眸中闪过', '眼中浮现',
            '不由一愣', '心头一跳', '脸色一变', '神色一变',
        ],
    },
    'fluff': {
        'label': '废话/总结文学',
        'icon': '💬',
        'words': [
            '总而言之', '不可否认的是', '正如我们所知道的',
            '综上所述', '值得注意的是', '需要强调的是',
            '毫无疑问', '显而易见', '众所周知', '不言而喻',
            '值得注意的是', '不得不承认', '必须指出',
            '事实上', '其实', '严格来说', '确切地说',
            '然而', '此外', '总之', '因此', '所以',
            '从某种程度上说', '在某种意义上',
        ],
    },
    'godview': {
        'label': '上帝视角/全知总结',
        'icon': '👁️',
        'words': [
            '一切都', '从此以后', '命运的安排', '冥冥之中',
            '谁知道', '谁能想到', '令人意想不到的是',
            '这注定', '命运的齿轮', '历史的车轮',
            '多年以后', '回想起来', '后来才知道',
        ],
    },
}


def analyze_cliffhanger_tail(tail_text):
    """断章钩子密度分析：分析章节尾部文本的悬念切断质量。

    核心指标：
    - hook_score: 0-100 钩子强度评分
    - cut_quality: 切点是否在高潮处（最后一句话是否含高潮标记）
    - last_sentence_hook: 最后一句话是否构成有效钩子
    - diagnosis: 诊断建议

    Args:
        tail_text: 章节末尾 15% 的文本（或最后 300-500 字）

    Returns:
        dict: 完整的钩子分析结果
    """
    if not tail_text or len(tail_text.strip()) < 50:
        return {
            'hook_score': 20,
            'cut_quality': 'insufficient',
            'last_sentence_hook': False,
            'high_markers_hit': [],
            'low_markers_hit': [],
            'diagnosis': '文本过短，无法进行断章钩子分析。请写入至少300字后重新检测。',
            'suggestion': ''
        }

    text = tail_text.strip()

    sentences = re.split(r'[。！？!?\n]', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        sentences = [text]

    last_sentences = sentences[-3:] if len(sentences) >= 3 else sentences
    last_sentence = sentences[-1]

    high_hits = []
    for line in last_sentences:
        for kw in CLIFFHANGER_HIGH_MARKERS:
            if kw in line:
                high_hits.append({'keyword': kw, 'sentence': line[:60]})

    low_hits = []
    for line in last_sentences:
        for kw in CLIFFHANGER_LOW_MARKERS:
            if kw in line:
                low_hits.append({'keyword': kw, 'sentence': line[:60]})

    last_has_hook = any(kw in last_sentence for kw in CLIFFHANGER_HIGH_MARKERS)
    last_is_low = any(kw in last_sentence for kw in CLIFFHANGER_LOW_MARKERS)

    high_count = len(high_hits)
    low_count = len(low_hits)

    base_score = min(70, high_count * 15)
    if last_has_hook:
        base_score += 25
    base_score -= low_count * 10
    if last_is_low:
        base_score -= 20

    hook_score = max(5, min(100, base_score))

    if hook_score >= 70:
        cut_quality = 'excellent'
    elif hook_score >= 45:
        cut_quality = 'good'
    elif hook_score >= 25:
        cut_quality = 'weak'
    else:
        cut_quality = 'poor'

    if cut_quality == 'excellent':
        diagnosis = '尾部钩子强劲。切点精准卡在高潮处，读者翻页欲望极强。'
        suggestion = '保持当前断章节奏，最后一句话的悬念感是本书的核心竞争力。'
    elif cut_quality == 'good':
        diagnosis = '尾部钩子有效。存在悬念元素，但可在最后一句进一步加强。'
        suggestion = '建议：将本章最强冲突的揭示精准放在最后一句话，推迟"后果/反应"到下一章。'
    elif cut_quality == 'weak':
        diagnosis = '尾部钩子微弱。读者翻页欲望较低，存在平铺直叙的收尾倾向。'
        suggestion = '建议：在此处切断章节，将反派的推门、主角的震惊、危机的降临卡在最后一句话，刺激读者点下一章。'
    else:
        diagnosis = '尾部钩子缺失。结尾属于平淡日常交代，读者大概率在此处弃书。'
        suggestion = '紧急建议：删除最后3句日常收尾，改用"突然/就在这时/[角色]猛地发现/[关键信息]赫然出现"型句式结尾。例："他推开门——瞳孔骤然收缩。"'

    return {
        'hook_score': hook_score,
        'cut_quality': cut_quality,
        'last_sentence_hook': last_has_hook,
        'high_markers_hit': high_hits[-8:],
        'low_markers_hit': low_hits[-8:],
        'last_sentence': last_sentence[:80],
        'diagnosis': diagnosis,
        'suggestion': suggestion
    }


def realism_radar(content):
    """生存逻辑与写实度审计：检测文本是否滑向无脑爽文。

    Returns:
        dict: {
            realism_score: 0-100 综合写实度评分,
            power_fantasy_risk: 0-100 爽文风险,
            environment_pressure: 0-100 环境压力感知,
            cognitive_gap: 0-100 认知鸿沟保持度,
            diagnosis: str 诊断建议,
            warning: bool 是否需要告警,
            hits: {fantasy, env, gap} 各类别关键词命中详情
        }
    """
    if not content or not content.strip():
        return {
            'realism_score': 50, 'power_fantasy_risk': 0,
            'environment_pressure': 0, 'cognitive_gap': 0,
            'diagnosis': '暂无足够文本进行写实度分析', 'warning': False,
            'hits': {'fantasy': [], 'env': [], 'gap': []}
        }

    paragraphs = [p.strip() for p in content.split('\n') if p.strip()]
    total_chars = len(content)
    para_count = max(len(paragraphs), 1)

    fantasy_hits = []
    env_hits = []
    gap_hits = []

    for para in paragraphs:
        for kw in POWER_FANTASY_MARKERS:
            if kw in para:
                fantasy_hits.append({'keyword': kw, 'text': para[:60]})
        for kw in ENVIRONMENT_PRESSURE_MARKERS:
            if kw in para:
                env_hits.append({'keyword': kw, 'text': para[:60]})
        for kw in COGNITIVE_GAP_MARKERS:
            if kw in para:
                gap_hits.append({'keyword': kw, 'text': para[:60]})

    fantasy_count = len(fantasy_hits)
    env_count = len(env_hits)
    gap_count = len(gap_hits)

    fantasy_density = fantasy_count / para_count
    power_fantasy_risk = min(100, int(fantasy_density * 40))

    env_density = env_count / max(total_chars / 100, 1)
    environment_pressure = min(100, int(env_density * 60))

    gap_density = gap_count / max(total_chars / 100, 1)
    cognitive_gap = min(100, int(gap_density * 50))

    raw_score = environment_pressure * 1.2 + cognitive_gap * 0.8 - power_fantasy_risk * 0.7
    realism_score = max(0, min(100, int(raw_score)))

    diagnosis = ''
    warning = False

    if power_fantasy_risk > 60 and environment_pressure < 30:
        warning = True
        diagnosis = (
            '逻辑质感警告：当前情节有滑入"无脑爽文"风险。'
            '环境压力感知不足、配角存在降智倾向。'
            '建议：增加环境细节白描、放大人物之间的认知鸿沟、'
            '让角色的每个决策建立在有限信息之上。'
        )
    elif power_fantasy_risk > 40:
        diagnosis = '注意爽文倾向抬头，建议增强环境残酷度和角色生存压力描写。'
    elif environment_pressure > 50 and cognitive_gap > 40:
        diagnosis = '写实度良好。环境压力与认知鸿沟保持到位，硬核质感合格。'
    elif environment_pressure < 20:
        diagnosis = '环境压力描写偏弱。建议增加五感细节（温度/气味/触感/疼痛/疲惫）。'
    else:
        diagnosis = '写实度中等。可进一步强化信息不对称和生理限制描写。'

    return {
        'realism_score': realism_score,
        'power_fantasy_risk': power_fantasy_risk,
        'environment_pressure': environment_pressure,
        'cognitive_gap': cognitive_gap,
        'diagnosis': diagnosis,
        'warning': warning,
        'hits': {
            'fantasy': fantasy_hits[-10:],
            'env': env_hits[-10:],
            'gap': gap_hits[-10:]
        }
    }


def analyze_rhythm(content):
    """分析正文的冲突/悬念/爽点/信息密度"""
    if not content or not content.strip():
        return {
            'conflict': 0, 'suspense': 0, 'pleasure': 0, 'info': 0,
            'total_chars': 0, 'segments': []
        }

    lines = content.split('\n')
    total_chars = len(content)
    segments = []

    current_segment = ''
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_segment:
                segments.append(current_segment)
                current_segment = ''
        else:
            current_segment += stripped

    if current_segment:
        segments.append(current_segment)

    if not segments:
        chunk_size = max(1, len(lines) // 4)
        for i in range(0, len(lines), chunk_size):
            seg = '\n'.join(lines[i:i + chunk_size]).strip()
            if seg:
                segments.append(seg)

    segment_scores = []
    for seg in segments:
        seg_lower = seg.lower()
        conflict = sum(1 for kw in CONFLICT_KEYWORDS if kw in seg)
        suspense = sum(1 for kw in SUSPENSE_KEYWORDS if kw in seg)
        pleasure = sum(1 for kw in PLEASURE_KEYWORDS if kw in seg)
        info = sum(1 for kw in INFO_KEYWORDS if kw in seg)
        segment_scores.append({
            'conflict': conflict, 'suspense': suspense,
            'pleasure': pleasure, 'info': info,
            'chars': len(seg)
        })

    def normalize(scores, key):
        vals = [s[key] for s in scores]
        max_v = max(vals) if vals else 1
        if max_v == 0:
            return [0] * len(vals)
        return [min(100, round(v / max_v * 100)) for v in vals]

    conflict_norm = normalize(segment_scores, 'conflict')
    suspense_norm = normalize(segment_scores, 'suspense')
    pleasure_norm = normalize(segment_scores, 'pleasure')
    info_norm = normalize(segment_scores, 'info')

    return {
        'conflict': round(sum(conflict_norm) / max(1, len(conflict_norm))),
        'suspense': round(sum(suspense_norm) / max(1, len(suspense_norm))),
        'pleasure': round(sum(pleasure_norm) / max(1, len(pleasure_norm))),
        'info': round(sum(info_norm) / max(1, len(info_norm))),
        'total_chars': total_chars,
        'segments': [
            {'conflict': conflict_norm[i], 'suspense': suspense_norm[i],
             'pleasure': pleasure_norm[i], 'info': info_norm[i]}
            for i in range(len(segment_scores))
        ]
    }


def scan_cliches(content):
    """多维度扫描正文中的 AI 味套话"""
    if not content or not content.strip():
        return {'hits': {}, 'total': 0, 'summary': ''}

    hits = {}
    text = content
    for cat_key, cat_data in DEAI_CLICHE_BANK.items():
        cat_hits = []
        for word in cat_data['words']:
            count = text.count(word)
            if count > 0:
                positions = []
                idx = text.find(word)
                while idx != -1:
                    start = max(0, idx - 10)
                    end = min(len(text), idx + len(word) + 15)
                    snippet = text[start:end].replace('\n', ' ')
                    positions.append({'pos': idx, 'snippet': snippet.strip()})
                    idx = text.find(word, idx + 1)
                cat_hits.append({'word': word, 'count': count, 'positions': positions[:3]})

        if cat_hits:
            hits[cat_key] = {
                'label': cat_data['label'],
                'icon': cat_data['icon'],
                'total': sum(h['count'] for h in cat_hits),
                'items': cat_hits,
            }

    total_hits = sum(v['total'] for v in hits.values())

    parts = []
    for cat_key, cat_data in sorted(hits.items(), key=lambda x: -x[1]['total']):
        parts.append(f'{cat_data["icon"]} {cat_data["label"]}：{cat_data["total"]} 次')

    return {
        'hits': hits,
        'total': total_hits,
        'summary': ' | '.join(parts) if parts else '✓ 未命中套话黑名单',
        'categories': list(hits.keys()),
    }
