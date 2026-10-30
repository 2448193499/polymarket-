const rank = require('./rank')
const polymarket = require('./polymarket')
const category = require('./category')
const topicHumanize = require('./topicHumanize')
const localizeDisplay = require('./localizeDisplay')
const config = require('./config')

const KEY = 'panjue_v5'
/** 第一版关闭用户自由发题，议题以同步为主 */
const ALLOW_USER_CREATE = false

function now() {
  return Date.now()
}

function uid(prefix) {
  return `${prefix}_${now()}_${Math.floor(Math.random() * 10000)}`
}

const NICK_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 一个月只能改一次

function blankProfile() {
  return {
    stamina: rank.CHECKIN_STAMINA,
    staminaMax: rank.STAMINA_MAX,
    lastCheckIn: '',
    nickChangedAt: 0,
    rankScore: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    weekScore: 0,
    weekKey: rank.weekKey()
  }
}

function nextNickChangeAt(user) {
  const last = Number(user.nickChangedAt) || 0
  if (!last) return 0
  return last + NICK_COOLDOWN_MS
}

function canChangeNick(user) {
  const next = nextNickChangeAt(user)
  return !next || now() >= next
}

function defaultSeed() {
  const pack = polymarket.fetchTopics()
  const topics = pack.topics
  const comments = []
  if (topics[0]) {
    comments.push(
      {
        id: 'c_pm_1',
        topicId: topics[0].id,
        userId: 'seed_1',
        userName: '宏观观察',
        side: 'blue',
        content: '先看兑现条件与截止时间，别只跟标题情绪走。',
        likes: 28,
        createdAt: now() - 5000000,
        likedBy: []
      },
      {
        id: 'c_pm_2',
        topicId: topics[0].id,
        userId: 'seed_2',
        userName: '对立位',
        side: 'red',
        content: '盘面叙事已经定价过一轮，站队前先问「谁在错价」。',
        likes: 19,
        createdAt: now() - 4000000,
        likedBy: []
      }
    )
  }
  return {
    user: Object.assign(
      {
        id: 'user_local',
        nickName: '看客甲',
        loggedIn: true
      },
      blankProfile()
    ),
    board: [
      { id: 'b1', nickName: '一眼判准', rankScore: 1280, weekScore: 90, wins: 86, losses: 22 },
      { id: 'b2', nickName: '不跟风', rankScore: 860, weekScore: 70, wins: 54, losses: 19 },
      { id: 'b3', nickName: '冷静旁观', rankScore: 620, weekScore: 55, wins: 41, losses: 18 },
      { id: 'b4', nickName: '多数预言', rankScore: 410, weekScore: 40, wins: 28, losses: 14 },
      { id: 'b5', nickName: '海珠租客', rankScore: 240, weekScore: 25, wins: 16, losses: 11 },
      { id: 'b6', nickName: '上岸党', rankScore: 150, weekScore: 18, wins: 11, losses: 9 }
    ],
    topics,
    votes: [],
    comments,
    syncMeta: {
      lastSyncAt: pack.syncedAt || now(),
      source: pack.source,
      count: topics.length,
      note: pack.fromLive
        ? '已载入 Falcon 真数据（npm run sync）。'
        : '当前是本地 mock。请在项目目录运行 npm run sync。'
    }
  }
}

function read() {
  try {
    const data = wx.getStorageSync(KEY)
    if (data && data.topics) return data
  } catch (e) {}
  return null
}

function write(data) {
  wx.setStorageSync(KEY, data)
}

function migrate(state) {
  if (!state.user) state.user = {}
  state.user = Object.assign(blankProfile(), state.user)
  const wk = rank.weekKey()
  if (state.user.weekKey !== wk) {
    state.user.weekKey = wk
    state.user.weekScore = 0
  }
  if (!state.board) state.board = defaultSeed().board
  if (!state.syncMeta) {
    state.syncMeta = {
      lastSyncAt: 0,
      source: 'none',
      note: ''
    }
  }
  ;(state.topics || []).forEach((t) => {
    if (typeof t.settled !== 'boolean') t.settled = false
    if (!t.winSide) t.winSide = ''
    if (!t.source) t.source = t.externalId ? 'polymarket' : 'local'
  })
  // 一次性把缓存标题中文化，并把旧「同步说明」换成论点解释
  if (!state._localizedTitlesV5) {
    try {
      ;(state.topics || []).forEach((t) => {
        if (!t || typeof t !== 'object') return
        const fixed = localizeDisplay.localizeTopic(t)
        if (!fixed) return
        t.title = fixed.title
        t.redLabel = fixed.redLabel
        t.blueLabel = fixed.blueLabel
        t.body = fixed.body
      })
      state._localizedTitlesV5 = 1
      state._localizedTitlesV4 = 1
      state._localizedTitlesV3 = 1
      state._localizedTitlesV2 = 1
    } catch (e) {
      console.warn('localize migrate skip', e)
      state._localizedTitlesV5 = 1
    }
  }
  return state
}

