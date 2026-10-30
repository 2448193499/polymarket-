/**
 * 议题同步：优先 Polymarket Gamma（首页热门大议题）
 * Falcon 仅作备用；翻译 + 术语表本土化 → utils/polymarket_live.js
 * 运行：npm run sync
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { translate } from '@vitalets/google-translate-api'

const require = createRequire(import.meta.url)
const { eventBaseSlug } = require('../utils/topicHumanize.js')
const { detectCategory } = require('../utils/category.js')
const feedRules = require('../utils/feedRules.js')
const { buildTopicBlurb } = require('../utils/localizeDisplay.js')
const { localizePersonName } = require('../utils/personNames.js')
const {
  shouldSkipMarket,
  isSportsWhoWinsOnly,
  isHomepageEvent,
  filterAllowedMarkets,
  RULES_VERSION
} = feedRules

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const secFile = path.join(root, 'secrets', 'local.json')
const glossaryFile = path.join(root, 'utils', 'localize-zh.json')
const translateCacheFile = path.join(root, 'utils', 'translate_cache.json')
const outJs = path.join(root, 'utils', 'polymarket_live.js')
const rawOut = path.join(root, 'utils', 'falcon_raw.json')

const FALCON_URL =
  'https://narrative.agent.heisenberg.so/api/v2/semantic/retrieve/parameterized'
const GAMMA_EVENTS_URL = 'https://gamma-api.polymarket.com/events'
const gammaRawOut = path.join(root, 'utils', 'gamma_raw.json')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function truncate(s, max = 16) {
  if (!s) return s
  return s.length <= max ? s : s.slice(0, max)
}

function loadGlossary() {
  return JSON.parse(fs.readFileSync(glossaryFile, 'utf8'))
}

function phraseToRegExp(pattern) {
  let flags = ''
  let src = pattern
  if (src.startsWith('(?i)')) {
    flags = 'i'
    src = src.slice(4)
  }
  return new RegExp(src, flags)
}

function applyPhrasePatterns(text, glossary) {
  for (const p of glossary.phrases || []) {
    const re = phraseToRegExp(p.pattern)
    const m = text.match(re)
    if (m) {
      let out = p.zh
      for (let i = 1; i < m.length; i++) {
        out = out.replace('$' + i, m[i])
      }
      return out
    }
  }
  return null
}

function applyTerms(text, glossary) {
  let out = text
  const terms = [...(glossary.terms || [])].sort(
    (a, b) => b.en.length - a.en.length
  )
  for (const t of terms) {
    if (!t.en) continue
    const esc = t.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 短英文词必须整词匹配，避免 No→否 把 Nominee 弄成 否minee
    const re = /^[A-Za-z]/.test(t.en)
      ? new RegExp(`\\b${esc}\\b`, 'gi')
      : new RegExp(esc, 'gi')
    out = out.replace(re, t.zh)
  }
  return out
}

function loadTranslateCache() {
  try {
    if (!fs.existsSync(translateCacheFile)) return {}
    return JSON.parse(
      fs.readFileSync(translateCacheFile, 'utf8').replace(/^\uFEFF/, '')
    )
  } catch {
    return {}
  }
}

function saveTranslateCache(cache) {
  fs.writeFileSync(translateCacheFile, JSON.stringify(cache, null, 2), 'utf8')
}

function monthZh(s) {
  return String(s || '')
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi, (_, mon, y) => {
      const map = {
        january: '1', february: '2', march: '3', april: '4', may: '5', june: '6',
        july: '7', august: '8', september: '9', october: '10', november: '11', december: '12'
      }
      return `${y}年${map[mon.toLowerCase()]}月`
    })
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/gi, (_, mon, d) => {
      const map = {
        january: '1', february: '2', march: '3', april: '4', may: '5', june: '6',
        july: '7', august: '8', september: '9', october: '10', november: '11', december: '12'
      }
      return `${map[mon.toLowerCase()]}月${d}日`
    })
    .replace(/\bJanuary\b/gi, '1月')
    .replace(/\bFebruary\b/gi, '2月')
    .replace(/\bMarch\b/gi, '3月')
    .replace(/\bApril\b/gi, '4月')
    .replace(/\bMay\b/gi, '5月')
    .replace(/\bJune\b/gi, '6月')
    .replace(/\bJuly\b/gi, '7月')
    .replace(/\bAugust\b/gi, '8月')
    .replace(/\bSeptember\b/gi, '9月')
    .replace(/\bOctober\b/gi, '10月')
    .replace(/\bNovember\b/gi, '11月')
    .replace(/\bDecember\b/gi, '12月')
}

function sportZh(s) {
  return String(s || '')
    .replace(/^Pro Football$/i, '美式橄榄球')
    .replace(/^UEFA Champions League$/i, '欧冠')
    .replace(/^NBA$/i, 'NBA')
    .replace(/^F1 Drivers'? Champion$/i, 'F1车手冠军')
}

function officeZh(s) {
  return String(s || '')
    .replace(/^California Governor$/i, '加州州长')
    .replace(/^Texas Governor$/i, '得州州长')
    .replace(/^Texas Senate$/i, '得州联邦参议员')
    .replace(/^Michigan Senate$/i, '密歇根联邦参议员')
    .replace(/^Israeli Legislative$/i, '以色列议会')
}

function clubZh(name) {
  const n = String(name || '').trim()
  const map = {
    'Stade Brestois 29': '布雷斯特',
    'VfB Stuttgart': '斯图加特',
    'CD Tondela': '通德拉',
    'FC Lorient': '洛里昂',
    'UD Almería': '阿尔梅里亚',
    'UD Almeria': '阿尔梅里亚',
    'CA Aldosivi': '奥尔多西维',
    'SC Freiburg': '弗赖堡',
    'FC Volendam': '福伦丹',
    'Will Stade Brestois 29': '布雷斯特'
  }
  if (map[n]) return map[n]
  // 去掉 FC/CF/UD/CD/CA/SC 前缀，读起来更像中文标题
  return n.replace(/^(FC|CF|UD|CD|CA|SC|AFC|SSC)\s+/i, '')
}

function isoDateZh(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

function yearZh(s) {
  const t = monthZh(s)
  if (/^\d{4}$/.test(t)) return `${t}年`
  return t
}

/** 常见英文标题模板（不依赖外网翻译） */
function heuristicTranslate(text) {
  let t = String(text || '').trim()
  if (!t) return null

  let m
  m = t.match(/^Will (.+?) win on (\d{4}-\d{2}-\d{2})\??$/i)
  if (m) return `${clubZh(m[1])} 会在 ${isoDateZh(m[2])} 获胜吗？`

  m = t.match(/^What price will Bitcoin hit in ([^?]+)\??$/i)
  if (m) return `比特币在 ${yearZh(m[1].trim())} 会涨到什么价位？`

  m = t.match(/^What price will Ethereum hit in ([^?]+)\??$/i)
  if (m) return `以太坊在 ${yearZh(m[1].trim())} 会涨到什么价位？`

  m = t.match(/^Predict\.fun FDV above .+ one day after launch\??$/i)
  if (m) return 'Predict.fun 上线一天后的 FDV 会高于多少？'

  m = t.match(/^Predict\.fun will launch a token before (.+)\??$/i)
  if (m) return `Predict.fun 会在 ${monthZh(m[1].trim())} 之前发行代币吗？`

  m = t.match(/^Predict\.fun 会在 .+ 之前发行代币吗？$/u)
  if (m) {
    if (/___|…|\.\.\./.test(t)) return 'Predict.fun 会在哪个日期之前发行代币？'
    return t
  }

  m = t.match(/^Total commitments for the 1win \(\$1w\) public sale$/i)
  if (m) return '1win（$1w）公募认购总金额会到多少？'

  m = t.match(/^(.+?) FDV above .+ one day after launch\??$/i)
  if (m) return `${m[1]} 上线一天后的 FDV 会高于多少？`

  m = t.match(/^(.+?): (\d{4}) Champion$/i)
  if (m) return `${sportZh(m[1].trim())}：${m[2]} 赛季冠军`

  m = t.match(/^(.+) Election Winner$/i)
  if (m) return `${officeZh(m[1].trim())}选举赢家`

  m = t.match(/^Presidential Election Winner (\d{4})$/i)
  if (m) return `${m[1]} 美国总统大选赢家`

  m = t.match(/^Democratic Presidential Nominee (\d{4})$/i)
  if (m) return `${m[1]} 民主党总统候选人`

  m = t.match(/^Republican Presidential Nominee (\d{4})$/i)
  if (m) return `${m[1]} 共和党总统候选人`

  m = t.match(/^Next French Presidential Election$/i)
  if (m) return '下一届法国总统选举'

  m = t.match(/^Which party will win the House in (\d{4})\??$/i)
  if (m) return `${m[1]} 年哪一党拿下众议院？`

  m = t.match(/^Which party will win the Senate in (\d{4})\??$/i)
  if (m) return `${m[1]} 年哪一党拿下参议院？`

  m = t.match(/^Balance of Power: (\d{4}) Midterms$/i)
  if (m) return `${m[1]} 中期选举权力格局`

  m = t.match(/^Largest Company end of ([^?]+)\??$/i)
  if (m) return `${monthZh(m[1].trim())} 结束时市值最大的公司？`

  m = t.match(/^Which company has the best AI model end of ([^?]+)\??$/i)
  if (m) return `${monthZh(m[1].trim())} 结束时哪家公司 AI 模型最强？`

  m = t.match(/^Fed Decision in ([^?]+)\??$/i)
  if (m) return `${monthZh(m[1].trim())} 美联储决议`

  m = t.match(/^Worlds (\d{4}): Winner$/i)
  if (m) return `英雄联盟全球总决赛 ${m[1]} 冠军`

  m = t.match(/^Will the Iranian regime fall before (\d{4})\??$/i)
  if (m) return `伊朗政权会在 ${m[1]} 年前倒台吗？`

  m = t.match(/^US announces end of Iranian blockade by\.\.\.\?$/i)
  if (m) return '美国会在何时宣布结束对伊朗封锁？'

  m = t.match(/^Strait of Hormuz traffic returns to normal by ([^?]+)\??$/i)
  if (m) return `霍尔木兹海峡通行会在 ${monthZh(m[1].trim())} 前恢复正常吗？`

  m = t.match(/^Will (.+?) launch a token by (.+)\??$/i)
  if (m) return `${m[1]} 会在 ${m[2]} 之前发行代币吗？`

  m = t.match(/^(.+?) will launch a token before (.+)\??$/i)
  if (m) return `${m[1]} 会在 ${m[2]} 之前发行代币吗？`

  return null
}

