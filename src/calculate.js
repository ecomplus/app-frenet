'use strict'
const rq = require('request')
module.exports = (request, response) => {
  const frenetApiUri = 'http://api.frenet.com.br/shipping/quote'
  //
  const { application, params } = request.body
  const frenetToken = application.hidden_data.frenet_access_token
  //
  // const storeId = request.headers['x-store-id']

  //
  const toFrenetSchema = (items, subtotal, from, to) => {
    if (!items || !from || !to || !subtotal) {
      let resp = {
        'status': 400,
        'message': 'Invalid value on resource ID',
        'user_message': {
          'en_us': 'The informed ID is invalid',
          'pt_br': 'O ID informado é inválido'
        },
        'more_info': null
      }
      return response
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(resp)
    }
    //
    return {
      'SellerCEP': from.zip.replace('-', ''),
      'RecipientCEP': to.zip.replace('-', ''),
      'ShipmentInvoiceValue': subtotal,
      'ShippingItemArray': items.map(item => {
        return {
          'Weight': item.weight.value,
          'Length': item.dimensions.length.value,
          'Height': item.dimensions.heigth.value,
          'Width': item.dimensions.width.value,
          'Quantity': item.quantity
        }
      })
    }
  }

  //
  const toEcomplusSchema = (shippingServices, to, from) => {
    let schema = shippingServices.filter(service => !service.Error)
      .map(service => {
        return {
          'label': service.ServiceDescription,
          'carrier': service.Carrier,
          'service_name': service.ServiceDescription,
          'service_code': 'FR ' + service.ServiceCode,
          'shipping_line': {
            'from': {
              'zip': from.postal_code,
              'street': from.address,
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
        uri: frenetApiUri,
        headers: {
          'Accept': 'application/json',
          'Authorization': 'token ' + frenetToken
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
      let resp = toEcomplusSchema(result, params.to, application.hidden_data.from)
      return response
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(resp)
    })
    .catch(e => {
      return response
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end({ 'Error: ': e })
    })
}
