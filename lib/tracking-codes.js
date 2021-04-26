'use strict'

const logger = require('console-files')

const db = require('./database')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

// find tracking code at frenet-api
const fetchTrackingEvents = require('./frenet-api/fetch-tracking-code')

// update order fulfilllment
const updateOrderfulfilllment = require('./store-api/update-fulfillments')

const sortEvents = e => e.sort((a, b) => {
  let c = 0
  if (a.EventDateTime > b.EventDateTime) {
    c = 1
  } else if (a.EventDateTime < b.EventDateTime) {
    c = -1
  }
  return c
})

const diffInDays = (createdAt) => {
  const today = new Date()
  const created = new Date(createdAt)
  const diff = today.getTime() - created.getTime()
  return Math.ceil(diff / (1000 * 3600 * 24))
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
          if (!codes[queue]) {
            // queue end
            return resolve()
          }

          const nextCode = () => {
            queue++
            return recursiveTracking(codes, queue)
          }

          const code = codes[queue]
          const storeId = code.store_id
          const serviceCode = code.service_code.startsWith('FR')
            ? String(code.service_code.replace(/[FR]+/g, '')).trim()
            : code.service_code

          if (storeId !== lastStore) {
            lastStore = storeId
            try {
              appConfig = await getConfig({ appSdk, storeId }, true)
            } catch (e) {
            }
          }

          if (!appConfig || !appConfig.frenet_access_token) {
            // no config for store bye
            return nextCode()
          }

          return fetchTrackingEvents(code.tracking_code, serviceCode, appConfig.frenet_access_token).then(async ({ ErrorMessage, TrackingEvents }) => {
            if (ErrorMessage && (!Array.isArray(TrackingEvents) || !TrackingEvents.length)) {
              const startWithError = [
                'Object reference not set to an instance of an object.',
                'Value cannot be null.',
                'Cannot deserialize the current JSON array'
              ].some(msg => ErrorMessage.startsWith(msg))

              if (startWithError || (ErrorMessage.startsWith('Objeto não encontrado na base de dados dos Correios.') &&
                diffInDays(code.created_at) >= 15)) {
                // remove pra evitar flod com errors
                await db.trackingCodes.remove(code.tracking_code, code.service_code, code.store_id).then(() => {
                  return logger.log('CodeRemoved', JSON.stringify({
                    code,
                    removed: true,
                    error: true
                  }))
                }).catch(e => logger.error('TrackingCodesRemoveErr', e))
              } else {
                logger.error('TrackingErrr', JSON.stringify({
                  ...code,
                  error: true,
                  ErrorMessage,
                  TrackingEvents
                }, undefined, 2))
              }

              return nextCode()
            }

            if (!TrackingEvents) {
              return nextCode()
            }

            const promises = []
            TrackingEvents = sortEvents(TrackingEvents)
            TrackingEvents.forEach(({ EventType, EventDateTime, EventDescription }) => {
              EventType = parseInt(EventType)
              promises.push(
                updateOrderfulfilllment(appSdk, storeId, code.order_id, code.tracking_code, EventType, EventDateTime)
                  .then(() => {
                    if (EventType === 9) {
                      db.trackingCodes.remove(code.tracking_code, code.service_code, storeId)
                    } else {
                      db.trackingCodes.update(EventType, code.tracking_code, storeId)
                    }
                  })
                  .then(() => logger.log('NewEvent', JSON.stringify({
                    message: 'Novo Evento',
                    order_id: code.order_id,
                    storeId,
                    code: code.tracking_code,
                    description: EventDescription
                  }, undefined, 2)))
                  .catch(err => {
                    if (err.response) {
                      const payload = {
                        message: err.message,
                        config: err.response.toJSON(),
                        order_id: code.order_id,
                        storeId
                      }
                      logger.error('UpdateEventsErr', JSON.stringify(payload, null, 2))
                    } else {
                      logger.error('UpdateEventsErr', err)
                    }
                  })
              )
            })

            return Promise.all(promises)
          }).finally(() => nextCode())
        }

        recursiveTracking(codes)
      })
  })

  db.trackingCodes.clear()
  setInterval(db.trackingCodes.clear, 24 * 60 * 60 * 1000)

  const start = () => trackingCodes().finally(() => {
    setTimeout(() => start(), 30 * 60 * 1000)
  })

  start()
}
