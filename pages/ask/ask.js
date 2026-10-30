const store = require('../../utils/store')

function formatTime(ts) {
  if (!ts) return '尚未同步'
  const d = new Date(ts)
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

Page({
  data: {
    meta: {},
    syncText: '',
    syncing: false
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const meta = store.getSyncMeta()
    this.setData({
      meta,
      syncText: formatTime(meta.lastSyncAt)
    })
  },

  onSync() {
    this.setData({ syncing: true })
    const meta = store.syncPolymarketDemo()
    this.setData({
      syncing: false,
      meta,
      syncText: formatTime(meta.lastSyncAt)
    })
    const okLive = !!meta.fromLive
    wx.showToast({
      title: okLive
        ? `已载入 ${meta.count || 0} 条真数据`
        : '仍是 mock，请先跑 sync-falcon.ps1',
      icon: okLive ? 'success' : 'none',
      duration: 2500
    })
  },

  goPlaza() {
    wx.switchTab({ url: '/pages/plaza/plaza' })
  }
})