async function translateMyMemory(text) {
  const u = new URL('https://api.mymemory.translated.net/get')
  u.searchParams.set('q', text)
  u.searchParams.set('langpair', 'en|zh-CN')
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`)
  const json = await res.json()
  const out = json?.responseData?.translatedText
  if (!out || /MYMEMORY WARNING/i.test(out)) {
    throw new Error(out || 'MyMemory empty')
  }
  // 有时原样返回英文
  if (out.trim().toLowerCase() === text.trim().toLowerCase()) {
    throw new Error('MyMemory unchanged')
  }
  return out.trim()
}

async function machineTranslate(text) {
  try {
    const { text: machine } = await translate(text, { to: 'zh-CN' })
    if (machine && machine.trim()) return machine.trim()
  } catch {
    // Google 常被 429，换备用
  }
  return translateMyMemory(text)
}

let translateCache = loadTranslateCache()
let translateCacheDirty = false

async function localizeText(text, glossary) {
  const trimmed = (text || '').trim()
  if (!trimmed) return trimmed

  const byPattern = applyPhrasePatterns(trimmed, glossary)
  if (byPattern) return applyTerms(byPattern, glossary)

  if (/[\u4e00-\u9fff]/.test(trimmed) && !/[A-Za-z]{4,}/.test(trimmed)) {
    return applyTerms(trimmed, glossary)
  }

  const heur = heuristicTranslate(trimmed)
  if (heur) return applyTerms(heur, glossary)

  if (translateCache[trimmed]) {
    return applyTerms(translateCache[trimmed], glossary)
  }

  try {
    const machine = await machineTranslate(trimmed)
    translateCache[trimmed] = machine
    translateCacheDirty = true
    await sleep(350)
    return applyTerms(machine, glossary)
  } catch (e) {
    console.warn(
      '  translate fail, keep EN:',
      trimmed.slice(0, 50),
      `(${e.message || e})`
    )
    return applyTerms(trimmed, glossary)
  }
}

function looksLikeProperNameOrTicker(label) {
  const key = String(label || '').trim()
  if (!key) return true
  // 价格档、箭头数字
  if (/^[\$€£↑↓≦≧+\-–—\d.,\s万亿百千百万亿]+$/.test(key)) return true
  if (/^[\$€£]/.test(key)) return true
  // 两人名：JD Vance / Gavin Newsom
  if (/^[A-ZÁÉÍÓÚÜÑ]/.test(key) && /\s/.test(key) && !/\b(party|change|increase|decrease|sweep|house|senate)\b/i.test(key)) {
    return true
  }
  // 短品牌/战队
  if (/^(NVIDIA|Apple|Google|Anthropic|OpenAI|Meta|Microsoft|Tesla|Gen\.G|T1|Barcelona|PSG|Paris Saint-Germain)$/i.test(key)) {
    return true
  }
  return false
}

function scrubMachineZh(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\$?\s*<g[^>]*>.*?<\/g>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function localizeLabel(label, glossary) {
  const key = (label || '').trim()
  if (!key) return key
  if (glossary.labelMap && glossary.labelMap[key]) {
    return truncate(glossary.labelMap[key], 16)
  }
  const person = localizePersonName(key)
  if (person !== key) return truncate(person, 16)
  // 品牌/价位：不机翻，避免「Apple→苹果汁」
  if (looksLikeProperNameOrTicker(key)) {
    return truncate(key, 16)
  }
  const zh = scrubMachineZh(await localizeText(key, glossary))
  if (!zh || /苹果汁|车队|学院|人性/.test(zh)) return truncate(key, 16)
  return truncate(zh, 16)
}

const PAGE_SIZE = 50
const TARGET_MARKETS = 50
/** 过滤子盘后仍要凑够条数，多拉一些原始结果 */
const RAW_FETCH_CAP = 120

async function fetchMarketsPage(token, offset, limit, closed = 'False') {
  const body = {
    agent_id: 574,
    params: { closed: String(closed), min_volume: '1000' },
    pagination: { limit, offset },
    formatter_config: { format_type: 'raw' }
  }
  const res = await fetch(FALCON_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000)
  })
  if (!res.ok) {
    throw new Error(`Falcon HTTP ${res.status}`)
  }
  return res.json()
}

async function fetchMarkets(token, closed = 'False', cap = RAW_FETCH_CAP) {
  const all = []
  let offset = 0
  let hasMore = true
  let lastResp = null
  while (hasMore && all.length < cap) {
    const pageLimit = Math.min(PAGE_SIZE, cap - all.length)
    console.log(`  closed=${closed} offset=${offset} limit=${pageLimit}`)
    const resp = await fetchMarketsPage(token, offset, pageLimit, closed)
    lastResp = resp
    const batch = resp?.data?.results || []
    if (!batch.length) break
    all.push(...batch)
    hasMore = !!(resp?.pagination?.has_more)
    offset += batch.length
    if (batch.length < pageLimit) break
  }
  if (!lastResp) return { data: { results: [] }, pagination: {} }
  return {
    ...lastResp,
    data: { ...(lastResp.data || {}), results: all },
    pagination: {
      ...(lastResp.pagination || {}),
      limit: all.length,
      offset: 0,
      has_more: hasMore
    }
  }
}

function loadCachedRaw() {
  if (!fs.existsSync(rawOut)) return null
  const raw = fs.readFileSync(rawOut, 'utf8').replace(/^\uFEFF/, '')
  return JSON.parse(raw)
}

function parseJsonField(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return []
    }
  }
  return []
}

/** Gamma event → 与 Falcon 字段兼容的一条二元议题 */
function gammaEventToMarket(event) {
  if (!isHomepageEvent(event)) return null
  const title = String(event.title || '').trim()
  const markets = (event.markets || []).filter(
    (m) => m && m.closed !== true && m.active !== false
  )
  if (!markets.length) return null

  const yesNo = markets.filter((m) => {
    const o = parseJsonField(m.outcomes).map(String)
    return o.length === 2 && /^yes$/i.test(o[0]) && /^no$/i.test(o[1])
  })

  // 多人选举盘：标题用事件名，红蓝取概率最高的两人
  if (yesNo.length >= 2) {
    const ranked = yesNo
      .map((m) => {
        const prices = parseJsonField(m.outcomePrices).map(Number)
        return {
          m,
          yes: prices[0] || 0,
          vol: Number(m.volume) || 0,
          name: String(m.groupItemTitle || m.question || '').trim()
        }
      })
      .filter((x) => x.name)
      .sort((a, b) => b.yes - a.yes || b.vol - a.vol)

    if (ranked.length >= 2) {
      const a = ranked[0]
      const b = ranked[1]
      return {
        question: title,
        end_date: a.m.endDate || event.endDate || '',
        volume_total: Number(event.volume) || a.vol,
        side_a_outcome: a.name,
        side_b_outcome: b.name,
        condition_id: String(a.m.conditionId || a.m.id || event.id),
        slug: String(event.slug || a.m.slug || ''),
        event_slug: String(event.slug || ''),
        closed: false,
        winning_outcome: null,
        description: String(event.description || a.m.description || '').slice(0, 500)
      }
    }
  }

  const top = [...markets].sort(
    (a, b) => Number(b.volume || 0) - Number(a.volume || 0)
  )[0]
  const outcomes = parseJsonField(top.outcomes).map(String)
  const q = title || String(top.question || '')
  if (shouldSkipMarket(q)) return null
  return {
    question: q,
    end_date: top.endDate || event.endDate || '',
    volume_total: Number(event.volume) || Number(top.volume) || 0,
    side_a_outcome: outcomes[0] || 'Yes',
    side_b_outcome: outcomes[1] || 'No',
    condition_id: String(top.conditionId || top.id || event.id),
    slug: String(top.slug || event.slug || ''),
    event_slug: String(event.slug || ''),
    closed: false,
    winning_outcome: null,
    description: String(event.description || top.description || '').slice(0, 500)
  }
}

async function fetchGammaEvents({
  closed = false,
  limit = 40,
  order = 'volume24hr'
} = {}) {
  const u = new URL(GAMMA_EVENTS_URL)
  u.searchParams.set('active', closed ? 'false' : 'true')
  u.searchParams.set('closed', closed ? 'true' : 'false')
  u.searchParams.set('order', order)
  u.searchParams.set('ascending', 'false')
  u.searchParams.set('limit', String(limit))
  const res = await fetch(u, { signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new Error(`Gamma HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Gamma 返回非数组')
  return data
}

