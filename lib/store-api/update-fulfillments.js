module.exports = (appSdk, storeId, orderId, trackingCode, eventType, eventDate) => {
  let notes
  const status = parseStatus(eventType)
  const body = {
    date_time: eventDate.toISOString(),
    status,
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

  return appSdk.apiRequest(storeId, `orders/${orderId}.json`).then(({ response }) => {
    const order = response.data
    if (order.fulfillment_status && order.fulfillment_status.current === status) {
      return null
    }
    return appSdk.apiRequest(storeId, `orders/${orderId}/fulfillments.json`, 'post', body).then(() => {
      if (notes) {
        if (order.notes) {
          notes = `${order.notes}\n${notes}`
        }
        return appSdk.apiRequest(storeId, `orders/${orderId}.json`, 'patch', { notes })
      }
      return true
    })
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
