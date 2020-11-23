module.exports = (appSdk, storeId, orderId, trackingCode, eventType, eventDate) => {
  let notes
  const data = {
    date_time: occurrenceDate(eventDate),
    status: parseStatus(eventType),
    notification_code: String(trackingCode),
    flags: [
      'app-frenet'
    ]
  }

  if (eventType === 2) {
    notes = 'Entrega está atrasada.'
  } else if (eventType === 4) {
    notes = 'Pedido extraviado.'
  }

  return appSdk.apiRequest(storeId, `orders/${orderId}/fulfillments.json`, 'post', data).then(() => {
    if (notes) {
      return appSdk.apiRequest(storeId, `orders/${orderId}.json`, 'patch', { notes })
    }
    return true
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