const debug = require('debug')

const logger = {
  cli: debug('tt:cli'),
  processor: debug('tt:processor'),
  runner: debug('tt:runner')
}

module.exports = logger 