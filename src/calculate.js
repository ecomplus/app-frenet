'use strict'
const calculate = require('express').Router()
const rq = require('request')
const logger = require('console-files')

calculate.post('', (request, response) => {
  // retrieves application and params from body
  const { application, params } = request.body
  
  // token
  let frenetToken = (application.hasOwnProperty('hidden_data') && application.hidden_data.hasOwnProperty('frenet_access_token')) ? application.hidden_data.frenet_access_token : undefined

  // token was sent?
  if (frenetToken) {
    let items = params.items
    let subtotal = params.subtotal
    let from = application.hidden_data.from
    let to = params.to

    // checks if required params was sent at request
    if (!items || !from || !to || !subtotal) {
      let resp = {
        error: true,
        message: 'invalid request, post must have properties `items`, `from`, `to` and `subtotal`'
      }
      return response.status(400).send(resp)
    }

    // parse frenet schema
    const toFrenetSchema = (items, subtotal, from, to) => {
      const schema = {
        SellerCEP: from.zip.replace('-', ''),
        RecipientCEP: to.zip.replace('-', ''),
        ShipmentInvoiceValue: subtotal,
        ShippingItemArray: []
      }

      items.forEach(item => {
        schema.ShippingItemArray.push({
          'Weight': (item.weight.value / 1000) || '1',
          'Length': (item.hasOwnProperty('dimensions') && item.dimensions.hasOwnProperty('length')) ? item.dimensions.length.value : '1',
          'Height': (item.hasOwnProperty('dimensions') && item.dimensions.hasOwnProperty('height')) ? item.dimensions.height.value : '1',
          'Width': (item.hasOwnProperty('dimensions') && item.dimensions.hasOwnProperty('width')) ? item.dimensions.width.value : '1',
          'Quantity': item.quantity
        })
      })

      return schema
    }

    // parse frenet response to ecomplus module
    const toEcomplusSchema = (shippingServices, to, from) => {
      console.log(JSON.stringify(shippingServices))
      let schema = shippingServices.ShippingSevicesArray.filter(service => !service.Error)
        .map(service => {
          return {
            'label': service.ServiceDescription,
            'carrier': service.Carrier,
            'service_name': service.ServiceDescription,
            'service_code': 'FR ' + service.ServiceCode,
            'shipping_line': {
              'from': {
                'zip': from.zip,
                'street': from.street,
                'number': from.number
              },
              'to': {
                'zip': to.zip,
                'name': to.name,
                'street': to.street,
                'number': to.number,
                'borough': to.borough,
                'city': to.city,
                'province_code': to.province_code
              },
              'delivery_time': {
                'days': parseInt(service.DeliveryTime)
              },
              'price': parseFloat(service.ShippingPrice),
              'total_price': parseFloat(service.ShippingPrice),
              'custom_fields': [
                {
                  'field': 'by_frenet',
                  'value': 'true'
                }
              ]
            }
          }
        })
      return schema
    }

    // request
    const apiRequest = data => {
      return new Promise((resolve, reject) => {
        let options = {
          method: 'POST',
          url: 'http://api.frenet.com.br/shipping/quote',
          headers: {
            'Content-Type': 'application/json',
            token: frenetToken
          },
          body: data,
          json: true
        }
        rq.post(options, (erro, resp, body) => {
          if (erro || resp.statusCode >= 400) {
            reject(new Error('Frenet api request failed.'))
          }
          resolve(body)
        })
      })
    }

    // schema
    let schema = toFrenetSchema(items, subtotal, from, to)

    // request frenet api
    apiRequest(schema)
      .then(result => {
        let objResponse = {}
        objResponse.shipping_services = toEcomplusSchema(result, params.to, application.hidden_data.from) || []
        if (application.hasOwnProperty('data') && application.data.hasOwnProperty('free_shipping_from_value')) {
          objResponse.free_shipping_from_value = application.data.free_shipping_from_value
        }

        return response
          .status(200)
          .send(objResponse)
      })
      .catch(e => {
        logger.log('CALCULATE_RESPONSE', e)
        return response.status(400).send({ 'error': e })
      })
  } else {
    logger.log('CALCULATE_RESPONSE: token not found')
    return response.status(400).send({
      error: true,
      message: 'token not found'
    })
  }
})

module.exports = calculate
