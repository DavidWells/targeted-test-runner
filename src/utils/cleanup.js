const fs = require('fs')
const logger = require('./logger')

const cleanupTempFile = (tempFile) => {
  logger.runner('Cleaning up temporary file:', tempFile)
  
  try {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
      logger.runner('Successfully removed temporary file')
    }
  } catch (error) {
    logger.runner('Error cleaning up temporary file:', error)
    throw error
  }
}

module.exports = {
  cleanupTempFile
} 