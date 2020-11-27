const logger = require('console-files')
const { db, trackingCodes, trackingEvents } = require('./database')

module.exports = () => {
  logger.log('>> Gerenciador de codigos de restreios iniciado')
  const removeCodes = () => {
    return new Promise((resolve, reject) => {
      db.all('select * from tracking_codes where tracking_status = ?', [9], (err, rows) => {
        console.log('TOTOAL', rows)
        if (!rows) {
          resolve()
        } else if (err) {
          logger.error('REMOVECODESERR_SQL', err)
          reject(err)
        }

        const removeTrackingAndEvents = async (codes, queue = 0) => {
          if (!codes[queue]) {
            return resolve()
          }

          const next = () => {
            queue++
            return removeTrackingAndEvents(codes, queue)
          }

          const code = codes[queue]

          await trackingCodes.remove(code.tracking_code, code.service_code, code.store_id).then(() => {
            return trackingEvents.remove(code.tracking_code, code.store_id)
          }).then(() => {
            logger.log('DELETED_CODES', JSON.stringify({
              code,
              deleted: true,
              delivered: true,
              deleted_events: true,
              error: false
            }, undefined, 2))
            return next()
          }).catch(next)
        }

        removeTrackingAndEvents(rows)
      })
    })
  }

  const start = () => removeCodes().finally(() => {
    setTimeout(() => start(), 24 * 60 * 60 * 1000)
  })

  start()
}
