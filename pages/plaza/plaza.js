const store = require('../../utils/store')
const {
  buildCategoryTabs,
  detectCategory,
  CATEGORIES
} = require('../../utils/category')

function catName(id) {
  const hit = CATEGORIES.find((c) => c.id === id)
  return hit ? hit.name : id
}

function topicCat(t) {
  return t.category || detectCategory(t)
}

Page({
  data: {
    allTopics: [],
    categories: [],
    filtered: [],
    activeCat: 'all',
    activeName: '全部'
  },

  onLoad() {
    try {
      this.refresh()
    } catch (e) {
      console.warn('plaza onLoad', e)
    }
  },

  onShow() {
    try {
      this.refresh()
    } catch (e) {
      console.warn('plaza onShow refresh', e)
    }
    store
      .autoSyncIfDue(false)
      .catch(() => null)
      .then(() => {
        try {
          this.refresh()
        } catch (e) {}
      })
  },

  onPullDownRefresh() {
    store
      .autoSyncIfDue(true)
      .catch(() => null)
      .then(() => {
        this.refresh()
        wx.stopPullDownRefresh()
      })
  },

  refresh() {
    const allTopics = store.listTopics()
    const categories = buildCategoryTabs(allTopics)
    let activeCat = this.data.activeCat
    const stillHas =
      activeCat === 'all' || allTopics.some((t) => topicCat(t) === activeCat)
    if (!stillHas || !categories.some((c) => c.id === activeCat)) {
      activeCat = 'all'
    }
    this.setData(
      {
        allTopics,
        categories,
        activeCat,
        activeName: catName(activeCat)
      },
      () => this.applyFilter()
    )
  },

  applyFilter() {
    // 每次从 store 重算，避免 setData 后字段不一致导致「有计数、列表空」
    const allTopics = store.listTopics()
    const categories = buildCategoryTabs(allTopics)
    const activeCat = this.data.activeCat || 'all'
    const filtered =
      activeCat === 'all'
        ? allTopics
        : allTopics.filter((t) => topicCat(t) === activeCat)
    this.setData({
      allTopics,
      categories,
      filtered,
      activeName: catName(activeCat)
    })
  },

  onCat(e) {
    const id = e.currentTarget.dataset.cat || 'all'
    this.setData({ activeCat: id, activeName: catName(id) }, () =>
      this.applyFilter()
    )
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
