/**
 * 把 Polymarket 盘口式标题改成中文用户能读懂的问法（展示层）
 * 准入规则以 utils/feedRules.js 为准。
 */

const feedRules = require('./feedRules')

function eventBaseSlug(slug) {
  if (!slug) return ''
  return slug
    .replace(/-total-games-[\d.]+pt[\d.]+$/i, '')
    .replace(/-total-games-[\d.]+$/i, '')
    .replace(/-game\d+(-winner)?$/i, '')
    .replace(/-[a-z]+-to-win-\d+-games$/i, '')
}

function humanizeTopic(topic) {
  const titleEn = topic.titleEn || ''
  const slug = topic.slug || ''
  const patch = {}

  if (/^Games Total:/i.test(titleEn) || /^总局数大小分/.test(topic.title || '')) {
    const main =
      topic.parentTitle ||
      topic.eventTitle ||
      slugHintFromBase(eventBaseSlug(slug))
    patch.title = main
      ? `${main}｜这场会打满三局吗？`
      : '这场 BO3 会打到决胜第三局吗？'
    patch.redLabel = '会打满三局'
    patch.blueLabel = '两局内结束'
    return patch
  }

  // 与同步同一套硬规则：不通过则列表隐藏
  if (!feedRules.isTopicAllowed(topic)) {
    return null
  }

  if (/^Over$/i.test(topic.redLabelEn) && /^Under$/i.test(topic.blueLabelEn)) {
    if (/大小分|总局数|O\/U/i.test(titleEn + (topic.title || ''))) {
      patch.redLabel = '会打满三局'
      patch.blueLabel = '两局内结束'
    } else {
      patch.redLabel = '超过'
      patch.blueLabel = '不超过'
    }
  }

  return patch
}

function slugHintFromBase(base) {
  if (!base) return ''
  if (/genga-hle/i.test(base)) return '英雄联盟：Gen.G青训 对阵 韩华生命挑战者'
  if (/t1a-broc/i.test(base)) return '英雄联盟：T1青训 对阵 韩华 BRION 挑战者'
  return ''
}

function applyHumanize(topic) {
  const patch = humanizeTopic(topic)
  if (patch === null) return null
  if (!patch || !Object.keys(patch).length) return topic
  return Object.assign({}, topic, patch)
}

module.exports = {
  eventBaseSlug,
  humanizeTopic,
  applyHumanize
}
