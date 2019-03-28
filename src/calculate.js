'use strict'

const calculate = require('express').Router()
const rq = require('request')

calculate.post('', (request, response) => {
  // retrieves application and params from body
  const { application, params } = request.body
  // token
  let frenetToken = (application.hasOwnProperty('hidden_data') && application.hidden_data.hasOwnProperty('frenet_access_token')) ? application.hidden_data.frenet_access_token : undefined

  if (frenetToken) {
    //
    const toFrenetSchema = (items, subtotal, from, to) => {
      if (!items || !from || !to || !subtotal) {
        let resp = {
          'status': 400,
          'message': 'invalid request, post must has properties `items`, `from`, `to` and `subtotal`'
        }
        return response
          .set('Content-Type', 'application/json')
          .send(400, resp)
      }
      //
      return {
        'SellerCEP': from.zip.replace('-', ''),
        'RecipientCEP': to.zip.replace('-', ''),
        'ShipmentInvoiceValue': subtotal,
        'ShippingItemArray': getItens(items)
      }
    }

    const getItens = items => {
      let result = items.map(item => {
        return {
          'Weight': item.weight.value,
          'Length': item.dimensions.length.value,
          'Height': item.dimensions.height.value,
          'Width': item.dimensions.width.value,
          'Quantity': item.quantity
        }
      })
      return result
    }
    //
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
              'price': service.ShippingPrice,
              'total_price': service.ShippingPrice,
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

    //
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

    let calculate = toFrenetSchema(params.items, params.subtotal, application.hidden_data.from, params.to)

    //
    apiRequest(calculate)
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
        return response
          .status(400)
          .send({ 'error': e })
      })
  } else {
    let resp = {
      'status': 400,
      'message': 'Frenet token not found'
    }
    response.status(400)
    return response.send(resp)
  }
})

module.exports = calculate
