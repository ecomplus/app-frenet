'use strict'
const calculate = require('express').Router()
const rq = require('request')
const logger = require('console-files')

calculate.post('', (request, response) => {
  // retrieves application and params from body
  const { application, params } = request.body
  // token
  const frenetToken = application.hidden_data && application.hidden_data.frenet_access_token

  // token was sent?
  if (frenetToken) {
    let items = params.items
    let subtotal = params.subtotal
    let from = application.hidden_data.from
    let to = params.to

    const freeShippingFromValue = () => {
      if (application.hasOwnProperty('data') && application.data.hasOwnProperty('free_shipping_from_value')) {
        return application.data.free_shipping_from_value
      } else {
        return ''
      }
    }

    // checks if required params was sent at request
    if (!items || !from || !to || !subtotal) {
      let resp = {
        shipping_services: [],
        free_shipping_from_value: freeShippingFromValue()
      }
      return response.status(200).send(resp)
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
        const { dimensions } = item
        const getDimension = side => {
          if (dimensions && dimensions[side]) {
            const { value, unit } = dimensions[side]
            switch (unit) {
              case 'm':
                return value / 100
              case 'dm':
                return value / 10
              case 'cm':
                return value
            }
          }
          return 10
        }
        
        schema.ShippingItemArray.push({
          Weight: item.weight.unit === 'g' ? (item.weight.value / 1000) : item.weight.value,
          Length: getDimension('length'),
          Height: getDimension('height'),
          Width: getDimension('width'),
          Quantity: item.quantity
        })
      })

      return schema
    }

    // parse frenet response to ecomplus module
    const toEcomplusSchema = (shippingServices, to, from) => {
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
        // check for frenet error response
        const { ShippingSevicesArray } = result
        if (ShippingSevicesArray && ShippingSevicesArray[0]) {
          if (ShippingSevicesArray[0].Error && ShippingSevicesArray[0].Msg) {
            return response.status(400).send({
              error: 'FRENET_CALCULATE_ERR',
              message: ShippingSevicesArray[0].Msg
            })
          }
        }

        response.status(200).send({
          shipping_services: toEcomplusSchema(result, params.to, application.hidden_data.from) || [],
          free_shipping_from_value: freeShippingFromValue()
        })
      })
      
      .catch(e => {
        const error = 'FRENET_REQUEST_ERROR'
        logger.error(error, e)
        response.status(400).send({ error })
      })
  } else {
    response.status(401).send({
      error: true,
      message: 'Token not found'
    })
  }
})

module.exports = calculate
