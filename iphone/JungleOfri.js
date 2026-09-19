// הג׳ונגל של עופרי ואופק - וידג׳ט לאייפון
const API = 'https://jungle-watering-api.mqog1v.workers.dev/watering'
const SCRIPT_NAME = Script.name()
const PLANTS = [
  { id: 'pothos', name: 'התאומים המטפסים', every: 7, color: '#3E8E4F' },
  { id: 'monstera', name: 'מפלצת הגבינה', every: 7, color: '#00796B' },
  { id: 'snake', name: 'השריד', every: 14, color: '#9E9D24' },
  { id: 'dracaena', name: 'הלימוני המפוספס', every: 10, color: '#D99413' },
  { id: 'succulents', name: 'שלישיית השושנים', every: 17, color: '#E07A5F' }
]

function uuid() {
  if (typeof UUID !== 'undefined') return UUID.string()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 3 | 8)).toString(16)
  })
}
function startOfDay(ms) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
function daysSince(ms) {
  return Math.max(0, Math.floor((startOfDay(Date.now()) - startOfDay(ms)) / 86400000))
}
function newestByPlant(entries) {
  const out = {}
  for (const e of entries) if (!out[e.plant] || e.at > out[e.plant].at) out[e.plant] = e
  return out
}
function statusFor(plant, entry) {
  if (!entry) return { text: 'לבדוק היום', due: true, last: 'אין השקיה מתועדת' }
  const age = daysSince(entry.at)
  const left = plant.every - age
  const status = left <= 0 ? 'לבדוק היום' : left === 1 ? 'לבדוק מחר' : `עוד ${left} ימים`
  const when = age === 0 ? 'היום' : age === 1 ? 'אתמול' : `לפני ${age} ימים`
  return { text: status, due: left <= 0, last: `הושקה ${when}${entry.by ? ` · ${entry.by}` : ''}` }
}
async function getEntries() {
  const r = new Request(API)
  r.timeoutInterval = 12
  return await r.loadJSON()
}
async function saveWatering(plant) {
  const r = new Request(API)
  r.method = 'POST'
  r.headers = { 'Content-Type': 'application/json' }
  const now = Date.now()
  r.body = JSON.stringify({ id: uuid(), plant: plant.id, at: now, timestamp: now, by: 'עופרי' })
  r.timeoutInterval = 12
  return await r.loadJSON()
}
async function confirmAndSave(id) {
  const plant = PLANTS.find(p => p.id === id)
  if (!plant) return
  const alert = new Alert()
  alert.title = `להשקות את ${plant.name}?`
  alert.message = 'ההשקיה תירשם בשם עופרי ביומן המשותף.'
  alert.addAction('כן, השקיתי')
  alert.addCancelAction('ביטול')
  if (await alert.presentAlert() !== 0) return
  try {
    await saveWatering(plant)
    const done = new Notification()
    done.title = 'נשמר ✓'
    done.body = `${plant.name} הושקה על ידי עופרי`
    await done.schedule()
  } catch (e) {
    const fail = new Alert()
    fail.title = 'לא הצלחנו לשמור'
    fail.message = 'בדקי שיש חיבור לאינטרנט ונסי שוב.'
    fail.addAction('הבנתי')
    await fail.presentAlert()
  }
}
function actionURL(id) {
  return `scriptable:///run?scriptName=${encodeURIComponent(SCRIPT_NAME)}&plant=${encodeURIComponent(id)}`
}
function addRow(widget, plant, entry) {
  const state = statusFor(plant, entry)
  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.size = new Size(0, 46)
  row.url = actionURL(plant.id)

  const dot = row.addText('●')
  dot.textColor = new Color(plant.color)
  dot.font = Font.systemFont(13)
  row.addSpacer(7)

  const copy = row.addStack()
  copy.layoutVertically()
  const name = copy.addText(plant.name)
  name.font = Font.boldSystemFont(13)
  name.textColor = Color.white()
  name.lineLimit = 1
  const last = copy.addText(state.last)
  last.font = Font.systemFont(10)
  last.textColor = new Color('#B8C9C2')
  last.lineLimit = 1

  row.addSpacer()
  const right = row.addStack()
  right.layoutVertically()
  const status = right.addText(state.text)
  status.rightAlignText()
  status.font = Font.semiboldSystemFont(11)
  status.textColor = state.due ? new Color('#FFB39F') : new Color('#CBE87B')
  const water = right.addText('השקיתי 💧')
  water.rightAlignText()
  water.font = Font.boldSystemFont(10)
  water.textColor = new Color('#FFFFFF')
}
async function makeWidget() {
  const w = new ListWidget()
  w.backgroundColor = new Color('#17392E')
  w.setPadding(14, 14, 12, 14)

  const title = w.addText('הג׳ונגל של עופרי ואופק')
  title.font = Font.boldSystemFont(16)
  title.textColor = Color.white()
  title.rightAlignText()
  const sub = w.addText('לחצי על צמח כדי לסמן שהשקית')
  sub.font = Font.systemFont(10)
  sub.textColor = new Color('#CBE87B')
  sub.rightAlignText()
  w.addSpacer(5)

  let entries = []
  let offline = false
  try { entries = await getEntries() } catch (e) { offline = true }
  const newest = newestByPlant(entries)
  PLANTS.forEach((p, i) => {
    addRow(w, p, newest[p.id])
    if (i < PLANTS.length - 1) {
      const line = w.addStack()
      line.size = new Size(0, 0.5)
      line.backgroundColor = new Color('#44675B')
    }
  })
  w.addSpacer(4)
  const foot = w.addText(offline ? 'אין חיבור · מוצג בלי מידע עדכני' : `עודכן ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`)
  foot.font = Font.systemFont(9)
  foot.textColor = new Color('#8FA89F')
  foot.rightAlignText()
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  return w
}

const requestedPlant = args.queryParameters.plant
if (requestedPlant) await confirmAndSave(requestedPlant)
const widget = await makeWidget()
if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentLarge()
Script.complete()
