module.exports = (appSdk, storeId, orderId, trackingCode, eventType, eventDate) => {
  return new Promise((resolve, reject) => {
    let resource = `orders/${orderId}/fulfillments.json`
    let method = 'POST'
    let notes
    const data = {
      date_time: occurrenceDate(eventDate),
      status: parseStatus(eventType),
      notification_code: trackingCode
    }

    if (eventType === 2) {
      notes = 'Entrega está atrasada.'
    } else if (eventType === 4) {
      notes = 'Pedido extraviado.'
    }

    appSdk.apiRequest(storeId, resource, method, data)
      .then(() => {
        if (notes) {
          resource = `orders/${orderId}.json`
          method = 'PATCH'
          return appSdk.apiRequest(storeId, resource, method, { notes })
        }
      })
      .then(resolve)
      .catch(reject)
  })
}

const parseStatus = status => {
  switch (status) {
    case 0:
      return 'in_separation'
    case 1:
    case 2:
      return 'shipped'
    case 3:
    case 4:
      return 'returned'
    case 9:
      return 'delivered'
    default:
      return ''
  }
}

const occurrenceDate = date => {
  try {
    let dateTime = date.split(' ')
    dateTime = dateTime[0].split('/')
    return new Date(`${dateTime[1]}/${dateTime[0]}/${dateTime[2]}`).toISOString()
  } catch (error) {
    console.log(error)
    return new Date().toISOString()
  }
}