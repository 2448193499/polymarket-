/** 客户端同步策略（密钥永不放这里） */
module.exports = {
  /** 距上次同步超过该时间则自动拉议题/结算 */
  SYNC_INTERVAL_MS: 60 * 60 * 1000,
  /**
   * 可选：HTTPS 议题源（电脑 hourly sync 上传到你的服务器后填这里）
   * 例：https://your.domain/panjue-feed.json
   * 留空则只用小程序包内 polymarket_live.js
   */
  REMOTE_FEED_URL:
    'https://panjue-feed.oss-cn-beijing.aliyuncs.com/panjue_feed.json'
}
