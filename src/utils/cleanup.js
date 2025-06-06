const fs = require('fs')
const logger = require('./logger')
const { onAnyExit } = require('@davidwells/graceful-exit')

// Keep track of all temporary files
const tempFiles = new Set()

function cleanupTempFile(tempFile) {
  logger.runner('Cleaning up temporary file:', tempFile)
  
  try {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
      logger.runner('Successfully removed temporary file')
    }
  } catch (error) {
    logger.runner('Error cleaning up temporary file:', error)
    throw error
  } finally {
    // Remove from tracking set regardless of success/failure
    tempFiles.delete(tempFile)
  }
}

function trackTempFile(tempFile) {
  tempFiles.add(tempFile)
}

function cleanupAll() {
  logger.runner('Cleaning up all temporary files')
  for (const tempFile of tempFiles) {
    try {
      cleanupTempFile(tempFile)
    } catch (error) {
      // Log error but continue cleaning up other files
      logger.runner('Error during cleanup of all files:', error)
    }
  }
}

// Register cleanup on any exit
onAnyExit(() => {
  cleanupAll()
})

module.exports = {
  cleanupTempFile,
  trackTempFile,
  cleanupAll
} 