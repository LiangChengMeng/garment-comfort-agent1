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

const args = parseArgs(process.argv)
const warnings = []
const ta = args.ta

if (ta === undefined || Number.isNaN(ta)) {
  console.log(JSON.stringify({ success: false, error: '必须通过--ta=传入空气温度' }))
  process.exit(1)
}

if (ta < -40 || ta > 50) {
  console.log(JSON.stringify({ success: false, error: '空气温度超出合理范围（-40℃~50℃），请重新输入' }))
  process.exit(1)
}

let rh = args.rh
let vel = args.vel
let met = args.met
let tr = args.tr

if (rh === undefined || rh === null || Number.isNaN(rh)) {
  rh = 50
  warnings.push('未输入相对湿度，已按通用场景默认补全为50%')
} else if (rh < 0 || rh > 100) {
  console.log(JSON.stringify({ success: false, error: '相对湿度需在0~100%之间，请重新输入' }))
  process.exit(1)
}

if (vel === undefined || vel === null || Number.isNaN(vel)) {
  vel = 0.1
  warnings.push('未输入风速，已按室内无风场景默认补全为0.1m/s')
} else if (vel < 0 || vel > 20) {
  console.log(JSON.stringify({ success: false, error: '风速需在0~20m/s之间，请重新输入' }))
  process.exit(1)
}

if (met === undefined || met === null || Number.isNaN(met)) {
  met = 1.1
  warnings.push('未输入活动强度，已按静坐办公场景默认补全为1.1met')
} else if (met < 0.8 || met > 10) {
  console.log(JSON.stringify({ success: false, error: '活动强度超出人类活动合理范围，请重新输入' }))
  process.exit(1)
}

if (tr === undefined || tr === null || Number.isNaN(tr)) {
  tr = ta
  warnings.push('未输入辐射温度，已默认等于空气温度')
}

console.log(JSON.stringify({
  success: true,
  params: {
    air_temperature: ta,
    relative_humidity: rh,
    air_speed: vel,
    met,
    radiant_temperature: tr,
  },
  warnings,
}, null, 2))
