const store = require('../../utils/store')

Page({
  data: {
    id: '',
    topic: null,
    comments: [],
    filter: 'all',
    draft: '',
    canSend: false,
    stamina: 0
  },

  onLoad(query) {
    this.setData({ id: query.id || '' })
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const user = store.getUser()
    const topic = store.getTopic(this.data.id)
    if (!topic) {
      this.setData({ topic: null, comments: [], stamina: user.stamina || 0 })
      return
    }

    // 代表评论已在上方 VS 区展示，下面列表去掉重复
    const skip = {}
    if (topic.redRep) skip[topic.redRep.id] = true
    if (topic.blueRep) skip[topic.blueRep.id] = true

    const comments = store
      .listComments(this.data.id, this.data.filter)
      .filter((c) => !skip[c.id])
      .sort((a, b) => b.likes - a.likes || a.createdAt - b.createdAt)

    this.setData({ topic, comments, stamina: user.stamina || 0 })
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter }, () => this.refresh())
  },

  onVote(e) {
    const side = e.currentTarget.dataset.side
    const res = store.vote(this.data.id, side)
    if (!res.ok) {
      wx.showToast({ title: res.message || '无法投票', icon: 'none' })
      return
    }
    wx.showToast({ title: '已站队 -1体力', icon: 'success' })
    this.refresh()
  },

  onDraft(e) {
    const draft = e.detail.value
    this.setData({ draft, canSend: !!(draft && draft.trim()) })
  },

  onSend() {
    if (!this.data.canSend) return
    const res = store.addComment(this.data.id, this.data.draft)
    if (!res.ok) {
      wx.showToast({ title: res.message || '发送失败', icon: 'none' })
      return
    }
    this.setData({ draft: '', canSend: false })
    this.refresh()
  },

  onLike(e) {
    store.toggleLike(e.currentTarget.dataset.id)
    this.refresh()
  },

  onShareAppMessage() {
    const topic = this.data.topic
    return {
      title: topic ? topic.title : 'poly预测市场',
      path: `/pages/detail/detail?id=${this.data.id}`
    }
  }
})
