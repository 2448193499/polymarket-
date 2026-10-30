const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

function walk(d, acc = []) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name)
    if (n.isDirectory()) {
      if (n.name === 'node_modules' || n.name === '.git') continue
      walk(p, acc)
    } else {
      acc.push({ rel: path.relative(root, p), size: fs.statSync(p).size })
    }
  }
  return acc
}

const all = walk(root).sort((a, b) => b.size - a.size)
all.slice(0, 30).forEach((x) => {
  console.log((x.size / 1024).toFixed(1) + 'KB', x.rel)
})
const sum = all.reduce((s, x) => s + x.size, 0)
console.log('sumMB', (sum / 1024 / 1024).toFixed(2))
