/**
 * 议题同步层
 * - 优先远程 feed（若配置了 REMOTE_FEED_URL）
 * - 否则读 polymarket_live.js
 * 密钥只放电脑 secrets/local.json，由 npm run sync 拉取。
 */

const { detectCategory } = require('./category')
const config = require('./config')

function now() {
  return Date.now()
}

function isEndDateFuture(endDate, nowMs = Date.now()) {
  if (!endDate) return false
  const t = Date.parse(String(endDate))
  if (Number.isNaN(t)) return false
  return t > nowMs
}

function mockActiveMarkets() {
  return [
    {
      externalId: 'pm_demo_fed',
      title: '美联储下次会议会降息吗？',
      body: '演示议题。本站只提供站队与评论，不涉及下注。',
      redLabel: '会降息',
      blueLabel: '不降息',
      redCount: 41,
      blueCount: 59
    },
    {
      externalId: 'pm_demo_btc',
      title: '比特币本月底会站上某个整数关口吗？',
      body: '演示议题。',
      redLabel: '会',
      blueLabel: '不会',
      redCount: 55,
      blueCount: 45
    }
  ]
}

function loadLivePack() {
  try {
    const live = require('./polymarket_live')
    if (live && (live.markets || live.resolved)) {
      return {
        markets: live.markets || [],
        resolved: live.resolved || [],
        syncedAt: live.syncedAt || now(),
        source: live.source || 'falcon'
      }
    }
  } catch (e) {}
  return null
}

function mapWinSide(market, winningOutcome) {
  const w = String(winningOutcome || market.winning_outcome || '').trim()
  if (!w) return ''
  const redEn = String(market.redLabelEn || market.side_a_outcome || 'Yes').trim()
  const blueEn = String(market.blueLabelEn || market.side_b_outcome || 'No').trim()
  if (w.toLowerCase() === redEn.toLowerCase()) return 'red'
  if (w.toLowerCase() === blueEn.toLowerCase()) return 'blue'
  if (/^(yes|up|over|true)$/i.test(w) && /^(yes|up|over|true|是|上升|大分)$/i.test(redEn)) {
    return 'red'
  }
  if (/^(no|down|under|false)$/i.test(w) && /^(no|down|under|false|否|下降|小分)$/i.test(blueEn)) {
    return 'blue'
  }
  return ''
}

function toTopic(market, index, sourceName) {
  const ext = String(market.externalId || market.condition_id || index)
  const draft = {
    id: 'ext_' + ext.replace(/^0x/, 'x'),
    externalId: ext,
    source: 'polymarket',
    title: market.title || market.question || '未命名议题',
    titleEn: market.titleEn || market.question || '',
    parentTitle: market.parentTitle || '',
    body: market.body || '',
    redLabel: (market.redLabel || market.side_a_outcome || '是').slice(0, 16),
    blueLabel: (market.blueLabel || market.side_b_outcome || '否').slice(0, 16),
    redLabelEn: market.redLabelEn || market.side_a_outcome || '',
    blueLabelEn: market.blueLabelEn || market.side_b_outcome || '',
    authorId: 'polymarket',
    authorName: sourceName === 'falcon' ? 'Falcon 同步' : 'Polymarket 同步',
    createdAt: now() - index * 3600000,
    redCount: market.redCount || 0,
    blueCount: market.blueCount || 0,
    settled: !!market.settled,
    winSide: market.winSide || '',
    winningOutcome: market.winningOutcome || market.winning_outcome || '',
    syncedAt: now(),
    slug: market.slug || '',
    endDate: market.endDate || market.end_date || ''
  }
  if (!draft.winSide && draft.winningOutcome) {
    draft.winSide = mapWinSide(draft, draft.winningOutcome)
  }
  draft.category = market.category || detectCategory(draft)
  return draft
}

function packFromLive(live) {
  const nowMs = now()
  const openMarkets = (live.markets || []).filter((m) =>
    isEndDateFuture(m.endDate || m.end_date, nowMs)
  )
  const resolved = (live.resolved || []).map((m, i) => {
    const t = toTopic(m, i, live.source)
    t.settled = true
    t.winningOutcome = m.winningOutcome || m.winning_outcome || ''
    t.winSide = m.winSide || mapWinSide(m, t.winningOutcome)
    return t
  })
  return {
    topics: openMarkets.map((m, i) => toTopic(m, i, live.source)),
    resolved,
    source: live.source,
    syncedAt: live.syncedAt,
    fromLive: true,
    totalInFile: (live.markets || []).length,
    futureCount: openMarkets.length
  }
}

function fetchTopics() {
  const live = loadLivePack()
  if (live) return packFromLive(live)
  return {
    topics: mockActiveMarkets().map((m, i) => toTopic(m, i, 'mock')),
    resolved: [],
    source: 'polymarket-mock',
    syncedAt: now(),
    fromLive: false
  }
}

/** 可选：从 HTTPS 拉 feed（需在小程序后台配置 request 合法域名） */
function fetchRemoteFeed() {
  const url = (config.REMOTE_FEED_URL || '').trim()
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 20000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
          const data = res.data
          resolve({
            markets: data.markets || [],
            resolved: data.resolved || [],
            syncedAt: data.syncedAt || now(),
            source: data.source || 'remote'
          })
        } else resolve(null)
      },
      fail() {
        resolve(null)
      }
    })
  })
}

function fetchMockTopics() {
  return fetchTopics().topics
}

module.exports = {
  mockActiveMarkets,
  fetchMockTopics,
  fetchTopics,
  fetchRemoteFeed,
  loadLivePack,
  toTopic,
  mapWinSide,
  isEndDateFuture
}