/** 只保留 end_date 仍在未来的（无日期则丢弃） */
function isEndDateFuture(endDate, nowMs = Date.now()) {
  if (!endDate) return false
  const t = Date.parse(String(endDate))
  if (Number.isNaN(t)) return false
  return t > nowMs
}

function slugSeriesHint(base) {
  if (/genga-hle/i.test(base)) {
    return 'LoL: Gen.G Global Academy vs Hanwha Life Esports Challengers (BO3)'
  }
  if (/t1a-broc/i.test(base)) {
    return 'LoL: T1 Academy vs HANJIN BRION Challengers (BO3)'
  }
  return ''
}

async function buildMainTitleMap(results, glossary) {
  const map = new Map()
  for (const m of results) {
    if (!m.slug || !m.question) continue
    const base = eventBaseSlug(m.slug)
    if (!base || map.has(base)) continue
    const q = String(m.question)

    if (/\(BO\d+\)/i.test(q)) {
      map.set(base, await localizeText(q, glossary))
      await sleep(80)
      continue
    }

    const seriesFromGame = q.match(
      /^LoL:\s*(.+?)\s+vs\.?\s+(.+?)\s*-\s*Game\s+\d+/i
    )
    if (seriesFromGame) {
      const pseudo = `LoL: ${seriesFromGame[1]} vs ${seriesFromGame[2]} (BO3)`
      map.set(base, await localizeText(pseudo, glossary))
      await sleep(80)
      continue
    }

    const hint = slugSeriesHint(base)
    if (hint) {
      map.set(base, await localizeText(hint, glossary))
      await sleep(80)
    }
  }
  return map
}

