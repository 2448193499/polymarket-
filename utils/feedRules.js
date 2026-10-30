/**
 * 议题同步硬规则（唯一权威）
 * — 每次 npm run sync / 小程序展示都必须遵守 —
 *
 * 产品约定（对话沉淀）：
 * 1. 只要 Polymarket 首页级「大论点」（高成交、可站队）
 * 2. 不要猜比分 / 让分 / O/U / 盘口子盘 / 短周期币价档
 * 3. 竞技只留冠军/赛季赢家；不要「某队某日会不会赢」（缺对手与赛事）
 * 4. 标题展示层中文化（见 localizeDisplay / sync 翻译）；人名品牌可保留原文
 * 5. 分类见 category.js（政治/体育/电竞/加密/财经/科技…）
 */

const MIN_EVENT_VOLUME = 200000

function textOf(topicOrTitle) {
  if (topicOrTitle == null) return ''
  if (typeof topicOrTitle === 'string') return topicOrTitle
  return [
    topicOrTitle.question,
    topicOrTitle.title,
    topicOrTitle.titleEn,
    topicOrTitle.parentTitle
  ]
    .map((x) => String(x || ''))
    .join(' ')
}

/** @returns {string|null} 拒绝原因；null 表示通过「丢弃规则」检查 */
function rejectReasonSkip(question) {
  const t = String(question || '')
  if (!t.trim()) return 'empty'

  if (/比分|猜分|净胜|让球|让分|大小球/.test(t)) return 'score_or_handicap_zh'
  if (/correct score|exact score|final score|scoreline|match score/i.test(t))
    return 'score_en'
  if (/both teams to score|\bBTTS\b/i.test(t)) return 'btts'
  if (/to win \d+ games/i.test(t)) return 'win_n_games'
  if (/to win by\b|\bwin by \d|margin of victory/i.test(t)) return 'win_by_margin'
  if (/Games Total:|Game Handicap:|Rounds Handicap|Series .+ Handicap/i.test(t))
    return 'games_total_or_handicap'
  if (/\bO\/U\s*\d/i.test(t) || /\bOver\/Under\b/i.test(t)) return 'over_under'
  if (/\bSpread:/i.test(t) || /Asian handicap|point spread/i.test(t))
    return 'spread'
  if (/total (points|goals|runs|maps|rounds)\b/i.test(t)) return 'totals'
  if (/most (points|goals|runs)\b/i.test(t)) return 'most_stats'
  if (/-\s*Game\s+\d+\s+Winner/i.test(t)) return 'game_n_winner'
  if (/map \d+ winner|set \d+ winner/i.test(t)) return 'map_set_winner'

  // 缺对手/赛事的单日胜负
  if (/\bwill .+\bwin on 20\d{2}-\d{2}-\d{2}/i.test(t)) return 'win_on_date_en'
  if (/会在\s*20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日\s*获胜吗/.test(t))
    return 'win_on_date_zh'

  if (
    /\svs\.?\s/i.test(t) &&
    !/champion|winner|election|nominee|presidential|final|world cup|super bowl|grand final/i.test(
      t
    )
  ) {
    return 'daily_matchup_vs'
  }

  if (/inches of snow/i.test(t)) return 'weather_snow'
  if (/tweets from .+ to .+/i.test(t)) return 'tweet_range'
  if (/# tweets|Elon Musk # tweets/i.test(t)) return 'tweet_count'
  if (/# of seats\?/i.test(t)) return 'seat_count'
  if (/Up or Down this week/i.test(t)) return 'weekly_updown'
  if (/Up or Down\s*-/i.test(t)) return 'intraday_updown'

  if (
    /(?:Bitcoin|Ethereum|Solana|XRP).{0,40}(?:above|below|between).{0,40}\bon\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/i.test(
      t
    )
  ) {
    return 'crypto_day_ladder'
  }
  if (/What price will (Bitcoin|Ethereum) hit October\s+\d/i.test(t))
    return 'crypto_week_ladder'

  return null
}

function shouldSkipMarket(question) {
  return rejectReasonSkip(question) != null
}

function looksLikeSports(question) {
  const t = String(question || '')
  return (
    /\b(NBA|NFL|NHL|MLB|UFC|FIFA|UEFA|Premier League|La Liga|Serie A|Bundesliga|Ligue 1|F1|Formula|LoL|League of Legends|Worlds|Esports|Champion|Championship|Super Bowl|World Cup|Olympics|ATP|WTA|Grand Slam)\b/i.test(
      t
    ) ||
    /\b(Pro Football|Soccer|Football|Basketball|Baseball|Hockey|Tennis|Cricket|MMA)\b/i.test(
      t
    ) ||
    /\b(FC|CF|United|City|Rangers|Lakers|Yankees|Spurs|Thunder|49ers|Bills|Barcelona|Paris Saint-Germain|Gen\.G|T1)\b/i.test(
      t
    ) ||
    /美式橄榄球|欧冠|足球|篮球|橄榄球|电竞|英雄联盟/.test(t)
  )
}

/** 竞技：只允许冠军/赛季赢家类 */
function isSportsWhoWinsOnly(question) {
  const t = String(question || '')
  if (!looksLikeSports(t)) return true

  if (/\bwill .+\bwin on 20\d{2}-\d{2}-\d{2}/i.test(t)) return false
  if (/会在\s*20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日\s*获胜吗/.test(t))
    return false

  if (
    /champion|grand final|冠军|夺冠/i.test(t) ||
    /\bwho will win\b/i.test(t) ||
    /:\s*Winner\b/i.test(t) ||
    /:\s*20\d{2}\s*赛季冠军/.test(t) ||
    /全球总决赛.+冠军/.test(t)
  ) {
    return true
  }
  return false
}

function isHomepageEvent(event, minVolume = MIN_EVENT_VOLUME) {
  const title = event?.title || ''
  if (shouldSkipMarket(title)) return false
  if (!isSportsWhoWinsOnly(title)) return false
  const vol = Number(event.volume || event.volume24hr || 0)
  if (vol > 0 && vol < minVolume) return false
  return true
}

/**
 * 统一准入：同步写入前、小程序列表展示前都调用
 * @returns {{ ok: boolean, reason?: string }}
 */
function evaluateTopic(topicOrTitle) {
  const t = textOf(topicOrTitle)
  const skip = rejectReasonSkip(t)
  if (skip) return { ok: false, reason: skip }
  if (!isSportsWhoWinsOnly(t)) return { ok: false, reason: 'sports_not_champion' }
  return { ok: true }
}

function isTopicAllowed(topicOrTitle) {
  return evaluateTopic(topicOrTitle).ok
}

/** 同步结束前再滤一遍，防止漏网 */
function filterAllowedMarkets(list) {
  const kept = []
  const rejected = {}
  ;(list || []).forEach((m) => {
    const r = evaluateTopic(m)
    if (r.ok) kept.push(m)
    else rejected[r.reason] = (rejected[r.reason] || 0) + 1
  })
  return { kept, rejected }
}

module.exports = {
  MIN_EVENT_VOLUME,
  shouldSkipMarket,
  rejectReasonSkip,
  isSportsWhoWinsOnly,
  looksLikeSports,
  isHomepageEvent,
  evaluateTopic,
  isTopicAllowed,
  filterAllowedMarkets,
  RULES_VERSION: 2
}
