const path = require('path')
const chalk = require('./chalk')

function createEditorLink(filePath, line = 1, column = 1, customDisplay = null, color = 'cyanBright') {
  const absolutePath = path.resolve(filePath)
  const url = `cursor://file${absolutePath}:${line}:${column}`
  const display = customDisplay || `${path.basename(filePath)}:${line}`
  
  return `\x1b]8;;${url}\x1b\\${chalk[color](display)}\x1b]8;;\x1b\\`
}

function createEditorLinkPlain(filePath, line = 1, column = 1, customDisplay = null) {
  const absolutePath = path.resolve(filePath)
  const display = customDisplay || `${path.basename(filePath)}:${line}:${column}`
  
  // iTerm2 will auto-detect this pattern and make it clickable
  return `${filePath}:${line}:${column}`
}

function createEditorLinkItermZone(filePath, line = 1, column = 1) {
  const absolutePath = path.resolve(filePath)
  const display = `${path.basename(filePath)}:${line}:${column}`
  
  return `\x1b]133;A\x1b\\${display}\x1b]133;B\x1b\\`
}

module.exports = {
  createEditorLink,
  createEditorLinkPlain,
  createEditorLinkItermZone
}