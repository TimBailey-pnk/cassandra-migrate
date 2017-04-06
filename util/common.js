'use strict'
const migrationSettings = require('../scripts/migrationSettings.json')
const path = require('path')

class Common {
  constructor (fs, db) {
    this.db = db
    this.fs = fs
    /* eslint no-useless-escape: 0 */
    this.reFileName = /^[0-9]{10}_[a-z0-9\_]*.js$/i
    this.exists = this.fs.existsSync || path.existsSync
  }

  createMigrationTable () {
    return new Promise((resolve, reject) => {
      this.db.execute(migrationSettings.createMigrationTable, null, { prepare: true }, function (err, response) {
        if (err) {
          reject(err)
        }
        resolve(response)
      })
    })
  }

  getMigrations () {
    return new Promise((resolve, reject) => {
      this.filesRan = {}
      let self = this
      this.db.execute(migrationSettings.getMigration, null, { prepare: true }, function (err, alreadyRanFiles) {
        if (err) {
          reject(err)
        } else {
          let filesRan = {}
          for (let i = 0; i < alreadyRanFiles.rows.length; i++) {
            filesRan[ alreadyRanFiles.rows[ i ].migration_number ] = (alreadyRanFiles.rows[ i ].file_name)
          }
          self.filesRan = filesRan
          resolve(filesRan)
        }
      })
    })
  }

  getMigrationFiles (dir) {
    return new Promise((resolve, reject) => {
      let files = this.fs.readdirSync(dir)
      let filesAvail = {}
      for (let j = 0; j < files.length; j++) {
        // filter migration files using regex.
        if (this.reFileName.test(files[ j ])) {
          filesAvail[ files[ j ].substr(0, 10) ] = path.join(dir, files[ j ])
        }
      }
      this.filesAvail = filesAvail
      console.log(filesAvail)
      resolve(filesAvail)
    })
  }

  difference (obj1, obj2) {
    for (let key in obj1) {
      if (obj1.hasOwnProperty(key)) {
        if (obj2[ key ] && obj2[ key ].length) {
          delete obj2[ key ]
        }
      }
    }
    return obj2
  }

  getMigrationSet (direction, n) {
    return new Promise((resolve, reject) => {
      let pending
      if (direction === 'up') {
        pending = this.difference(this.filesRan, this.filesAvail)
        if (n) {
          for (let key in pending) {
            if (pending[ n ]) {
              if (pending.hasOwnProperty(key) && key > n) {
                delete pending[ key ]
              }
            } else {
              if (this.filesRan[ n ]) {
                /* eslint prefer-promise-reject-errors: 0 */
                reject(`migration number ${n} already ran`)
              } else {
                reject(`migration number ${n} not found in pending migrations`)
              }
            }
          }
        }
      } else if (direction === 'down') {
        pending = this.filesRan
        if (n) {
          for (let key in pending) {
            if (pending[ n ]) {
              if (pending.hasOwnProperty(key) && key < n) {
                delete pending[ key ]
              }
            } else {
              if (this.filesAvail[ n ]) {
                /* eslint prefer-promise-reject-errors: 0 */
                reject(`migration number ${n} not run yet`)
              } else {
                /* eslint prefer-promise-reject-errors: 0 */
                reject(`migration number ${n} not found in pending rollbacks`)
              }
            }
          }
        }
      } else {
        /* eslint prefer-promise-reject-errors: 0 */
        reject('Migration direction must be specified')
      }
      resolve(pending)
    })
  }
}

module.exports = Common
