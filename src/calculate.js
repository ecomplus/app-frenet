'use strict'
const calculate = require('express').Router()
const request = require('request')

calculate.post('', (req, res) => {
  const { params, application } = req.body
  // app configured options
  const config = Object.assign({}, application.data, application.hidden_data)

  if (!config.frenet_access_token) {
    res.status(401).send({
      error: 'FRENET_ERR',
      message: 'Frenet token not found on app hidden data'
    })
  }

  const { items, subtotal, to } = params
  const payload = {}
  payload.shipping_services = []

  if (config.free_shipping_from_value) {
    payload.free_shipping_from_value = config.free_shipping_from_value
  }

  if (!items || !subtotal || !to || !config.from) {
    // parameters required to perform the request
    return res.status(200).send(payload)
  } else {
    // frenet api schema
    const frenetSchema = () => {
      const data = {
        SellerCEP: config.from.zip.replace('-', ''),
        RecipientCEP: to.zip.replace('-', ''),
        ShipmentInvoiceValue: subtotal,
        ShippingItemArray: []
      }
      items.forEach(item => {
        const { weight, quantity } = item
        data.ShippingItemArray.push({
          Weight: weight.unit === 'g' ? (weight.value / 1000) : weight.value,
          Length: getDimension('length', item),
          Height: getDimension('height', item),
          Width: getDimension('width', item),
          Quantity: quantity
        })
      })
      return data
    }

    // frenet api request
    const frenetRequest = schema => {
      return new Promise((resolve, reject) => {
        const url = 'http://api.frenet.com.br/shipping/quote'
        request(url, {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'token': config.frenet_access_token
          },
          body: schema,
          json: true
        }, (err, resp, body) => {
          if (err || resp.statusCode >= 400) {
            reject(body)
          }
          resolve(body)
        })
      })
    }

    frenetRequest(frenetSchema())

      .then(result => {
        // check for frenet error response
        const { ShippingSevicesArray } = result

        if (ShippingSevicesArray && Array.isArray(ShippingSevicesArray) && ShippingSevicesArray.length) {
          if (ShippingSevicesArray[0].Error && ShippingSevicesArray[0].Msg) {
            return res.status(400).send({
              error: 'FRENET_API_ERR',
              message: ShippingSevicesArray[0].Msg
            })
          }
        }

        payload.shipping_services = ecomplusSchema(ShippingSevicesArray, to, config.from) || []

        return res.status(200).send(payload)
      })

      .catch(err => {
        return res.status(500).send({
          error: 'FRENET_API_ERR',
          message: 'Unexpected Error Try Later',
          erro: err
        })
      })
  }
})

const getDimension = (side, item) => {
  if (item.dimensions && item.dimensions[side]) {
    const { value, unit } = item.dimensions[side]
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

const ecomplusSchema = (ShippingSevicesArray, to, from) => {
  const data = ShippingSevicesArray
    .filter(service => !service.Error)
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
  return data
}

module.exports = calculate