function ensureSeed() {
  let data = read()
  if (!data || !Array.isArray(data.topics) || !data.topics.length) {
    write(defaultSeed())
    data = read()
  }
  try {
    data = migrate(data || defaultSeed())
  } catch (e) {
    console.warn('migrate fail, reseed', e)
    data = defaultSeed()
  }
  if (!data.topics || !data.topics.length) {
    data = defaultSeed()
  }
  write(data)
  return data
}

function getState() {
  return ensureSeed()
}

function saveState(state) {
  write(migrate(state))
}

function enrichUser(user) {
  const tier = rank.tierOf(user.rankScore)
  const checkedIn = user.lastCheckIn === rank.todayKey()
  return Object.assign({}, user, {
    tierName: tier.name,
    tierProgress: tier.progress,
    toNext: tier.toNext,
    nextAt: tier.nextAt,
    winRate: rank.winRate(user.wins, user.losses),
    checkedIn,
    voteCost: rank.VOTE_COST,
    canChangeNick: canChangeNick(user),
    nextNickChangeAt: nextNickChangeAt(user),
    nickCooldownDays: (() => {
      const next = nextNickChangeAt(user)
      if (!next || now() >= next) return 0
      return Math.ceil((next - now()) / (24 * 60 * 60 * 1000))
    })()
  })
}

function getUser() {
  return enrichUser(getState().user)
}

function setUser(patch) {
  const state = getState()
  state.user = Object.assign({}, state.user, patch)
  saveState(state)
  return enrichUser(state.user)
}

/** 改昵称：首次设置不占用冷却；之后每 30 天最多一次 */
function changeNickName(name) {
  const state = getState()
  const next = (name || '').trim()
  if (!next) return { ok: false, message: '昵称不能为空' }
  if (next.length > 12) return { ok: false, message: '昵称最多 12 字' }

  const prev = (state.user.nickName || '').trim()
  if (next === prev) return { ok: false, message: '和现在一样，不用改' }

  const last = Number(state.user.nickChangedAt) || 0
  // 已登录且曾经改过名（或首次登录后的再次修改）才进入冷却
  if (last && now() < last + NICK_COOLDOWN_MS) {
    const left = last + NICK_COOLDOWN_MS - now()
    const days = Math.ceil(left / (24 * 60 * 60 * 1000))
    return { ok: false, message: `一个月只能改一次，约 ${days} 天后可再改` }
  }

  state.user.nickName = next
  state.user.nickChangedAt = now()
  saveState(state)
  return { ok: true, user: enrichUser(state.user) }
}

function listTopics() {
  const state = getState()
  const topics = (state && state.topics) || []
  return topics
    .slice()
    .filter((t) => t && t.id && topicHumanize.humanizeTopic(t) !== null)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((t) => enrichTopic(t, state))
}

function getTopic(id) {
  const state = getState()
  const topic = state.topics.find((t) => t.id === id)
  if (!topic) return null
  return enrichTopic(topic, state)
}

function enrichTopic(topic, state) {
  const total = topic.redCount + topic.blueCount
  const redPct = total ? Math.round((topic.redCount / total) * 100) : 50
  const bluePct = total ? 100 - redPct : 50
  const myVote = state.votes.find(
    (v) => v.topicId === topic.id && v.userId === state.user.id
  )
  const comments = state.comments
    .filter((c) => c.topicId === topic.id)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
  const redRep = pickRep(comments, 'red')
  const blueRep = pickRep(comments, 'blue')
  const humanized = topicHumanize.applyHumanize(topic) || topic
  const base = localizeDisplay.localizeTopic(humanized)
  return category.withCategory(
    Object.assign({}, base, {
      total,
      redPct,
      bluePct,
      mySide: myVote ? myVote.side : '',
      commentCount: comments.length,
      redRep,
      blueRep,
      canSettle: false,
      waitingResult: !topic.settled && !!myVote
    })
  )
}

function pickRep(comments, side) {
  const list = comments.filter((c) => c.side === side)
  if (!list.length) return null
  list.sort((a, b) => {
    if (b.likes !== a.likes) return b.likes - a.likes
    return a.createdAt - b.createdAt
  })
  return list[0]
}

