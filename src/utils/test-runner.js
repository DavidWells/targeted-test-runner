const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { logLine, logHeader } = require('@davidwells/box-logger')
const { createEditorLink } = require('./links')
const logger = require('./logger')
const nicePath = require('./nice-path')
const stripAnsi = require('./strip-ansi')

class ESMError extends Error {
  constructor(message, stderr, previousErrors = []) {
    // Use the actual error message from stderr if available
    const errorMessage = stderr.split('\n').find(line => line.startsWith('Error:')) || message
    super(errorMessage)
    this.name = 'ESMError'
    this.code = 'ESM_ERROR'
    this.stderr = stderr
    this.previousErrors = previousErrors
  }
}

async function spawnProcess(fileToRun, errors = []) {
  return new Promise((resolve, reject) => {
    let stdoutOutput = ''
    let stderrOutput = ''
    const child = spawn('node', [fileToRun], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    })

    // Print and collect stdout
    child.stdout.on('data', (data) => {
      stdoutOutput += stripAnsi(data.toString())
      process.stdout.write(data) // Print live with colors
    })

    // Print and collect stderr
    child.stderr.on('data', (data) => {
      stderrOutput += stripAnsi(data.toString())
      process.stderr.write(data) // Print live with colors
    })
    
    child.on('close', (code) => {
      // Check for module not found error first
      if (stderrOutput.includes('Error: Cannot find module')) {
        const errorLine = stderrOutput.split('\n').find(line => line.startsWith('Error:')) || 'Module not found'
        const error = new Error(errorLine.replace('Error: ', ''))
        error.code = 'MODULE_NOT_FOUND'
        error.stdout = stdoutOutput
        error.stderr = stderrOutput
        error.stack = stderrOutput // Add the full stderr as the stack trace
        error.originalError = stderrOutput // Store the original error output
        reject(error)
        return
      }

      // Check if we got an ESM error
      if (stderrOutput.includes('require is not defined in ES module scope')) {
        // If we have previous errors, use the first non-ESM error
        const previousNonESMError = errors.find(error => !(error instanceof ESMError))
        if (previousNonESMError) {
          // Ensure the original error's stderr is preserved
          previousNonESMError.stderr = previousNonESMError.stderr || stderrOutput
          previousNonESMError.stack = previousNonESMError.stack || stderrOutput
          previousNonESMError.stdout = previousNonESMError.stdout || stdoutOutput
          reject(previousNonESMError)
          return
        }
        reject(new ESMError('ESM module error', stderrOutput, errors))
        return
      }
      
      // If test failed and we have stderr output, include it in the result
      if (code !== 0 && stderrOutput.trim()) {
        const error = new Error(`Test failed with exit code ${code}`)
        error.code = 'TEST_FAILED'
        error.exitCode = code
        error.stderr = stderrOutput.trim()
        error.stdout = stdoutOutput.trim()
        error.stack = stderrOutput.trim() // Add the full stderr as the stack trace
        logger.runner(`Test execution failed with status: ${code}`)
        logger.runner('Stderr output:', stderrOutput.trim())
        reject(error)
        return
      }
      
      logger.runner(`Test execution completed with status: ${code === 0 ? 'passed' : 'failed'}`)
      resolve({
        exitCode: code,
        stdout: stdoutOutput.trim(),
        stderr: stderrOutput.trim(),
        success: code === 0,
        file: fileToRun
      })
    })
    
    child.on('error', (error) => {
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
    const isSuppressed = error instanceof ESMError
    
    if (!isSuppressed) {
      logger.runner('Initial run failed:', error.message)
    }
  
    // If original file fails, try both extensions
    const content = fs.readFileSync(fileToRun, 'utf8')
    let tempFile

    // Try as .js first
    logger.runner('Trying as JS file')
    tempFile = await createTempFileJSFile(content, fileToRun)
    
    try {
      const result = await spawnProcess(tempFile, [error])
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
        const result = await spawnProcess(tempFile, [error, jsError])
        // Clean up temp file
        fs.unlinkSync(tempFile)
        return result
      } catch (mjsError) {
        // Clean up temp file even if retry fails
        fs.unlinkSync(tempFile)
        // Preserve the original error's stderr if it exists
        if (error.stderr) {
          mjsError.stderr = error.stderr
        }
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
