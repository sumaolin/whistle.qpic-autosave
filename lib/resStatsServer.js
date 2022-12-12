/* eslint-disable semi */
const fs = require('fs')
const path = require('path')
const download = require('download')

const { check: checkFilter, update: updateFilter } = require('./filter')

const MAX_LENGTH = 10
const noop = () => {}
const whiteList = ['192.168', 'localho', '127.0.0'] // 本地开发地址的 前七位

module.exports = (server, { storage }) => {
  let sessions = []
  let timer
  const writeSessions = (dir) => {
    try {
      const oldS = sessions.slice()
      oldS.map((osItem) => {
        const { url, req } = osItem
        const prefixId = req.ip.slice(0, 7)
        if (whiteList.includes(prefixId)) {
          const fname = url.split('/')[4]
          const fpath = path.resolve(dir, `${fname}.png`)
          download(url).pipe(fs.createWriteStream(fpath))
        }
      })

      const text = JSON.stringify(sessions.slice(), null, '  ')
      sessions = []
      dir = path.resolve(dir, `${Date.now()}.json`)
      fs.writeFile(dir, text, (err) => {
        if (err) {
          fs.writeFile(dir, text, noop)
        }
      })
    } catch (e) {}
  }
  updateFilter(storage.getProperty('filterText'))
  server.on('request', (req) => {
    // filter
    const active = storage.getProperty('active')
    if (!active) {
      return
    }
    const dir = storage.getProperty('sessionsDir')
    if (!dir || typeof dir !== 'string') {
      sessions = []
      return
    }
    if (!checkFilter(req.originalReq.url)) {
      return
    }
    req.getSession((s) => {
      if (!s) {
        return
      }
      clearTimeout(timer)
      sessions.push(s)
      if (sessions.length >= MAX_LENGTH) {
        writeSessions(dir)
      } else {
        // 10秒之内没满10条强制写入
        timer = setTimeout(() => writeSessions(dir), 10000)
      }
    })
  })
}
