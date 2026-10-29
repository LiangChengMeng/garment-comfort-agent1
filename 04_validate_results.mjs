import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const args = {}
  argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      args[key] = value === undefined ? null : Number(value)
    }
  })
  return args
}

function calculatePMV(ta, tr, vel, rh, met, clo, wme = 0) {
  const pa = rh * 10 * Math.exp(16.6536 - 4030.183 / (ta + 235))
  // ISO 9920动态热阻修正：风速/活动降低有效热阻
  let effectiveClo = clo
  if (vel > 0.1 || met > 1.2) {
    let windCorrection = 1 - 0.25 * Math.min(vel / 3, 1)
    if (clo >= 3) windCorrection = 0.98
    const movementCorrection = 1 - 0.15 * Math.min((met - 1.2) / 5, 1)
    effectiveClo = Math.max(0.1, clo * windCorrection * movementCorrection)
  }
  const icl = 0.155 * effectiveClo
  const m = met * 58.15
  const w = wme * 58.15
  const mw = m - w

  let fcl
  if (icl <= 0.078) fcl = 1 + 1.29 * icl
  else fcl = 1.05 + 0.645 * icl

  const hcf = 12.1 * Math.sqrt(vel)
  const taa = ta + 273
  const tra = tr + 273
  let tcla = taa + (35.5 - ta) * (3.5 * icl + 0.1)
  const p1 = icl * fcl
  const p2 = p1 * 3.96
  const p3 = p1 * 100
  const p4 = p1 * taa
  const p5 = 308.7 - 0.028 * mw + p2 * Math.pow(tra / 100, 4)
  let xn = tcla / 100
  let xf = xn
  let n = 0
  const eps = 0.00015
  let hc

  while (n < 150) {
    xf = (xf + xn) / 2
    hc = 2.38 * Math.pow(Math.abs(100 * xf - taa), 0.25)
    if (hc < hcf) hc = hcf
    xn = (p5 + p4 * hc - p2 * Math.pow(xf, 4)) / (100 + p3 * hc)
    n++
    if (Math.abs(xn - xf) < eps) break
  }

  const tcl = 100 * xn - 273
  const hl1 = 3.05e-3 * (5733 - 6.99 * mw - pa)
  let hl2 = 0
  if (mw > 58.15) hl2 = 0.42 * (mw - 58.15)
  const hl3 = 1.7e-5 * m * (5867 - pa)
  const hl4 = 0.0014 * m * (34 - ta)
  const hl5 = 3.96 * fcl * (Math.pow(xn, 4) - Math.pow(tra / 100, 4))
  const hl6 = fcl * hc * (tcl - ta)
  const ts = 0.303 * Math.exp(-0.036 * m) + 0.028
  return ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6)
}

function pmvToScore(pmv) {
  const absPmv = Math.abs(pmv)
  if (absPmv <= 0.5) return Math.round(100 - absPmv * 20)
  const score = Math.round(100 - 10 - (absPmv - 0.5) * 25)
  return Math.max(0, Math.min(100, score))
}

const args = parseArgs(process.argv)
const required = ['ta', 'rh', 'vel', 'met']
for (const key of required) {
  if (args[key] === undefined || Number.isNaN(args[key])) {
    console.log(JSON.stringify({ success: false, error: `缺少参数--${key}` }))
    process.exit(1)
  }
}
const tr = args.tr ?? args.ta
const topN = args.top ?? 3

const fabricRaw = fs.readFileSync(path.resolve(__dirname, '../data/fabric_dataset.json'), 'utf-8')
const fabricData = JSON.parse(fabricRaw)

const results = fabricData.fabrics.map((f) => {
  const pmv = calculatePMV(args.ta, tr, args.vel, args.rh, args.met, f.garment_total_clo)
  const score = pmvToScore(pmv)
  return {
    id: f.id,
    name: f.name,
    composition: f.composition,
    pmv: Number(pmv.toFixed(2)),
    comfort_score: score,
    sensation: pmv < -0.5 ? '偏冷' : pmv > 0.5 ? '偏热' : '舒适',
    typical_use: f.typical_use,
  }
})

results.sort((a, b) => b.comfort_score - a.comfort_score)
const recommended = results.slice(0, topN)
const notRecommended = results.slice(topN).map((r) => ({
  name: r.name,
  reason: r.pmv > 0.5 ? '热阻过高/透气不足，体感偏热' : r.pmv < -0.5 ? '热阻不足，体感偏冷' : '舒适度低于推荐方案',
}))

console.log(JSON.stringify({
  success: true,
  scene: {
    temperature: args.ta,
    humidity: args.rh,
    wind_speed: args.vel,
    activity_met: args.met,
  },
  total_calculated: results.length,
  top_recommended: recommended,
  other_fabrics: notRecommended,
}, null, 2))