function applyDiscussionCopy(titleEn, mainTitle) {
  if (/^Games Total:/i.test(titleEn)) {
    const title = mainTitle
      ? `${mainTitle}｜这场会打满三局吗？`
      : '这场 BO3 会打到决胜第三局吗？'
    return {
      title,
      parentTitle: mainTitle || '',
      redLabel: '会打满三局',
      blueLabel: '两局内结束',
      skipTranslateLabels: true
    }
  }
  return null
}

function mapWinSide(redEn, blueEn, winning) {
  const w = String(winning || '').trim()
  if (!w) return ''
  if (w.toLowerCase() === String(redEn).toLowerCase()) return 'red'
  if (w.toLowerCase() === String(blueEn).toLowerCase()) return 'blue'
  return ''
}

async function buildMarketDraft(m, glossary, mainTitles, i, settled) {
  const titleEn = String(m.question)
  if (shouldSkipMarket(titleEn)) return null

  const base = eventBaseSlug(String(m.slug || ''))
  const mainTitle = mainTitles.get(base) || ''
  const discussion = applyDiscussionCopy(titleEn, mainTitle)

  let title
  let parentTitle = ''
  let redLabel
  let blueLabel
  if (discussion) {
    title = discussion.title
    parentTitle = discussion.parentTitle
    redLabel = discussion.redLabel
    blueLabel = discussion.blueLabel
  } else {
    title = await localizeText(titleEn, glossary)
    await sleep(200)
    const redEn0 = m.side_a_outcome ? String(m.side_a_outcome) : 'Yes'
    const blueEn0 = m.side_b_outcome ? String(m.side_b_outcome) : 'No'
    redLabel = await localizeLabel(redEn0, glossary)
    await sleep(100)
    blueLabel = await localizeLabel(blueEn0, glossary)
    await sleep(100)
  }

  const redEn = m.side_a_outcome ? String(m.side_a_outcome) : 'Yes'
  const blueEn = m.side_b_outcome ? String(m.side_b_outcome) : 'No'
  const vol = Number(m.volume_total) || 0
  const winningOutcome = m.winning_outcome ? String(m.winning_outcome) : ''
  const winSide = settled ? mapWinSide(redEn, blueEn, winningOutcome) : ''

  const draft = {
    externalId: String(m.condition_id),
    title,
    titleEn,
    parentTitle,
    redLabel,
    blueLabel,
    redLabelEn: redEn,
    blueLabelEn: blueEn,
    redCount: 40 + (i % 20),
    blueCount: 60 - (i % 20),
    slug: String(m.slug || ''),
    endDate: String(m.end_date || ''),
    volume: vol,
    settled: !!settled,
    winningOutcome,
    winSide
  }
  draft.category = detectCategory(draft)
  draft.body = buildTopicBlurb(draft)
  return draft
}

