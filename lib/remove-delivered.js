const db = require('./database')
const logger = require('console-files')

const handler = () => {
  const job = () => new Promise((resolve, reject) => {
    return db.trackingCodes.getAllDelivered().then(codes => {
      codes.forEach(async code => {
        try {
          await db.trackingCodes.remove(code.tracking_code, code.service_code, code.store_id)
          logger.log('@INFO:', JSON.stringify({
            event: 'Código Removido',
            code,
            removed: true,
            error: false,
            delivered: true
          }, undefined, 2))
        } catch (err) {
          logger.error('@Error ao excluir o código de rastreio')
        }
      })
    })
  })

  // remove todos tracking_codes com mais de dois meses atras
  setInterval(db.trackingCodes.clear, 24 * 60 * 60 * 1000)

  const run = () => {
    job().catch(logger.error).finally(() => {
      setTimeout(run, 30 * 60 * 1000)
    })
  }

  run()
}

module.exports = handler
