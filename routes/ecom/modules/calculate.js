'use strict'
const axios = require('axios')

module.exports = () => (req, res) => {
  const { storeId, body } = req
  const { params, application } = body
  const config = Object.assign({}, application.data, application.hidden_data)

  if (!config.frenet_access_token) {
    return res.status(401).send({
      error: 'FRENET_ERR',
      message: `Frenet token is unset on app hidden data (calculate unavailable) for store #${storeId}`
    })
  }

  const { items, subtotal, to } = params
  const payload = {
    shipping_services: []
  }

  if (config.free_shippin_from_value) {
    payload.free_shipping_from_value = config.free_shipping_from_value
  }

  if (!items || !subtotal || !to || !config.from) {
    // parameters required to perform the request
    return res.status(200).send(payload)
  }

  // calculate
  return new Promise((resolve, reject) => {
    try {
      const schema = {
        SellerCEP: config.from.zip.replace('-', ''),
        RecipientCEP: to.zip.replace('-', ''),
        ShipmentInvoiceValue: subtotal,
        ShippingItemArray: []
      }
      items.forEach(item => {
        const { weight, quantity } = item
        schema.ShippingItemArray.push({
          Weight: weight ? (weight.unit && weight.unit === 'g') ? (weight.value / 1000) : weight.value : undefined,
          Length: getDimension('length', item),
          Height: getDimension('height', item),
          Width: getDimension('width', item),
          Quantity: quantity
        })
      })
      resolve({ schema })
    } catch (error) {
      const err = new Error('Error with the body sent by the module')
      err.name = 'ParseFrenetSchemaError'
      err.error = error
      reject(err)
    }
  }).then(({ schema }) => {
    let opt = {
      url: 'http://api.frenet.com.br/shipping/quote',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'token': config.frenet_access_token
      },
      data: schema
    }

    return axios(opt)
  }).then(({ data, status }) => {
    // check for frenet error response
    if (data && !data.ShippingSevicesArray) {
      return res.status(400).send({
        data,
        message: 'Unexpected Error Try Later'
      })
    }

    const { ShippingSevicesArray } = data

    if (ShippingSevicesArray && Array.isArray(ShippingSevicesArray) && ShippingSevicesArray.length) {
      if (ShippingSevicesArray[0].Error && ShippingSevicesArray[0].Msg) {
        return res.status(400).send({
          error: 'CALCULATE_REQUEST_ERR',
          message: ShippingSevicesArray[0].Msg
        })
      }
    }

    return ShippingSevicesArray
  }).then(services => {
    return services
      .filter(service => !service.Error)
      .map(service => {
        return {
          label: service.ServiceDescription,
          carrier: service.Carrier,
          service_name: service.ServiceDescription,
          service_code: `FR${service.ServiceCode}`,
          shipping_line: {
            from: config.from,
            to: to,
            delivery_time: {
              days: parseInt(service.DeliveryTime)
            },
            price: parseFloat(service.ShippingPrice),
            total_price: parseFloat(service.ShippingPrice),
            custom_fields: [
              {
                field: 'by_frenet',
                value: 'true'
              }
            ]
          }
        }
      })
  }).then(shippingServices => {
    payload.shipping_services = shippingServices
    res.send(payload)
  }).catch(err => {
    console.log(err)
    return res.status(400).send({
      err,
      message: 'Unexpected Error Try Later'
    })
  })
}

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
