'use strict'
const router = require('express').Router()

router.use('/callback', require('./callback'))
router.use('/calculate', require('./calculate'))

module.exports = router
