'use strict'
const logger = require('console-files')

const db = require('./database')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

// find tracking code at frenet-api
const fetchTrackingEvents = require('./frenet-api/fetch-tracking-code')

// update order fulfilllment
const updateOrderfulfilllment = require('./store-api/update-fulfillments')

const sortEvents = events => {
  const sort = events.sort((a, b) => {
    let c = 0
    if (a.EventDateTime > b.EventDateTime) {
      c = 1
    } else if (a.EventDateTime < b.EventDateTime) {
      c = -1
    }
    return c
  })
  return sort
}

module.exports = (appSdk) => {
  logger.log('Automatic tracking code update started.')

  const trackingCodes = () => new Promise((resolve, reject) => {
    return db.trackingCodes.getAll().catch(err => {
      if (!err.name || err.name !== 'NoTrackingCodesForUpdate') {
        logger.error('TrackingCodesErr', err)
      }
      return null
    })
      .then(codes => {
        let appConfig
        let lastStore
        const recursiveTracking = async (codes, queue = 0) => {
          const nextCode = () => {
            queue++
            return recursiveTracking(codes, queue)
          }

          if (!codes[queue]) {
            // queue end
            return resolve()
          }
          const code = codes[queue]
          const storeId = code.store_id
          const serviceCode = code.service_code.startsWith('FR') ?
            String(code.service_code.replace(/[FR]+/g, '')) :
            code.service_code

          if (storeId !== lastStore) {
            lastStore = storeId
            appConfig = await getConfig({ appSdk, storeId }, true)
          }

          if (!appConfig || !appConfig.frenet_access_token) {
            // no config for store bye
            return nextCode()
          }

          return fetchTrackingEvents(code.tracking_code, serviceCode, appConfig.frenet_access_token).then(data => {
            const { ErrorMessage, TrackingEvents } = data

            // erro? bye
            if (ErrorMessage ||
              !Array.isArray(TrackingEvents)
              || !TrackingEvents.length) {
              if (!ErrorMessage.startsWith('Cannot deserialize the current JSON array')) {
                logger.error(`Erro com o código de rastreio ${code.tracking_code} / ${storeId} | Error: ${ErrorMessage}`)
              }
              return nextCode()
            }

            const promises = []
            TrackingEvents = sortEvents(TrackingEvents)
            TrackingEvents.forEach(({ EventType, EventDateTime, EventDescription }) => {
              promises.push(db.trackingEvents
                .get(code.tracking_code, EventDescription, storeId)
                .catch(error => {
                  EventType = parseInt(EventType)
                  if (error.name === 'EventNotFound') {
                    return Promise.all([
                      updateOrderfulfilllment(appSdk, storeId, code.order_id, code.tracking_code, EventType, EventDateTime),
                      db.trackingEvents.save(EventDescription, EventType, code.tracking_code, storeId),
                      db.trackingCodes.update(EventType, code.tracking_code, storeId)
                    ]).then(() => logger.log(`Evento atualizado para pedido ${code.order_id} | ${storeId} | Code ${code.tracking_code} | Event: ${EventDescription}`))
                  }

                  return null
                }))
            })

            return Promise.all(promises)
          }).finally(() => nextCode())
        }

        recursiveTracking(codes)
      })
  })

  const start = () => trackingCodes().finally(() => {
    setTimeout(() => start(), 2 * 60 * 1000)
  })

  start()
}