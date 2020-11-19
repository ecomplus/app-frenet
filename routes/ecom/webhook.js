'use strict'
const logger = require('console-files')
const { trackingCodes } = require('./../../lib/database')

const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'

module.exports = (appSdk) => async (req, res) => {
  const { storeId, body } = req
  const orderId = body.resource_id

  const orderBody = await appSdk.apiRequest(storeId, `/orders/${orderId}.json`).then(({ response }) => response.data)
  if (!orderBody) {
    return res.status(500).end()
  } // 503?

  if (!orderBody.shipping_lines) {
    return res.send(ECHO_SKIP)
  }

  const promises = []
  orderBody.shipping_lines.forEach((line) => {
    if (line.custom_fields && line.custom_fields.find(({ field }) => field === 'by_frenet')) {
      if (line.tracking_codes) {
        line.tracking_codes.forEach(({ code }) => {
          promises.push(trackingCodes.get(orderId, code, storeId)
            .then(() => (ECHO_SKIP))
            .catch(error => {
              // trackcode not exists
              // save has new
              if (error.name === 'TrackingCodeNotFound') {
                const { app } = line
                return trackingCodes.save(orderId, storeId, 0, code, app.service_code)
                  .then(() => (logger.log(`>> Codigo de rastreio ${code} salvo para o pedido ${orderId} / #${storeId}`)))
                  .then({
                    code,
                    storeId
                  })
              }

              return null
            }))
        })
      }
    }
  })

  Promise.all(promises).finally((r) => {
    return res.send(ECHO_SKIP)
  })
}
