/**
 * 展示层中文化：不依赖外网，专治缓存里残留的英文标题。
 */

const { localizePersonName } = require('./personNames')

const CLUB_MAP = {
  'Stade Brestois 29': '布雷斯特',
  'VfB Stuttgart': '斯图加特',
  'CD Tondela': '通德拉',
  'FC Lorient': '洛里昂',
  'UD Almería': '阿尔梅里亚',
  'UD Almeria': '阿尔梅里亚',
  'CA Aldosivi': '奥尔多西维',
  'SC Freiburg': '弗赖堡',
  'FC Volendam': '福伦丹',
  'FC Lorient': '洛里昂',
  'Will Stade Brestois 29': '布雷斯特'
}

function clubZh(name) {
  const n = String(name || '').trim()
  if (CLUB_MAP[n]) return CLUB_MAP[n]
  return n.replace(/^(FC|CF|UD|CD|CA|SC|AFC|SSC)\s+/i, '')
}

function isoDateZh(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

function monthZh(s) {
  return String(s || '')
    .replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
      (_, mon, y) => {
        const map = {
          january: '1',
          february: '2',
          march: '3',
          april: '4',
          may: '5',
          june: '6',
          july: '7',
          august: '8',
          september: '9',
          october: '10',
          november: '11',
          december: '12'
        }
        return `${y}年${map[mon.toLowerCase()]}月`
      }
    )
    .replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/gi,
      (_, mon, d) => {
        const map = {
          january: '1',
          february: '2',
          march: '3',
          april: '4',
          may: '5',
          june: '6',
          july: '7',
          august: '8',
          september: '9',
          october: '10',
          november: '11',
          december: '12'
        }
        return `${map[mon.toLowerCase()]}月${d}日`
      }
    )
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

function yearZh(s) {
  const t = monthZh(s)
  if (/^\d{4}$/.test(t)) return `${t}年`
  return t
}

function sportZh(s) {
  return String(s || '')
    .replace(/^Pro Football$/i, '美式橄榄球')
    .replace(/^UEFA Champions League$/i, '欧冠')
    .replace(/^NBA$/i, 'NBA')
}

function officeZh(s) {
  return String(s || '')
    .replace(/^California Governor$/i, '加州州长')
    .replace(/^Texas Governor$/i, '得州州长')
    .replace(/^Texas Senate$/i, '得州联邦参议员')
    .replace(/^Michigan Senate$/i, '密歇根联邦参议员')
}

function translateTitle(raw) {
  const t = String(raw || '').trim()
  if (!t) return t
  // 已是中文主导则不动
  if (/[\u4e00-\u9fff]/.test(t) && !/^Will\b/i.test(t)) return t

  let m
  m = t.match(/^Will (.+?) win on (\d{4}-\d{2}-\d{2})\??$/i)
  if (m) return `${clubZh(m[1])} 会在 ${isoDateZh(m[2])} 获胜吗？`

  m = t.match(/^What price will Bitcoin hit in ([^?]+)\??$/i)
  if (m) return `比特币在 ${yearZh(m[1].trim())} 会涨到什么价位？`

  m = t.match(/^What price will Ethereum hit in ([^?]+)\??$/i)
  if (m) return `以太坊在 ${yearZh(m[1].trim())} 会涨到什么价位？`

  m = t.match(/^(.+?): (\d{4}) Champion$/i)
  if (m) return `${sportZh(m[1].trim())}：${m[2]} 赛季冠军`

  m = t.match(/^Presidential Election Winner (\d{4})$/i)
  if (m) return `${m[1]} 美国总统大选赢家`

  m = t.match(/^Democratic Presidential Nominee (\d{4})$/i)
  if (m) return `${m[1]} 民主党总统候选人`

  m = t.match(/^Republican Presidential Nominee (\d{4})$/i)
  if (m) return `${m[1]} 共和党总统候选人`

  m = t.match(/^Next French Presidential Election$/i)
  if (m) return '下一届法国总统选举'

  m = t.match(/^(.+) Election Winner$/i)
  if (m) return `${officeZh(m[1].trim())}选举赢家`

  m = t.match(/^Which party will win the House in (\d{4})\??$/i)
  if (m) return `${m[1]} 年哪一党拿下众议院？`

  m = t.match(/^Which party will win the Senate in (\d{4})\??$/i)
  if (m) return `${m[1]} 年哪一党拿下参议院？`

  m = t.match(/^Balance of Power: (\d{4}) Midterms$/i)
  if (m) return `${m[1]} 中期选举权力格局`

  m = t.match(/^Fed Decision in ([^?]+)\??$/i)
  if (m) return `${monthZh(m[1].trim())} 美联储决议`

  m = t.match(/^Largest Company end of ([^?]+)\??$/i)
  if (m) return `${monthZh(m[1].trim())} 结束时市值最大的公司？`

  m = t.match(/^Which company has the best AI model end of ([^?]+)\??$/i)
  if (m) return `${monthZh(m[1].trim())} 结束时哪家公司 AI 模型最强？`

  m = t.match(/^Worlds (\d{4}): Winner$/i)
  if (m) return `英雄联盟全球总决赛 ${m[1]} 冠军`

  m = t.match(/^Will the Iranian regime fall before (\d{4})\??$/i)
  if (m) return `伊朗政权会在 ${m[1]} 年前倒台吗？`

  m = t.match(/^US announces end of Iranian blockade by\.\.\.\?$/i)
  if (m) return '美国会在何时宣布结束对伊朗封锁？'

  m = t.match(/^Strait of Hormuz traffic returns to normal by ([^?]+)\??$/i)
  if (m) return `霍尔木兹海峡通行会在 ${monthZh(m[1].trim())} 前恢复正常吗？`

  m = t.match(/^Predict\.fun FDV above .+ one day after launch\??$/i)
  if (m) return 'Predict.fun 上线一天后的 FDV 会高于多少？'

  m = t.match(/^Total commitments for the 1win \(\$1w\) public sale$/i)
  if (m) return '1win（$1w）公募认购总金额会到多少？'

  m = t.match(/^Will Predict\.fun launch a token by .+\??$/i)
  if (m) return 'Predict.fun 会在哪个日期之前发行代币？'

  return t
}

