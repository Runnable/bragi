'use strict'

const Promise = require('bluebird')
const GithubApi = require('github4')
const crypto = require('crypto')
const defaults = require('defaults')
const monitor = require('monitor-dog')
const S = require('string')
/**
 * GitHub client with Promisified methods, common setup and datadog.
 * @class
 */
class Github extends GithubApi {

  constructor (opts) {
    opts = defaults(opts, {
      // optional
      debug: false,
      protocol: 'https',
      requestMedia: 'application/json',
      headers: {
        // GitHub is happy with a unique user agent
        'user-agent': process.env.APP_NAME + '.runnable.com'
      }
    })
    super(opts)
    const sections = Object.keys(this.routes).map((s) => { return S(s).camelize() })
    sections.forEach((section) => {
      const funcs = Object.keys(this[section])
      funcs.forEach((funcName) => {
        const func = this[section][funcName]
        const promisifiedFunc = Promise.promisify(func)
        this[section][funcName] = function () {
          const monitorName = section + '_' + funcName
          monitor.increment(monitorName, {
            serviceName: process.env.APP_NAME
          })
          const timer = monitor.timer(monitorName)
          return promisifiedFunc.apply(this, Array.from(arguments))
            .finally(function () {
              timer.stop()
            })
        }
      })
    })
    console.log(this[sections[1]])
    if (opts.token) {
      this.token = opts.token
      const md5sum = crypto.createHash('md5')
      md5sum.update(opts.token)
      this.tokenHash = md5sum.digest('hex')
      this.authenticate({
        type: 'oauth',
        token: opts.token
      })
    }
  }
}

module.exports = Github
