const { spawn } = require('child_process')
const fs = require('fs')
const { logLine, logHeader } = require('@davidwells/box-logger')
const { createEditorLink } = require('./links')
const logger = require('./logger')
const nicePath = require('./nice-path')

const executeTest = (testFile, opts = {}) => {
  const { bestMatch = {} } = opts
  logger.runner('Executing test file:', testFile)
  
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(testFile)) {
      const error = new Error(`Test file not found: ${testFile}`)
      error.code = 'ENOENT'
      reject(error)
      return
    }

    if (bestMatch.description) {
      const openLinkTiny = createEditorLink(bestMatch.file, bestMatch.lineNumber, 0, `Edit`)
      const openLink = createEditorLink(bestMatch.file, bestMatch.lineNumber, 0, `Open "${bestMatch.description}" test in editor`)
      logLine(`🏃  Running test: "${bestMatch.description}" in ${nicePath(bestMatch.file)}:${bestMatch.lineNumber} ${openLinkTiny}`, { minWidth: '100%', maxWidth: '100%', padding: 0 })
      console.log()
      // console.log(openLink)
      // console.log() 
    }
    const process = spawn('node', [testFile], {
      stdio: 'inherit'
    })
    
    process.on('close', (code) => {
      logger.runner(`Test execution completed with status: ${code === 0 ? 'passed' : 'failed'}`)
      resolve(code)
    })
    
    process.on('error', (error) => {
      logger.runner('Test execution error:', error)
      reject(error)
    })
  })
}

module.exports = {
  executeTest
}