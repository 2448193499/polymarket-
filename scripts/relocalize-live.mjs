import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { detectCategory } = require('../utils/category.js')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const livePath = path.join(root, 'utils', 'polymarket_live.js')
const glossary = JSON.parse(
  fs.readFileSync(path.join(root, 'utils', 'localize-zh.json'), 'utf8')
)
const live = require('../utils/polymarket_live.js')

function phraseToRegExp(pattern) {
  let flags = ''
  let src = pattern
  if (src.startsWith('(?i)')) {
    flags = 'i'
    src = src.slice(4)
  }
  return new RegExp(src, flags)
}

function applyPhrase(text) {
  for (const p of glossary.phrases || []) {
    const m = text.match(phraseToRegExp(p.pattern))
    if (m) {
      let out = p.zh
      for (let i = 1; i < m.length; i++) out = out.replace('$' + i, m[i])
      return out
    }
  }
  return null
}

function applyTerms(text) {
  let out = text
  const terms = [...(glossary.terms || [])].sort((a, b) => b.en.length - a.en.length)
  for (const t of terms) {
    const re = new RegExp(t.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    out = out.replace(re, t.zh)
  }
  return out
}

function localize(text) {
  const by = applyPhrase(text)
  return applyTerms(by || text)
}

live.markets = live.markets.map((m) => {
  const titleEn = m.titleEn || m.title
  const title = localize(titleEn)
  const next = { ...m, title, titleEn }
  next.category = detectCategory(next)
  return next
})

const moduleText = `/** auto-generated (category + glossary) */
module.exports = {
  syncedAt: ${Date.now()},
  source: "falcon",
  markets: ${JSON.stringify(live.markets, null, 2)}
}
`
fs.writeFileSync(livePath, moduleText, 'utf8')
const counts = {}
for (const m of live.markets) counts[m.category] = (counts[m.category] || 0) + 1
console.log('OK', live.markets.length, counts)
