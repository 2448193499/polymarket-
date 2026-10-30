/** 议题自动分类：slug / 中英标题关键字 */

const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'politics', name: '政治' },
  { id: 'sports', name: '体育' },
  { id: 'esports', name: '电竞' },
  { id: 'crypto', name: '加密' },
  { id: 'finance', name: '财经' },
  { id: 'tech', name: '科技' },
  { id: 'entertainment', name: '娱乐' },
  { id: 'weather', name: '天气' },
  { id: 'other', name: '其他' }
]

function haystack(topic) {
  return [
    topic.slug,
    topic.externalId,
    topic.title,
    topic.titleEn,
    topic.parentTitle,
    topic.body,
    topic.redLabel,
    topic.blueLabel,
    topic.redLabelEn,
    topic.blueLabelEn
  ]
    .map((x) => String(x || ''))
    .join(' ')
    .toLowerCase()
}

function detectCategory(topic) {
  const text = haystack(topic)

  // 电竞（优先于泛体育；短词必须整词，避免 lec 误伤 Election）
  if (
    /(?:^|[\s/_-])(lol|cs2|csgo|dota2?|valorant|ow2|cod|r6|worlds)(?=[\s/_-]|$)/.test(
      ' ' + text
    ) ||
    /\b(valorant|challengers|esport|esports|hanwha|gen\.g|parivision|natus vincere|vitality|astralis|cloud9|counter-strike|vct)\b/.test(
      text
    ) ||
    /\b(lck|lpl|lec)\b/.test(text) ||
    /\bt1\b/.test(text) ||
    /worlds 20\d{2}/.test(text) ||
    /英雄联盟|电竞/.test(text)
  ) {
    return 'esports'
  }

  // 政治 / 地缘
  if (
    /trump|biden|democrat|republican|election|president|congress|senate|governor|minister|parliament|politic|midterm|nominee|party will win|balance of power|iran|iranian|hormuz|blockade|regime|gaza|israel|netanyahu|nato|ukraine|russia|venezuela|maduro|特朗普|拜登|民主|共和|选举|众议院|参议院|支持率|总统|国会|战争|俄罗斯|乌克兰|伊朗|海峡|封锁|中期选举|政党/.test(
      text
    ) ||
    /which party will win the (house|senate)/i.test(text) ||
    /\bhouse in 20\d{2}\b|\bsenate in 20\d{2}\b/.test(text)
  ) {
    return 'politics'
  }

  // 加密
  if (
    /bitcoin|btc|eth(?:ereum)?|crypto|solana|xrp|token|coin|defi|nft|fdv|\$1w|predict\.fun|public sale|airdrop|比特币|以太坊|加密|币圈|代币|发币/.test(
      text
    )
  ) {
    return 'crypto'
  }

  // 财经 / 宏观（非加密）
  if (
    /fed decision|federal reserve|interest rate|bps|inflation|gdp|recession|tariff|stock market|s&p|nasdaq|dow jones|美联储|降息|加息|利率|通胀|关税|股市|财报/.test(
      text
    ) ||
    /\bno change\b.*\bbps\b|\bbps\b.*\bno change\b/.test(text)
  ) {
    return 'finance'
  }

  // 科技
  if (
    /ai model|openai|anthropic|google|nvidia|apple|microsoft|meta|tesla|largest company|semiconductor|chip|科技|人工智能|英伟达|苹果|芯片/.test(
      text
    )
  ) {
    return 'tech'
  }

  // 天气
  if (
    /snow|rain|weather|temperature|hurricane|storm|inch(?:es)? of snow|celsius|fahrenheit|积雪|下雨|降雨|天气|飓风|暴风/.test(
      text
    )
  ) {
    return 'weather'
  }

  // 娱乐
  if (
    /rotten tomatoes|tomatometer|mrbeast|youtube|box office|oscar|grammy|emmy|netflix|movie|film|album|celebrity|烂番茄|票房|电影|影视|综艺|明星/.test(
      text
    )
  ) {
    return 'entertainment'
  }

  // 体育：联赛/俱乐部/冠军 + 「某队某日是否获胜」
  if (
    /(?:^|[\s/-])(nba|nfl|mlb|nhl|epl|ufc|ncaaf|ncaab|uefa|fifa)[-/\s]/.test(
      ' ' + text
    ) ||
    /soccer|football|basketball|tennis|boxing|mlb|nfl|nba|nhl|ufc|super bowl|world cup|premier league|champions league|la liga|serie a|bundesliga|ligue 1|pro football|f1|formula 1|体育|足球|篮球|网球|拳击|橄榄球|世界杯|欧冠|西甲|英超/.test(
      text
    ) ||
    /\b(fc|cf|united|city|spurs|thunder|49ers|bills|barcelona|paris saint-germain|lakers|yankees|stade|almer[ií]a|lorient|tondela|freiburg|stuttgart|brestois|aldosivi)\b/.test(
      text
    ) ||
    /\bwill .+\bwin on 20\d{2}-\d{2}-\d{2}/i.test(text) ||
    (/:\s*20\d{2} champion\b|\bchampion\b/.test(text) &&
      /nba|nfl|uefa|fifa|football|soccer|basketball|league|club/i.test(text))
  ) {
    return 'sports'
  }

  // 兜底：带 Champion / Winner 且不像政治的，进体育
  if (
    /\b(champion|winner)\b/.test(text) &&
    !/election|president|nominee|governor|senate|house|party/.test(text)
  ) {
    return 'sports'
  }

  return 'other'
}

function withCategory(topic) {
  // 始终按最新规则重算，避免旧缓存卡死错误分类
  const category = detectCategory(topic)
  const found = CATEGORIES.find((c) => c.id === category)
  return Object.assign({}, topic, {
    category,
    categoryName: found ? found.name : '其他'
  })
}

function buildCategoryTabs(topics) {
  const counts = { all: topics.length }
  topics.forEach((t) => {
    // 与列表筛选同一规则，避免「侧栏有数、右侧为空」
    const id = detectCategory(t)
    counts[id] = (counts[id] || 0) + 1
  })
  return CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    count: counts[c.id] || 0
  })).filter((c) => c.id === 'all' || c.count > 0)
}

module.exports = {
  CATEGORIES,
  detectCategory,
  withCategory,
  buildCategoryTabs
}
