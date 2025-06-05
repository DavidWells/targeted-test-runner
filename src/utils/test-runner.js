const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { logLine, logHeader } = require('@davidwells/box-logger')
const { createEditorLink } = require('./links')
const logger = require('./logger')
const nicePath = require('./nice-path')

function runTest(fileToRun) {
  return new Promise((resolve, reject) => {
    const process = spawn('node', [fileToRun], {
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


async function createTempFileWithExtension (content, originalFile, extension) {
  const dir = path.dirname(originalFile)
  const ext = path.extname(originalFile)
  const tempFile = path.join(dir, `${path.basename(originalFile, ext)}.temp${extension}`)
  fs.writeFileSync(tempFile, content)
  return tempFile
}

const executeTest = async (testFile, opts = {}) => {
  const { bestMatch = {} } = opts
  logger.runner('Executing test file:', testFile)
  
  // Check if file exists
  if (!fs.existsSync(testFile)) {
    const error = new Error(`Test file not found: ${testFile}`)
    error.code = 'ENOENT'
    throw error
  }

  if (bestMatch.description) {
    const openLinkTiny = createEditorLink(bestMatch.file, bestMatch.lineNumber, 0, `Open test`)
    // const openLink = createEditorLink(bestMatch.file, bestMatch.lineNumber, 0, `Open "${bestMatch.description}" test in editor`)
    logLine(`🏃  Running test: "${bestMatch.description}" from ${nicePath(bestMatch.file)}:${bestMatch.lineNumber} - ${openLinkTiny}`, { minWidth: '100%', maxWidth: '100%', padding: 0 })
    console.log()
    // console.log(openLink)
    // console.log() 
  }

  try {
    // First attempt with original file
    return runTest(testFile)
  } catch (error) {
    console.log('error', error)
    // Check if it's an ESM-related error
    if (error.message && error.message.includes('require is not defined in ES module')) {
      logger.runner('Detected ESM module, retrying with .mjs extension')
      
      // Copy the original file content
      const content = fs.readFileSync(testFile, 'utf8')
      let tempFile = await createTempFileWithExtension(content, testFile, '')
      
      try {
        // Try with .mjs first
        const result = await runTest(tempFile)
        // Clean up temp file
        fs.unlinkSync(tempFile)
        return result
      } catch (mjsError) {
        // Clean up .mjs temp file
        fs.unlinkSync(tempFile)
        
        // If .mjs fails, try with regular .temp extension
        logger.runner('MJS attempt failed, retrying with regular .temp extension')
        tempFile = await createTempFileWithExtension(content, testFile, '.mjs')
        
        try {
          const result = await runTest(tempFile)
          // Clean up temp file
          fs.unlinkSync(tempFile)
          return result
        } catch (tempError) {
          // Clean up temp file even if retry fails
          fs.unlinkSync(tempFile)
          throw tempError
        }
      }
    }
    throw error
  }
}

module.exports = {
  executeTest
}