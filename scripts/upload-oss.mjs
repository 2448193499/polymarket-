/**
 * 把 utils/panjue_feed.json 上传到阿里云 OSS（覆盖同名对象）
 * 凭证写在 secrets/local.json 的 oss 字段，勿提交仓库。
 *
 * secrets/local.json 示例：
 * {
 *   "falconBearer": "...",
 *   "oss": {
 *     "accessKeyId": "LTAI...",
 *     "accessKeySecret": "...",
 *     "bucket": "panjue-feed",
 *     "region": "oss-cn-beijing",
 *     "object": "panjue_feed.json"
 *   }
 * }
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const feedPath = path.join(root, 'utils', 'panjue_feed.json')
const secretsPath = path.join(root, 'secrets', 'local.json')

function die(msg) {
  console.error(msg)
  process.exit(1)
}

function loadOss() {
  if (!fs.existsSync(secretsPath)) die('缺少 secrets/local.json')
  const sec = JSON.parse(
    fs.readFileSync(secretsPath, 'utf8').replace(/^\uFEFF/, '')
  )
  const oss = sec.oss || {}
  const accessKeyId = String(oss.accessKeyId || '').trim()
  const accessKeySecret = String(oss.accessKeySecret || '').trim()
  const bucket = String(oss.bucket || 'panjue-feed').trim()
  const region = String(oss.region || 'oss-cn-beijing').trim()
  const object = String(oss.object || 'panjue_feed.json').trim()
  if (!accessKeyId || !accessKeySecret) {
    die(
      'secrets/local.json 缺少 oss.accessKeyId / oss.accessKeySecret\n' +
        '在阿里云控制台 → AccessKey 管理 创建（建议用 RAM 子账号，只授 OSS 权限）'
    )
  }
  return { accessKeyId, accessKeySecret, bucket, region, object }
}

function sign(secret, stringToSign) {
  return crypto.createHmac('sha1', secret).update(stringToSign).digest('base64')
}

function putObject(cfg, body) {
  const host = `${cfg.bucket}.${cfg.region}.aliyuncs.com`
  const date = new Date().toUTCString()
  const contentType = 'application/json; charset=utf-8'
  const resource = `/${cfg.bucket}/${cfg.object}`
  // 含 x-oss-* 头时必须写入签名 CanonicalizedOSSHeaders
  const ossHeaders = 'x-oss-object-acl:public-read\n'
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${ossHeaders}${resource}`
  const signature = sign(cfg.accessKeySecret, stringToSign)
  const authorization = `OSS ${cfg.accessKeyId}:${signature}`

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        path: `/${cfg.object}`,
        method: 'PUT',
        headers: {
          Date: date,
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
          Authorization: authorization,
          'x-oss-object-acl': 'public-read',
          'Cache-Control': 'no-cache'
        }
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode })
          } else {
            reject(
              new Error(
                `OSS 上传失败 HTTP ${res.statusCode}: ${text.slice(0, 500)}`
              )
            )
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  if (!fs.existsSync(feedPath)) die('找不到 utils/panjue_feed.json，请先 npm run sync')
  const cfg = loadOss()
  const body = fs.readFileSync(feedPath)
  console.log(`上传 ${feedPath} → oss://${cfg.bucket}/${cfg.object}`)
  await putObject(cfg, body)
  const url = `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${cfg.object}`
  console.log('上传成功:', url)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
