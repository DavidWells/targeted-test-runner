const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { logLine, logHeader } = require('@davidwells/box-logger')
const { createEditorLink } = require('./links')
const logger = require('./logger')
const nicePath = require('./nice-path')

async function spawnProcess(fileToRun) {
  return new Promise((resolve, reject) => {
    let stderrOutput = ''
    const process = spawn('node', [fileToRun], {
      stdio: ['inherit', 'inherit', 'pipe'] // Pipe stderr to capture it
    })

    // Log stdout
    process.stdout?.on('data', (data) => {
      // console.log('stdout:', data.toString())
    })

    // Capture stderr
    process.stderr?.on('data', (data) => {
      const output = data.toString()
      stderrOutput += output
      // console.log('stderr:', output)
    })
    
    process.on('close', (code) => {
      // Check if we got an ESM error
      if (stderrOutput.includes('require is not defined in ES module scope')) {
        reject(new Error('ESM_ERROR'))
        return
      }
      logger.runner(`Test execution completed with status: ${code === 0 ? 'passed' : 'failed'}`)
      resolve(code)
    })
    
    process.on('error', (error) => {
      logger.runner('Test execution error:', error)
      reject(error)
    })
  })
}

async function runTest(fileToRun) {
  // First try with original file
  try {
    return await spawnProcess(fileToRun)
  } catch (error) {
    logger.runner('Initial run failed:', error.message)
  
    // If original file fails, try both extensions
    const content = fs.readFileSync(fileToRun, 'utf8')
    let tempFile

    // Try as .js first
    logger.runner('Trying as JS file')
    tempFile = await createTempFileJSFile(content, fileToRun)
    
    try {
      const result = await spawnProcess(tempFile)
      // Clean up temp file
      fs.unlinkSync(tempFile)
      return result
    } catch (jsError) {
      // Clean up .js temp file
      fs.unlinkSync(tempFile)
      
      // If .js fails, try as .mjs
      logger.runner('JS attempt failed, trying as MJS')
      tempFile = await createTempFileWithExtension(content, fileToRun, '.mjs')
      
      try {
        const result = await spawnProcess(tempFile)
        // Clean up temp file
        fs.unlinkSync(tempFile)
        return result
      } catch (mjsError) {
        // Clean up temp file even if retry fails
        fs.unlinkSync(tempFile)
        throw mjsError
      }
    }
  }
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

  return runTest(testFile)
}

async function createTempFileJSFile (content, originalFile) {
  const dir = path.dirname(originalFile)
  const ext = path.extname(originalFile)
  const tempFile = path.join(dir, `${path.basename(originalFile, ext).replace(/\.temp$/, '')}.temp`)
  fs.writeFileSync(tempFile, content)
  return tempFile
}

async function createTempFileWithExtension (content, originalFile, extension) {
  const dir = path.dirname(originalFile)
  const ext = path.extname(originalFile)
  const tempFile = path.join(dir, `${path.basename(originalFile, ext)}.temp${extension}`)
  fs.writeFileSync(tempFile, content)
  return tempFile
}

module.exports = {
  executeTest
}
