const path = require('path')

module.exports = function nicePath(filePath) {
  return path.relative(process.cwd(), filePath)
}