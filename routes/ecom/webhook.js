'use strict'
const logger = require('console-files')

// read configured E-Com Plus app data
// const getConfig = require(process.cwd() + '/lib/store-api/get-config')

const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'

// database
const { trackingCodes } = require('./../../lib/database')

module.exports = () => {
  return (req, res) => {
    const { storeId } = req
    const trigger = req.body

    if (trigger.fields && trigger.fields.includes('shipping_lines')) {
      const order = trigger.body
      const shippingLines = order.shipping_lines.find(shipping => shipping.custom_fields.find(custom => custom.field === 'by_frenet'))
      // has shipping_lines
      if (shippingLines.tracking_codes && Array.isArray(shippingLines.tracking_codes)) {
        // salve tracking code
        const orderId = trigger.resource_id
        const trackingCode = shippingLines.tracking_codes[0].code
        // find tracking code at database
        trackingCodes.get(orderId, trackingCode, storeId)

          .then(() => {
            // ignore if already saved
            res.send(ECHO_SKIP)
          })

          .catch(err => {
            // tracking code not found?
            // save then
            switch (err.name) {
              case 'TrackingCodeNotFound':
                const order = trigger.body
                const shippingLines = order.shipping_lines.find(shipping => shipping.custom_fields.find(custom => custom.field === 'by_frenet'))

                if (shippingLines.tracking_codes && Array.isArray(shippingLines.tracking_codes)) {
                  let serviceCode = shippingLines.app.service_code

                  trackingCodes
                    // save tracking code
                    .save(orderId, storeId, 0, trackingCode, serviceCode)
                    // log
                    .then(() => logger.log(`[!] Tracking code ${trackingCode} save for store #${storeId} / order --> ${orderId}`))
                    // bye
                    .then(() => res.send(ECHO_SUCCESS))
                }
                break

              default:
                res.send(ECHO_SKIP)
                break
            }
          })
      } else {
        res.send(ECHO_SKIP)
      }
    } else {
      res.send(ECHO_SKIP)
    }
  }
}
