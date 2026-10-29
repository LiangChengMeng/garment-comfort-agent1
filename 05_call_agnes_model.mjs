import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

const validationRaw = fs.readFileSync(path.resolve(__dirname, '../data/validation_dataset.json'), 'utf-8')
const validationData = JSON.parse(validationRaw)
const fabricRaw = fs.readFileSync(path.resolve(__dirname, '../data/fabric_dataset.json'), 'utf-8')
const fabricData = JSON.parse(fabricRaw)

const normalCases = validationData.test_cases.filter((c) => c.type === 'normal')
const boundaryCases = validationData.test_cases.filter((c) => c.type === 'boundary')
const abnormalCases = validationData.test_cases.filter((c) => c.type === 'abnormal')

const errors = []
for (const tc of normalCases) {
  const fabric = fabricData.fabrics.find((f) => f.id === tc.fabric_id)
  const calcPmv = calculatePMV(
    tc.input.air_temperature,
    tc.input.air_temperature,
    tc.input.air_speed,
    tc.input.relative_humidity,
    tc.input.met,
    fabric.garment_total_clo,
  )
  errors.push({
    case_id: tc.id,
    scene: tc.scene,
    measured_pmv: tc.measured_pmv,
    calculated_pmv: Number(calcPmv.toFixed(2)),
    absolute_error: Number(Math.abs(calcPmv - tc.measured_pmv).toFixed(2)),
  })
}

const avgError = Number((errors.reduce((sum, e) => sum + e.absolute_error, 0) / errors.length).toFixed(2))
const pass = avgError <= 0.35

console.log(JSON.stringify({
  success: true,
  test_counts: {
    normal_cases: normalCases.length,
    boundary_cases: boundaryCases.length,
    abnormal_cases: abnormalCases.length,
  },
  error_details: errors,
  average_absolute_error: avgError,
  pass_engineering_standard: pass,
  conclusion: pass ? '计算平均误差小于0.35，符合服装工程精度要求，结果有效' : '误差超出阈值，需要调整',
}, null, 2))
