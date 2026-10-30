/**
 * 人名 / 常见政治人物本土化（展示与同步共用）
 * 含常见截断前缀，避免 Alexandria O → 仍显示英文
 */

const PERSON_NAMES = {
  // 美国政坛
  'Alexandria Ocasio-Cortez': '奥卡西奥-科尔特斯',
  'Alexandria Ocasio Cortez': '奥卡西奥-科尔特斯',
  AOC: '奥卡西奥-科尔特斯',
  'Gavin Newsom': '加文·纽森',
  'JD Vance': '万斯',
  'J.D. Vance': '万斯',
  'J D Vance': '万斯',
  'Marco Rubio': '卢比奥',
  'Donald Trump': '特朗普',
  'Trump': '特朗普',
  'Joe Biden': '拜登',
  'Kamala Harris': '哈里斯',
  'Ron DeSantis': '德桑蒂斯',
  'Nikki Haley': '黑利',
  'Robert F. Kennedy Jr.': '小肯尼迪',
  'RFK Jr.': '小肯尼迪',
  'Pete Buttigieg': '布蒂吉格',
  'Josh Shapiro': '夏皮罗',
  'Xavier Becerra': '贝塞拉',
  'Steve Hilton': '希尔顿',
  'James Talarico': '塔拉里克',
  'Ken Paxton': '帕克斯顿',
  'Abdul El-Sayed': '赛义德',
  'Mike Rogers': '罗杰斯',
  'Greg Abbott': '阿博特',
  'Gina Hinojosa': '希诺霍萨',

  // 法国
  'Marine Le Pen': '勒庞',
  'Édouard Philippe': '菲利普',
  'Edouard Philippe': '菲利普',
  'Emmanuel Macron': '马克龙',
  'Jordan Bardella': '巴尔德拉',

  // 以色列等
  'Benjamin Netanyahu': '内塔尼亚胡',
  'Netanyahu': '内塔尼亚胡',
  'Gadi Eisenkot': '艾森科特',

  // 球队短名已在 labelMap；战队可保留
  'Gen.G': 'Gen.G',
  T1: 'T1'
}

function normalizeKey(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, "'")
}

function localizePersonName(label) {
  const key = normalizeKey(label)
  if (!key) return key

  if (PERSON_NAMES[key]) return PERSON_NAMES[key]

  const lower = key.toLowerCase()
  for (const en of Object.keys(PERSON_NAMES)) {
    if (en.toLowerCase() === lower) return PERSON_NAMES[en]
  }

  // 截断匹配：Alexandria O / Marine Le Pe / Édouard Phil
  if (key.length >= 6 && /[A-Za-zÀ-ÿ]/.test(key)) {
    let best = null
    let bestLen = 0
    for (const en of Object.keys(PERSON_NAMES)) {
      if (
        en.toLowerCase().startsWith(lower) ||
        lower.startsWith(en.toLowerCase().slice(0, Math.min(en.length, key.length)))
      ) {
        // 要求前缀足够像
        const pref = en.toLowerCase().slice(0, key.length)
        if (pref === lower || en.toLowerCase().startsWith(lower)) {
          if (en.length > bestLen) {
            best = PERSON_NAMES[en]
            bestLen = en.length
          }
        }
      }
    }
    if (best) return best
  }

  // 去掉党派后缀再试：James Talarico (D)
  const noParty = key.replace(/\s*\([DR]\)\s*$/i, '').trim()
  if (noParty !== key) {
    const again = localizePersonName(noParty)
    if (again !== noParty) return again
  }

  return key
}

module.exports = {
  PERSON_NAMES,
  localizePersonName
}
