const store = require('../../utils/store')

Page({
  data: {
    type: 'total',
    list: []
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    this.setData({
      list: store.getLeaderboard(this.data.type)
    })
  },

  switchType(e) {
    this.setData({ type: e.currentTarget.dataset.type }, () => this.refresh())
  }
})
