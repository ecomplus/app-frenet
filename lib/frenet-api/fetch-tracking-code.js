const axios = require('axios')

module.exports = (trackingCode, serviceCode, token) => axios({
  method: 'post',
  url: 'http://api.frenet.com.br/tracking/trackinginfo',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'token': token
  },
  data: {
    'ShippingServiceCode': serviceCode,
    'TrackingNumber': trackingCode
  }
}).then(resp => resp.data)
