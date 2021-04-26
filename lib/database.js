const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
// create necessary tables
const dbFilename = process.env.ECOM_AUTH_DB || './db.sqlite'
const db = new sqlite.Database(dbFilename, err => {
  const error = err => {
    // debug and destroy Node process
    logger.error(err)
    process.exit(1)
  }

  if (err) {
    error(err)
  } else {
    // try to run first query creating table
    db.run(
      `CREATE TABLE IF NOT EXISTS tracking_codes (
        id              INTEGER  PRIMARY KEY AUTOINCREMENT,
        order_id        STRING   NOT NULL,
        store_id        INTEGER  NOT NULL,
        tracking_code STRING   NOT NULL,
        tracking_status STRING   NOT NULL,
        service_code   STRING   NOT NULL,
        created_at      DATETIME NOT NULL
                                 DEFAULT (CURRENT_TIMESTAMP),
        delivered       INT      DEFAULT (0)
                                 NOT NULL
      );`, err => {
        if (err) {
          error(err)
        }
      }
    )
  }
})

// abstracting DB statements with promise
const dbRunPromise = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, (err, row) => {
    if (err) {
      logger.error(err)
      reject(err)
    } else {
      // query executed with success
      resolve()
    }
  })
})

module.exports = {
  db,
  dbRunPromise,
  trackingCodes: {
    save: (orderId, storeId, trackingStatus, trackingCode, serviceCode) => {
      const sql = 'INSERT INTO tracking_codes (order_id, store_id, tracking_status, tracking_code, service_code) VALUES(?,?,?,?,?)'
      return dbRunPromise(sql, [orderId, storeId, trackingStatus, trackingCode, serviceCode])
    },

    get: (orderId, trackingCode, storeId) => {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM tracking_codes WHERE order_id = ? AND tracking_code = ? AND store_id = ?'
        db.get(sql, [orderId, trackingCode, storeId], (err, row) => {
          if (err) {
            logger.error(err)
            reject(err)
          } else if (row) {
            // found with success
            // resolve the promise returning respective store and order IDs
            resolve(row)
          } else {
            const err = new Error('Tracking code not found for order id')
            err.name = 'TrackingCodeNotFound'
            reject(err)
          }
        })
      })
    },

    clear: () => {
      const d = new Date()
      d.setMonth(d.getMonth - 2)
      const sql = 'DELETE FROM tracking_codes WHERE created_at < ?'
      return dbRunPromise(sql, [d.toISOString()])
    },

    remove: (trackingCode, serviceCode, storeId) => {
      const sql = 'DELETE FROM tracking_codes WHERE tracking_code = ? AND service_code = ? AND store_id = ?'
      return dbRunPromise(sql, [trackingCode, serviceCode, storeId])
    },

    update: (trackingStatus, trackingCode, storeId) => {
      const sql = 'UPDATE tracking_codes SET tracking_status = ? WHERE tracking_code = ? AND store_id = ?'
      return dbRunPromise(sql, [trackingStatus, trackingCode, storeId])
    },

    getAll: () => {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM tracking_codes WHERE tracking_status <> ? ORDER BY store_id DESC'
        db.all(sql, [9], (err, row) => {
          if (err) {
            logger.error(err)
            reject(err)
          } else if (row) {
            // found with success
            // resolve the promise returning respective store and order IDs
            resolve(row)
          } else {
            const err = new Error('Tracking code not found for any store :)')
            err.name = 'NoTrackingCodesForUpdate'
            reject(err)
          }
        })
      })
    }
  }
}
