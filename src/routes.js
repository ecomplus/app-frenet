'use strict'

const router = require('express').Router()
const pkg = require('../package.json')

router.use('/callback', require('./callback'))
router.use('/calculate', require('./calculate'))

// show package.json on domain root
router.get('/', (req, res) => res.send(pkg))

module.exports = router
