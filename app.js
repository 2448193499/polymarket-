const store = require('./utils/store')

App({
  onLaunch() {
    store.ensureSeed()
    store.autoSyncIfDue(true).catch(() => {})
  },
  onShow() {
    store.autoSyncIfDue(false).catch(() => {})
  },
  globalData: {
    brand: '判决社区'
  }
})
