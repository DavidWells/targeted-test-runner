const { spawn } = require('child_process')
const fs = require('fs')
const { logLine } = require('@davidwells/box-logger')
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
      logLine(`🏃  Running test: "${bestMatch.description}" in ${nicePath(bestMatch.file)}`)
      console.log()
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