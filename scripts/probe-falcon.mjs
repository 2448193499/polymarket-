/**
 * 一次性：直接打 Falcon API，把原始结果摘要打到控制台 + 保存完整 JSON
 * 运行：node scripts/probe-falcon.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const sec = JSON.parse(
  fs.readFileSync(path.join(root, 'secrets', 'local.json'), 'utf8').replace(/^\uFEFF/, '')
)
const token = sec.falconBearer
if (!token) {
  console.error('secrets/local.json 缺少 falconBearer')
  process.exit(1)
}

const FALCON_URL =
  'https://narrative.agent.heisenberg.so/api/v2/semantic/retrieve/parameterized'

async function fetchPage(closed, offset = 0, limit = 20) {
  const body = {
    agent_id: 574,
    params: { closed: String(closed), min_volume: '1000' },
    pagination: { limit, offset },
    formatter_config: { format_type: 'raw' }
  }
  const t0 = Date.now()
  let res
  try {
    res = await fetch(FALCON_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000)
    })
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e), ms: Date.now() - t0 }
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return {
    ok: res.ok,
    status: res.status,
    ms: Date.now() - t0,
    rawTextLen: text.length,
    json,
    textPreview: text.slice(0, 500)
  }
}

function summarize(json) {
  const results = json?.data?.results || []
  return results.map((m, i) => ({
    i: i + 1,
    question: m.question || m.title || m.name || '(no question)',
    volume: m.volume ?? m.volume_num ?? m.volumeNum,
    closed: m.closed,
    endDate: m.endDate || m.end_date,
    outcomes: m.outcomes || m.outcome || m.tokens,
    winningOutcome: m.winningOutcome || m.winning_outcome,
    slug: m.slug || m.event_slug || m.conditionId
  }))
}

console.log('URL:', FALCON_URL)
console.log('请求进行中 markets: closed=False, limit=20, min_volume=1000 …')
const open = await fetchPage('False', 0, 20)
console.log('HTTP', open.status, 'ok=', open.ok, '耗时', open.ms + 'ms', 'bodyLen', open.rawTextLen)
if (!open.ok || !open.json) {
  console.log('失败原因:', open.error || open.textPreview)
} else {
  const rows = summarize(open.json)
  console.log('条数:', rows.length, '| pagination:', JSON.stringify(open.json.pagination || open.json.data?.pagination || {}))
  console.log('--- 进行中前 20 条 ---')
  for (const r of rows) {
    console.log(
      `${String(r.i).padStart(2)}. vol=${r.volume ?? '?'} end=${r.endDate || '?'} | ${r.question}`
    )
  }
}

console.log('\n请求已关闭 markets: closed=True, limit=10 …')
const closed = await fetchPage('True', 0, 10)
console.log('HTTP', closed.status, 'ok=', closed.ok, '耗时', closed.ms + 'ms', 'bodyLen', closed.rawTextLen)
if (closed.ok && closed.json) {
  const rows = summarize(closed.json)
  console.log('条数:', rows.length)
  console.log('--- 已关闭前 10 条 ---')
  for (const r of rows) {
    console.log(
      `${String(r.i).padStart(2)}. win=${r.winningOutcome || '?'} | ${r.question}`
    )
  }
} else {
  console.log('失败原因:', closed.error || closed.textPreview)
}

const dumpPath = path.join(root, 'utils', 'falcon_probe_dump.json')
fs.writeFileSync(
  dumpPath,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      open: open.json || { error: open.error || open.textPreview, status: open.status },
      closed: closed.json || { error: closed.error || closed.textPreview, status: closed.status }
    },
    null,
    2
  ),
  'utf8'
)
console.log('\n完整原始 JSON 已写到:', dumpPath)
