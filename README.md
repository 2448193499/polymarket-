# poly预测市场（微信小程序 · 演示）

Polymarket 风格议题同步 + 红蓝站队 + 评论 + 体力/段位（无真实下注）。

## 用微信开发者工具打开

1. 打开 **微信开发者工具** → **小程序** → **导入项目**
2. 目录：`C:\Users\Administrator\Desktop\判决\panjue-miniprogram`
3. AppID：**测试号** 或 `touristappid`
4. 底部 Tab：**来源** / **评价** / **我的**

## 同步议题（电脑端 · 用户不可见）

小程序已去掉「来源」页。打开 App 会自动同步；超过 1 小时再打开会再同步一次。

**硬规则唯一入口：`utils/feedRules.js`（每次爬取/sync 必须遵守）**
- 只要 Polymarket 首页级大论点（成交量门槛）
- 不要猜比分、让分、O/U、盘口子盘、短周期币价档
- 竞技只要冠军/赛季赢家；不要「某队某日会不会赢」（缺对手赛事）
- 写入前会再跑一遍 `filterAllowedMarkets`；小程序列表同样用这套规则隐藏

1. **进行中议题优先用 Polymarket Gamma**（按 24h 成交量）
2. 结算列表仍可走 Falcon（需 `secrets/local.json` 的 `falconBearer`）；`--falcon` 可强制全程 Falcon
3. `npm install` → `npm run sync`  
   写入 `utils/polymarket_live.js` + `utils/panjue_feed.json`
4. **每小时自动拉数（本机）：** 任务计划跑 `scripts/hourly-sync.ps1`（内部仍是 `npm run sync`）
5. **全体用户每小时更新：** 把 `panjue_feed.json` 挂 HTTPS，填 `utils/config.js` 的 `REMOTE_FEED_URL`

## 说明

- 密钥不要写进小程序代码；Falcon 仅备用/结算时用
- 本地 Storage 键 `panjue_v4`；可在 **我的** 恢复演示数据
- 结算/XP 按 Polymarket 结果对齐仍在 backlog（详情页目前是演示「多数票结算」）
