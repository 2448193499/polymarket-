const store = require('../../utils/store')

Page({
  data: {
    user: {},
    avatarText: '判',
    nickDraft: '',
    list: []
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const user = store.getUser()
    this.setData({
      user,
      nickDraft: user.nickName || '',
      avatarText: (user.nickName || '判').slice(0, 1),
      list: store.myVotes()
    })
  },

  onNick(e) {
    this.setData({ nickDraft: e.detail.value })
  },

  login() {
    const name = (this.data.nickDraft || '').trim() || '看客甲'
    // 首次起名：写入昵称并开始冷却计时
    store.setUser({
      nickName: name,
      loggedIn: true,
      id: 'user_local',
      nickChangedAt: Date.now()
    })
    wx.showToast({ title: '已进入', icon: 'success' })
    this.refresh()
  },

  saveNick() {
    const name = (this.data.nickDraft || '').trim()
    const res = store.changeNickName(name)
    if (!res.ok) {
      wx.showToast({ title: res.message || '无法修改', icon: 'none' })
      return
    }
    wx.showToast({ title: '已改名（30天内不可再改）', icon: 'none' })
    this.refresh()
  },

  onCheckIn() {
    const res = store.checkIn()
    if (!res.ok) {
      wx.showToast({ title: res.message || '签到失败', icon: 'none' })
      return
    }
    wx.showToast({ title: `+${res.gained} 体力`, icon: 'success' })
    this.refresh()
  },

  goRank() {
    wx.navigateTo({ url: '/pages/rank/rank' })
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  resetDemo() {
    wx.showModal({
      title: '恢复演示数据？',
      content: '会清空议题、投票、体力和战绩',
      success: (res) => {
        if (res.confirm) {
          store.resetDemo()
          this.refresh()
          wx.showToast({ title: '已恢复', icon: 'success' })
        }
      }
    })
  }
})
