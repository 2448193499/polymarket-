/** 段位：只看段位分，展示用 */

const TIERS = [
  { min: 0, name: '青铜判决', next: 100 },
  { min: 100, name: '白银判决', next: 300 },
  { min: 300, name: '黄金判决', next: 600 },
  { min: 600, name: '大师判决', next: 1000 },
  { min: 1000, name: '判决之神', next: null }
]

const WIN_SCORE = 15
/** 对上公开结果：站错扣经验（地板 0） */
const LOSE_SCORE = -10
const CHECKIN_STAMINA = 5
const STAMINA_MAX = 10
const VOTE_COST = 1

function tierOf(score) {
  const s = Math.max(0, score || 0)
  let cur = TIERS[0]
  for (let i = 0; i < TIERS.length; i++) {
    if (s >= TIERS[i].min) cur = TIERS[i]
  }
  const nextAt = cur.next
  const progress = nextAt == null
    ? 100
    : Math.min(100, Math.round(((s - cur.min) / (nextAt - cur.min)) * 100))
  return {
    name: cur.name,
    score: s,
    nextAt,
    progress,
    toNext: nextAt == null ? 0 : Math.max(0, nextAt - s)
  }
}

function weekKey(ts) {
  const d = new Date(ts || Date.now())
  // 简单按「年+周」粗分，够演示
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

function todayKey(ts) {
  const d = new Date(ts || Date.now())
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function winRate(wins, losses) {
  const t = (wins || 0) + (losses || 0)
  if (!t) return 0
  return Math.round(((wins || 0) / t) * 100)
}

module.exports = {
  TIERS,
  WIN_SCORE,
  LOSE_SCORE,
  CHECKIN_STAMINA,
  STAMINA_MAX,
  VOTE_COST,
  tierOf,
  weekKey,
  todayKey,
  winRate
}