function createTopic({ title, body, redLabel, blueLabel }) {
  if (!ALLOW_USER_CREATE) {
    return { ok: false, message: '暂不开放自由发题，议题由 Polymarket 同步' }
  }
  const state = getState()
  const topic = {
    id: uid('topic'),
    source: 'local',
    title: title.trim(),
    body: (body || '').trim(),
    redLabel: (redLabel || '红方').trim(),
    blueLabel: (blueLabel || '蓝方').trim(),
    authorId: state.user.id,
    authorName: state.user.nickName,
    createdAt: now(),
    redCount: 0,
    blueCount: 0,
    settled: false,
    winSide: ''
  }
  state.topics.unshift(topic)
  saveState(state)
  return { ok: true, topic }
}

function applyOutcomeToUser(state, topic, winSide) {
  const myVote = state.votes.find(
    (v) => v.topicId === topic.id && v.userId === state.user.id
  )
  if (!myVote || topic.settled) return null

  topic.settled = true
  topic.winSide = winSide

  const wk = rank.weekKey()
  if (state.user.weekKey !== wk) {
    state.user.weekKey = wk
    state.user.weekScore = 0
  }

  const won = myVote.side === winSide
  if (won) {
    state.user.wins = (state.user.wins || 0) + 1
    state.user.streak = (state.user.streak || 0) + 1
    state.user.rankScore = (state.user.rankScore || 0) + rank.WIN_SCORE
    state.user.weekScore = (state.user.weekScore || 0) + rank.WIN_SCORE
  } else {
    state.user.losses = (state.user.losses || 0) + 1
    state.user.streak = 0
    state.user.rankScore = Math.max(
      0,
      (state.user.rankScore || 0) + rank.LOSE_SCORE
    )
  }
  return { won, delta: won ? rank.WIN_SCORE : rank.LOSE_SCORE }
}

/**
 * 合并议题包：已有结果 → 结算；进行中 → 填补列表空缺
 * pack: { topics, resolved, source, fromLive, syncedAt }
 */
function applyFeedPack(pack) {
  const state = getState()
  const byExt = {}
  ;(state.topics || []).forEach((t) => {
    if (t.externalId) byExt[t.externalId] = t
  })

  let settledCount = 0
  ;(pack.resolved || []).forEach((resTopic) => {
    const old = byExt[resTopic.externalId]
    const winSide =
      resTopic.winSide ||
      polymarket.mapWinSide(resTopic, resTopic.winningOutcome)
    if (!winSide) return
    if (old) {
      // 覆盖旧缓存英文标题 / 标签
      old.title = resTopic.title || old.title
      old.titleEn = resTopic.titleEn || old.titleEn
      old.redLabel = resTopic.redLabel || old.redLabel
      old.blueLabel = resTopic.blueLabel || old.blueLabel
      old.body = resTopic.body || old.body
      old.category = resTopic.category || old.category
      if (!old.settled) {
        const r = applyOutcomeToUser(state, old, winSide)
        if (r) settledCount += 1
      } else {
        old.winSide = old.winSide || winSide
        old.winningOutcome = resTopic.winningOutcome || old.winningOutcome
      }
    } else {
      const copy = Object.assign({}, resTopic, {
        settled: true,
        winSide,
        redCount: resTopic.redCount || 0,
        blueCount: resTopic.blueCount || 0
      })
      state.topics.push(copy)
      byExt[copy.externalId] = copy
    }
  })

  const incoming = pack.topics || []
  const mergedOpen = incoming.map((neu) => {
    const old = byExt[neu.externalId]
    if (!old) return neu
    return Object.assign({}, neu, {
      redCount: old.redCount,
      blueCount: old.blueCount,
      settled: old.settled,
      winSide: old.winSide,
      id: old.id
    })
  })

  const openIds = {}
  mergedOpen.forEach((t) => {
    openIds[t.externalId || t.id] = true
  })

  // 保留：本地帖、已结算、用户已站队但仍未出结果的旧题
  const kept = (state.topics || []).filter((t) => {
    if (t.source === 'local') return true
    if (t.settled) return true
    const voted = state.votes.some(
      (v) => v.topicId === t.id && v.userId === state.user.id
    )
    if (voted && !openIds[t.externalId || t.id]) return true
    return false
  })

  const keptExt = {}
  kept.forEach((t) => {
    if (t.externalId) keptExt[t.externalId] = true
  })
  const fillers = mergedOpen.filter((t) => !keptExt[t.externalId])

  state.topics = fillers.concat(kept)
  state.syncMeta = {
    lastSyncAt: now(),
    source: pack.source,
    note:
      settledCount > 0
        ? `已结算 ${settledCount} 题，并刷新进行中议题。`
        : pack.fromLive
          ? '已刷新进行中议题（暂无新结算）。'
          : '未找到真数据缓存，仍用演示议题。',
    count: fillers.length,
    settledCount,
    fromLive: !!pack.fromLive
  }
  saveState(state)
  return state.syncMeta
}

