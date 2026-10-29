import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.resolve(__dirname, '../data/fabric_dataset.json')
const raw = fs.readFileSync(dataPath, 'utf-8')
const data = JSON.parse(raw)

console.log(JSON.stringify({
  success: true,
  total_fabrics: data.fabrics.length,
  source: data.source,
  fabrics: data.fabrics,
}, null, 2))
