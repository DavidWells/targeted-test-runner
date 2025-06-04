const { spawn } = require('child_process')
const logger = require('./logger')

const executeTest = (testFile) => {
  logger.runner('Executing test file:', testFile)
  
  return new Promise((resolve, reject) => {
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