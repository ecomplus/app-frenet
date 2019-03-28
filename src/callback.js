'use strict'
const callback = require('express').Router()
const { ecomAuth } = require('ecomplus-app-sdk')
const logger = require('console-files')
/**
 * @description handle ecomplus callbacks
 */
callback.post('', (request, response) => {
  ecomAuth.then(sdk => {
    let storeId = parseInt(request.headers['x-store-id'], 10)
    let body = request.body
    sdk.handleCallback(storeId, body).then(({ isNew, authenticationId }) => {
      // just respond first
      response.status(204)
      return response.end()
    })
      .catch(err => {
        if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
          // debug SQLite errors
          logger.error(err)
        }
        response.status(500)
        return response.send({ erro: 'frenet_callback_erro', message: err.message })
      })
  })
    .catch(e => {
      logger.error('Erro with ecomplus-app-sdk' + e)
      response.status(400)
      return response.end()
    })
})

module.exports = callback