const LABEL_MAP = {
  Yes: '是',
  No: '否',
  Up: '上升',
  Down: '下降',
  Over: '大分',
  Under: '小分',
  'Democratic Party': '民主党',
  'Republican Party': '共和党'
}

function translateLabel(label) {
  const key = String(label || '').trim()
  if (!key) return key
  if (LABEL_MAP[key]) return LABEL_MAP[key]
  const person = localizePersonName(key)
  if (person !== key) return person
  return key
}

function endHint(endDate) {
  if (!endDate) return ''
  const t = Date.parse(String(endDate))
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `预计关注至 ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日前后。`
}

/**
 * 论点说明（给详情页 body）：比标题多一点背景，不写成交量/同步免责套话。
 */
function buildTopicBlurb(topic) {
  const title = String(topic.title || topic.titleEn || '').trim()
  const en = String(topic.titleEn || topic.title || '').trim()
  const red = String(topic.redLabel || topic.redLabelEn || '红方').trim()
  const blue = String(topic.blueLabel || topic.blueLabelEn || '蓝方').trim()
  const end = endHint(topic.endDate || topic.end_date)
  const settled = !!topic.settled

  let core = ''
  if (/总统候选人|Presidential Nominee/i.test(title + en)) {
    core = `本题讨论美国总统候选人提名格局。你更看好「${red}」还是「${blue}」最终走得更远。`
  } else if (/总统大选赢家|Presidential Election Winner/i.test(title + en)) {
    core = `本题预测美国总统大选最终赢家。当前对照人物为「${red}」与「${blue}」，站队表示你认为谁更可能胜出。`
  } else if (/选举赢家|Election Winner|哪一党拿下|中期选举|party will win|Midterms|Governor|Senate/i.test(title + en)) {
    core = `本题关注一场公开选举的结果归属。红方倾向「${red}」，蓝方倾向「${blue}」。结合任期、民调与基本盘再站队会更稳。`
  } else if (/冠军|Champion|Winner|夺冠/i.test(title + en)) {
    core = `本题预测赛事冠军花落谁家。你认为「${red}」与「${blue}」谁更有机会捧杯；赛季走势、伤病与赛制都会影响结果。`
  } else if (/比特币|以太坊|Bitcoin|Ethereum|价位|FDV|代币|公募/i.test(title + en)) {
    core = `本题讨论加密资产相关价格或事件能否兑现。红方看法偏「${red}」，蓝方偏「${blue}」。波动大，站队前先想清楚时间窗口与判定口径。`
  } else if (/美联储|Fed|降息|加息|利率/i.test(title + en)) {
    core = `本题关注宏观货币政策决议方向。可选立场为「${red}」与「${blue}」。就业、通胀与点阵图往往比单次口号更关键。`
  } else if (/伊朗|霍尔木兹|封锁|regime|Iran|Hormuz/i.test(title + en)) {
    core = `本题涉及地缘局势能否按某个时间节点演变。你可在「${red}」与「${blue}」之间站队，关注公开可验证的结果，而不是情绪化传闻。`
  } else if (/AI|英伟达|苹果|市值最大|科技/i.test(title + en)) {
    core = `本题比较科技公司或产品的阶段性领先性。红方是「${red}」，蓝方是「${blue}」。可从产品节奏、资本开支与市场定价来判断。`
  } else {
    core = `围绕「${title}」进行站队讨论。红方观点倾向「${red}」，蓝方倾向「${blue}」。先想清楚判定标准，再选边。`
  }

  if (settled) {
    const win =
      topic.winSide === 'red' ? red : topic.winSide === 'blue' ? blue : topic.winningOutcome || '已公布'
    return `${core}本题已结算，公开结果偏向「${win}」。`
  }
  return end ? `${core}${end}` : core
}

function isSyncDisclaimer(body) {
  const b = String(body || '')
  return /同步自|约成交量|本站只做站队评论|不展示下注/.test(b)
}

/** 展示用：优先翻 title；若 title 仍是英文则再试 titleEn */
function localizeTopic(topic) {
  if (!topic) return topic
  const src = topic.title || ''
  const en = topic.titleEn || ''
  let title = translateTitle(src)
  if (title === src && /[A-Za-z]{4,}/.test(src) && en) {
    title = translateTitle(en)
  }
  // title 仍是 Will... 时强制用 titleEn 规则
  if (/^Will\b/i.test(title) && en) {
    title = translateTitle(en)
  }
  const patched = Object.assign({}, topic, {
    title,
    redLabel: translateLabel(topic.redLabel),
    blueLabel: translateLabel(topic.blueLabel)
  })
  // 说明文随本土化标签一起重算，保证人名中文一致
  patched.body = buildTopicBlurb(patched)
  return patched
}

module.exports = {
  translateTitle,
  translateLabel,
  buildTopicBlurb,
  localizeTopic
}
