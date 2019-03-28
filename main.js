'use strict'
const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = process.env.PORT || 4899

require('./bin/uncaughtException')

app.use(bodyParser.json())
app.use(require('./src/routes'))
app.listen(port)