/** 兼容旧名：从本地 polymarket_live 同步 */
function syncPolymarketDemo() {
  return applyFeedPack(polymarket.fetchTopics())
}

/**
 * 每小时自动同步（打开小程序时检查）
 * - 有远程 URL：拉 HTTPS feed
 * - 否则：读包内 polymarket_live.js（需电脑 npm run sync 后重新上传/热更新）
 */
function autoSyncIfDue(force) {
  const meta = getSyncMeta()
  const due =
    force ||
    !meta.lastSyncAt ||
    now() - meta.lastSyncAt >= (config.SYNC_INTERVAL_MS || 3600000)

  if (!due) {
    return Promise.resolve(
      Object.assign({}, meta, { skipped: true, reason: '未到 1 小时' })
    )
  }

  return polymarket.fetchRemoteFeed().then((remote) => {
    if (remote) {
      const topics = (remote.markets || [])
        .filter((m) =>
          polymarket.isEndDateFuture(m.endDate || m.end_date, now())
        )
        .map((m, i) => polymarket.toTopic(m, i, remote.source))
      const resolved = (remote.resolved || []).map((m, i) => {
        const t = polymarket.toTopic(m, i, remote.source)
        t.settled = true
        t.winningOutcome = m.winningOutcome || m.winning_outcome || ''
        t.winSide = m.winSide || polymarket.mapWinSide(m, t.winningOutcome)
        return t
      })
      return applyFeedPack({
        topics,
        resolved,
        source: remote.source,
        syncedAt: remote.syncedAt,
        fromLive: true
      })
    }
    return syncPolymarketDemo()
  })
}

function getSyncMeta() {
  const state = getState()
  return state.syncMeta || { lastSyncAt: 0, source: 'none', note: '' }
}

function checkIn() {
  const state = getState()
  const today = rank.todayKey()
  if (state.user.lastCheckIn === today) {
    return { ok: false, message: '今天已经签到过了' }
  }
  state.user.lastCheckIn = today
  state.user.stamina = Math.min(
    state.user.staminaMax || rank.STAMINA_MAX,
    (state.user.stamina || 0) + rank.CHECKIN_STAMINA
  )
  saveState(state)
  return {
    ok: true,
    stamina: state.user.stamina,
    gained: rank.CHECKIN_STAMINA
  }
}

function vote(topicId, side) {
  const state = getState()
  const topic = state.topics.find((t) => t.id === topicId)
  if (!topic) return { ok: false, message: '议题不存在' }
  if (topic.settled) return { ok: false, message: '议题已结算，不能再站队' }
  const existing = state.votes.find(
    (v) => v.topicId === topicId && v.userId === state.user.id
  )
  if (existing) return { ok: false, message: '第一版不能改边' }

  const cost = rank.VOTE_COST
  if ((state.user.stamina || 0) < cost) {
    return { ok: false, message: '体力不足，先去「我的」签到' }
  }

  state.user.stamina -= cost
  state.votes.push({
    topicId,
    userId: state.user.id,
    side,
    createdAt: now()
  })
  if (side === 'red') topic.redCount += 1
  else topic.blueCount += 1
  saveState(state)
  return { ok: true, stamina: state.user.stamina }
}

/** 演示结算：按当前票数多数判胜负，给本机用户加减段位分 */
function settleTopic(topicId) {
  const state = getState()
  const topic = state.topics.find((t) => t.id === topicId)
  if (!topic) return { ok: false, message: '议题不存在' }
  if (topic.settled) return { ok: false, message: '已经结算过了' }

  const myVote = state.votes.find(
    (v) => v.topicId === topicId && v.userId === state.user.id
  )
  if (!myVote) return { ok: false, message: '你还没站队，结算不计你的成绩' }

  let winSide = 'red'
  if (topic.blueCount > topic.redCount) winSide = 'blue'
  else if (topic.blueCount === topic.redCount) {
    return { ok: false, message: '双方票数相同，暂不结算' }
  }

  topic.settled = true
  topic.winSide = winSide
  const won = myVote.side === winSide

  // 周榜跨周
  const wk = rank.weekKey()
  if (state.user.weekKey !== wk) {
    state.user.weekKey = wk
    state.user.weekScore = 0
  }

  if (won) {
    state.user.wins = (state.user.wins || 0) + 1
    state.user.streak = (state.user.streak || 0) + 1
    state.user.rankScore = (state.user.rankScore || 0) + rank.WIN_SCORE
    state.user.weekScore = (state.user.weekScore || 0) + rank.WIN_SCORE
  } else {
    state.user.losses = (state.user.losses || 0) + 1
    state.user.streak = 0
    state.user.rankScore = Math.max(
      0,
      (state.user.rankScore || 0) + rank.LOSE_SCORE
    )
  }

  saveState(state)
  return {
    ok: true,
    won,
    winSide,
    winLabel: winSide === 'red' ? topic.redLabel : topic.blueLabel,
    delta: won ? rank.WIN_SCORE : rank.LOSE_SCORE,
    user: enrichUser(state.user)
  }
}

