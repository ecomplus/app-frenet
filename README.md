# app-frenet

E-Com Plus app to integrate Frenet shipping gateway

## Introduction

This is another shipping app for E-Com Plus,
similar to [Melhor Envio](https://github.com/ecomclub/app-melhor-envio),
but in this case we aren't intended to handle shipping rules from
app data, they should be configuated by the merchant directly from
Frenet dashboard.

Even though,
`free_shipping_from_value` is still needed, should be
hardseted by the merchant on app data.

## Reference

- https://frenetapi.docs.apiary.io/
- https://github.com/ecomclub/modules-api/tree/master/docs

## Deployment

CD with Zeit Now as [Node.js serverless app](https://zeit.co/docs/v2/deployments/official-builders/node-js-now-node/).

Scheduled tasks (_tracking_) triggered with [Zapier](https://zapier.com/).
