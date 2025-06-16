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
      
      // If test failed and we have stderr output, include it in the result
      if (code !== 0 && stderrOutput.trim()) {
        const error = new Error(`Test failed with exit code ${code}`)
        error.code = 'TEST_FAILED'
        error.exitCode = code
        error.stderr = stderrOutput.trim()
        logger.runner(`Test execution failed with status: ${code}`)
        logger.runner('Stderr output:', stderrOutput.trim())
        reject(error)
        return
      }
      
      logger.runner(`Test execution completed with status: ${code === 0 ? 'passed' : 'failed'}`)
      resolve(code)
    })
    
    process.on('error', (error) => {
      // Enhance spawn errors with more context
      const enhancedError = new Error(`Spawn process error: ${error.message}`)
      enhancedError.code = error.code || 'SPAWN_ERROR'
      enhancedError.originalError = error
      enhancedError.file = fileToRun
      logger.runner('Test execution spawn error:', enhancedError.message)
      reject(enhancedError)
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
    const openLinkTiny = createEditorLink(
      bestMatch.file, 
      bestMatch.lineNumber, 
      0, 
      `${nicePath(bestMatch.file)}:${bestMatch.lineNumber}`
    )
    // const openLink = createEditorLink(bestMatch.file, bestMatch.lineNumber, 0, `Open "${bestMatch.description}" test in editor`)
    const style = { 
      minWidth: '100%', maxWidth: '100%', padding: 0, borderStyle: 'bold', borderColor: 'cyanBright',
    }
    const msg = `\n🏃 Starting test "${bestMatch.description}" ${openLinkTiny}\n`
    logLine({ borderColor: 'gray'})
    //logLine(msg, style)
    
    console.log(msg)
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