function listComments(topicId, filter) {
  const state = getState()
  let list = state.comments.filter((c) => c.topicId === topicId)
  if (filter === 'red' || filter === 'blue') {
    list = list.filter((c) => c.side === filter)
  }
  return list
    .slice()
    .sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt)
    .map((c) =>
      Object.assign({}, c, {
        liked: (c.likedBy || []).indexOf(state.user.id) >= 0
      })
    )
}

function addComment(topicId, content) {
  const state = getState()
  const topic = state.topics.find((t) => t.id === topicId)
  if (topic && topic.settled) return { ok: false, message: '已结算，不能再发言' }
  const myVote = state.votes.find(
    (v) => v.topicId === topicId && v.userId === state.user.id
  )
  if (!myVote) return { ok: false, message: '请先站队再发言' }
  const text = (content || '').trim()
  if (!text) return { ok: false, message: '请输入评论' }
  const comment = {
    id: uid('c'),
    topicId,
    userId: state.user.id,
    userName: state.user.nickName,
    side: myVote.side,
    content: text,
    likes: 0,
    createdAt: now(),
    likedBy: []
  }
  state.comments.push(comment)
  saveState(state)
  return { ok: true, comment }
}

function toggleLike(commentId) {
  const state = getState()
  const comment = state.comments.find((c) => c.id === commentId)
  if (!comment) return { ok: false }
  comment.likedBy = comment.likedBy || []
  const idx = comment.likedBy.indexOf(state.user.id)
  if (idx >= 0) {
    comment.likedBy.splice(idx, 1)
    comment.likes = Math.max(0, comment.likes - 1)
  } else {
    comment.likedBy.push(state.user.id)
    comment.likes += 1
  }
  saveState(state)
  return { ok: true }
}

function myTopics() {
  const state = getState()
  return state.topics
    .filter((t) => t.authorId === state.user.id)
    .map((t) => enrichTopic(t, state))
}

function myVotes() {
  const state = getState()
  return state.votes
    .filter((v) => v.userId === state.user.id)
    .map((v) => {
      const topic = state.topics.find((t) => t.id === v.topicId)
      return topic
        ? Object.assign(enrichTopic(topic, state), { mySide: v.side })
        : null
    })
    .filter(Boolean)
}

function getLeaderboard(type) {
  const state = getState()
  const me = enrichUser(state.user)
  const others = (state.board || []).map((b) => {
    const tier = rank.tierOf(b.rankScore)
    return {
      id: b.id,
      nickName: b.nickName,
      rankScore: b.rankScore || 0,
      weekScore: b.weekScore || 0,
      wins: b.wins || 0,
      losses: b.losses || 0,
      winRate: rank.winRate(b.wins, b.losses),
      tierName: tier.name,
      isMe: false
    }
  })

  const meRow = {
    id: me.id,
    nickName: me.nickName,
    rankScore: me.rankScore || 0,
    weekScore: me.weekScore || 0,
    wins: me.wins || 0,
    losses: me.losses || 0,
    winRate: me.winRate,
    tierName: me.tierName,
    isMe: true
  }

  const scoreKey = type === 'week' ? 'weekScore' : 'rankScore'
  const list = others.concat([meRow]).sort((a, b) => b[scoreKey] - a[scoreKey])
  list.forEach((row, i) => {
    row.place = i + 1
  })
  return list
}

function resetDemo() {
  write(defaultSeed())
}

module.exports = {
  ALLOW_USER_CREATE,
  ensureSeed,
  getUser,
  setUser,
  changeNickName,
  listTopics,
  getTopic,
  createTopic,
  syncPolymarketDemo,
  autoSyncIfDue,
  applyFeedPack,
  getSyncMeta,
  checkIn,
  vote,
  settleTopic,
  listComments,
  addComment,
  toggleLike,
  myTopics,
  myVotes,
  getLeaderboard,
  resetDemo
}