async function main() {
  if (!fs.existsSync(secFile)) {
    console.error('缺少 secrets/local.json')
    process.exit(1)
  }
  const rawSec = fs.readFileSync(secFile, 'utf8').replace(/^\uFEFF/, '')
  const { falconBearer: token } = JSON.parse(rawSec)
  if (!token) {
    console.error('falconBearer 为空')
    process.exit(1)
  }

  const glossary = loadGlossary()

  const fromCache = process.argv.includes('--from-cache')
  let useFalcon = process.argv.includes('--falcon')
  let results = []
  let sourceName = 'polymarket'

  if (fromCache) {
    console.log('1/4 使用本地缓存（--from-cache）')
    if (fs.existsSync(gammaRawOut)) {
      const cached = JSON.parse(
        fs.readFileSync(gammaRawOut, 'utf8').replace(/^\uFEFF/, '')
      )
      results = (cached.markets || []).filter(Boolean)
      sourceName = 'polymarket'
      console.log('  gamma 缓存条数', results.length)
    } else {
      const resp = loadCachedRaw()
      if (!resp) {
        console.error('无缓存文件')
        process.exit(1)
      }
      results = resp?.data?.results || []
      sourceName = 'falcon'
    }
  } else if (!useFalcon) {
    console.log('1/4 Gamma 拉取首页热门事件…')
    try {
      const events = await fetchGammaEvents({
        closed: false,
        limit: 50,
        order: 'volume24hr'
      })
      const mapped = events.map(gammaEventToMarket).filter(Boolean)
      results = mapped
      fs.writeFileSync(
        gammaRawOut,
        JSON.stringify(
          { fetchedAt: new Date().toISOString(), events, markets: mapped },
          null,
          2
        ),
        'utf8'
      )
      console.log(
        `  Gamma 事件 ${events.length} → 首页级议题 ${mapped.length}`
      )
      sourceName = 'polymarket'
    } catch (e) {
      console.warn('Gamma 失败，回退 Falcon:', e.message)
      useFalcon = true
    }
  }

  if (!results.length || useFalcon) {
    console.log('1/4 Falcon fetch 进行中（备用）…')
    try {
      const resp = await fetchMarkets(token, 'False', RAW_FETCH_CAP)
      fs.writeFileSync(rawOut, JSON.stringify(resp, null, 2), 'utf8')
      results = resp?.data?.results || []
      sourceName = 'falcon'
    } catch (e) {
      console.warn('Falcon 请求失败:', e.message)
      const resp = loadCachedRaw()
      if (!resp) throw e
      console.warn('→ 改用已有 falcon_raw.json')
      results = resp?.data?.results || []
      sourceName = 'falcon'
    }
  }

  let closedResults = []
  if (!fromCache) {
    console.log('1b/4 拉取已关闭（结算用）…')
    try {
      // 结算仍用 Falcon（带 winning_outcome）；失败再跳过
      const closedResp = await fetchMarkets(token, 'True', 60)
      const closedOut = path.join(root, 'utils', 'falcon_closed.json')
      fs.writeFileSync(closedOut, JSON.stringify(closedResp, null, 2), 'utf8')
      closedResults = (closedResp?.data?.results || []).filter(
        (m) =>
          m.winning_outcome &&
          !shouldSkipMarket(m.question) &&
          isSportsWhoWinsOnly(m.question)
      )
    } catch (e) {
      console.warn('关闭盘拉取失败，跳过结算列表:', e.message)
      const closedOut = path.join(root, 'utils', 'falcon_closed.json')
      if (fs.existsSync(closedOut)) {
        const closedResp = JSON.parse(
          fs.readFileSync(closedOut, 'utf8').replace(/^\uFEFF/, '')
        )
        closedResults = (closedResp?.data?.results || []).filter(
          (m) =>
            m.winning_outcome &&
            !shouldSkipMarket(m.question) &&
            isSportsWhoWinsOnly(m.question)
        )
      }
    }
  } else {
    const closedOut = path.join(root, 'utils', 'falcon_closed.json')
    if (fs.existsSync(closedOut)) {
      const closedResp = JSON.parse(
        fs.readFileSync(closedOut, 'utf8').replace(/^\uFEFF/, '')
      )
      closedResults = (closedResp?.data?.results || []).filter(
        (m) =>
          m.winning_outcome &&
          !shouldSkipMarket(m.question) &&
          isSportsWhoWinsOnly(m.question)
      )
    }
  }

  if (!results.length) {
    console.error('0 条进行中结果')
    process.exit(1)
  }

  const nowMs = Date.now()
  const futureResults = results.filter(
    (m) =>
      !shouldSkipMarket(m.question) &&
      isSportsWhoWinsOnly(m.question) &&
      isEndDateFuture(m.end_date, nowMs)
  )
  console.log(
    `过滤：原始 ${results.length} → 首页级且未过期 ${futureResults.length}`
  )
  console.log(`已关闭且有结果（已滤盘口）：${closedResults.length}`)

  const sorted = [...futureResults].sort(
    (a, b) => Number(b.volume_total || 0) - Number(a.volume_total || 0)
  )

  console.log('2/4 主赛标题映射…')
  const mainTitles = await buildMainTitleMap(
    futureResults.concat(closedResults),
    glossary
  )

  console.log('3/4 翻译进行中议题…')
  const markets = []
  let i = 0
  for (const m of sorted) {
    if (!m.question) continue
    const draft = await buildMarketDraft(m, glossary, mainTitles, i, false)
    if (!draft) continue
    console.log('  ·', '[' + draft.category + ']', draft.title)
    markets.push(draft)
    i++
    if (markets.length >= TARGET_MARKETS) break
  }

  console.log('4/4 翻译已结算议题…')
  const resolved = []
  let j = 0
  const closedSorted = [...closedResults].sort(
    (a, b) => Number(b.volume_total || 0) - Number(a.volume_total || 0)
  )
  for (const m of closedSorted) {
    if (!m.question) continue
    const draft = await buildMarketDraft(m, glossary, mainTitles, j, true)
    if (!draft || !draft.winSide) continue
    console.log('  ✓', draft.winSide, draft.title.slice(0, 36))
    resolved.push(draft)
    j++
    if (resolved.length >= 30) break
  }

  if (translateCacheDirty) {
    saveTranslateCache(translateCache)
    console.log('已更新 translate_cache.json')
  }

  // 写入前硬校验：再次套用 feedRules，漏网必丢
  const openGate = filterAllowedMarkets(markets)
  const resolvedGate = filterAllowedMarkets(resolved)
  if (Object.keys(openGate.rejected).length) {
    console.log('规则拦截(进行中):', openGate.rejected)
  }
  if (Object.keys(resolvedGate.rejected).length) {
    console.log('规则拦截(已结算):', resolvedGate.rejected)
  }

  console.log(
    `写入 polymarket_live.js + panjue_feed.json（feedRules v${RULES_VERSION}）`
  )
  const syncedAt = Date.now()
  const payload = {
    syncedAt,
    source: sourceName,
    rulesVersion: RULES_VERSION,
    markets: openGate.kept,
    resolved: resolvedGate.kept
  }
  const moduleText = `/** auto-generated by npm run sync */
module.exports = ${JSON.stringify(payload, null, 2)}
`
  fs.writeFileSync(outJs, moduleText, 'utf8')
  fs.writeFileSync(
    path.join(root, 'utils', 'panjue_feed.json'),
    JSON.stringify(payload, null, 2),
    'utf8'
  )
  console.log(
    'OK open=' + markets.length + ' resolved=' + resolved.length
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
