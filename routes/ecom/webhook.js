'use strict'
const logger = require('console-files')
const { trackingCodes } = require('./../../lib/database')

const ECHO_SKIP = 'SKIP'

const pattern = /rastreador|lang|version|(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/

const isUrl = str => pattern.test(str)

const handler = appSdk => async (req, res) => {
  const { storeId, body } = req
  const orderId = body.resource_id

  return appSdk.apiRequest(storeId, `/orders/${orderId}.json`)
    .then(({ response }) => {
      const { data } = response
      if (!data.shipping_lines) {
        return res.send(ECHO_SKIP)
      }

      const promises = []

      data.shipping_lines.forEach(shipping => {
        if (shipping.tracking_codes &&
          shipping.custom_fields &&
          shipping.custom_fields.find(({ field }) => field === 'by_frenet')
        ) {
          shipping.tracking_codes.forEach(({ code }) => {
            // algumas integrações enviam um link de rastreamento
            // ao invés do código de rastreamento, como é o caso do bling
            // para evitar gargalos na fila só salva se for código
            if (code && !isUrl(code)) {
              const promise = trackingCodes.get(orderId, code, storeId)
                .then(() => (ECHO_SKIP))
                .catch(error => {
                  // caso o código não exista no db é salvo
                  if (error.name === 'TrackingCodeNotFound') {
                    const { app } = shipping
                    return trackingCodes.save(orderId, storeId, 0, code, app.service_code)
                      .then(() => logger.log('@INFO:', JSON.stringify({
                        event: 'webhook',
                        order_id: orderId,
                        storeId,
                        code,
                        success: true,
                        message: 'Código de rastreio salvo com sucesso.'
                      }, undefined, 2)))
                  }
                  return null
                })
              promises.push(promise)
            } else {
              logger.log('@ERROR:', JSON.stringify({
                event: 'webhook',
                order_id: orderId,
                storeId,
                code,
                failed: true,
                message: 'Não foi possivel salvar código de rastreio pois seu formato é inválido.',
                tracking_codes: shipping.tracking_codes
              }, undefined, 2))
            }
          })
        }
      })

      return Promise.all(promises)
    })
    .then(() => res.send(ECHO_SKIP))
    .catch((err) => {
      console.log(err)
      return res.status(500).end()
    })
}

module.exports = handler
