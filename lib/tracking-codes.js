'use strict'
const logger = require('console-files')

// db
const { trackingCodes, trackingEvents } = require('./database')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

// find tracking code at frenet-api
const fetchTrackingCode = require('./frenet-api/fetch-tracking-code')

// update order fulfilllment
const updateOrderfulfilllment = require('./store-api/update-fulfillments')

module.exports = appSdk => {
  const tracking = () => new Promise(async resolve => {
    let index = 0
    let config
    let currentStore
    const codes = await trackingCodes.getAll()

    const task = async () => {
      logger.log(`
      --> Start updating tracking codes\n
      -> Total: ${codes.length}\n
      `)

      if (Array.isArray(codes) && codes[index]) {
        const tracking = codes[index]
        const storeId = tracking.store_id
        let serviceCode = tracking.service_code

        const next = () => {
          index++
          return task()
        }

        // prevents fetching application settings for the same storeId
        if (tracking.store_id !== currentStore) {
          config = await getConfig({ appSdk, storeId }, true)
        }

        currentStore = tracking.store_id

        if (config.frenet_access_token) {
          // preventing saving serviceCode with application prefix
          if (tracking.service_code.startsWith('FR')) {
            serviceCode = String(serviceCode.replace(/[FR]+/g, ''))
          }

          fetchTrackingCode(tracking.tracking_code, serviceCode, config.frenet_access_token)
            .then(resp => {
              const { ErrorMessage } = resp
              if (ErrorMessage) {
                logger.error(`Erro with tracking code ${tracking.tracking_code} | Message: ${ErrorMessage}`)
                next()
              } else {
                if (Array.isArray(resp.TrackingEvents) && resp.TrackingEvents.length) {
                  const events = resp.TrackingEvents
                  // sort by date
                  events.sort((a, b) => {
                    let c = 0
                    if (a.EventDateTime > b.EventDateTime) {
                      c = 1
                    } else if (a.EventDateTime < b.EventDateTime) {
                      c = -1
                    }
                    return c
                  })

                  let promises = []
                  let promise
                  events.forEach(event => {
                    // get event at db
                    promise = trackingEvents
                      .get(tracking.tracking_code, event.EventDescription, storeId)
                      .catch(async err => {
                        if (err.name === 'EventNotFound') {
                          await trackingEvents
                            // save event
                            .save(event.EventDescription, parseInt(event.EventType), tracking.tracking_code, storeId)
                            // update order fulfillment
                            .then(() => updateOrderfulfilllment(appSdk, storeId, tracking.order_id, tracking.tracking_code, parseInt(event.EventType), event.EventDateTime))
                            // insert current event in db
                            .then(() => trackingCodes.update(parseInt(event.EventType), tracking.tracking_code, storeId))
                            // error
                            .catch(e => logger.log(e))
                        }
                      })
                    promises.push(promise)
                  })

                  Promise.all(promises).then(() => next())
                } else {
                  next()
                }
              }
            })
            .catch(err => {
              logger.error(err)
              next()
            })
        } else {
          next()
        }
      } else {
        resolve()
      }
    }

    task()
  })

  tracking()
    .then(() => {
      const interval = (process.env.TRACKING_SERVICE_INTERVAL || 5) * 60 * 1000
      setTimeout(() => {
        return tracking()
      }, interval)
      logger.log(`--> Update tracking codes is idle for ${interval / 1000} minutes\n`)
    })
}
