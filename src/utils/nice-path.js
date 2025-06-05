const path = require('path')

module.exports = function nicePath(filePath = '') {
  if (!filePath) return ''
  return './' + path.relative(process.cwd(), filePath)
}