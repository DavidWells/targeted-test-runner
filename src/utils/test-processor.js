const fs = require('fs')
const path = require('path')
const logger = require('./logger')
const isFileEsm = require('is-file-esm')

const findTestFiles = (dir = process.cwd()) => {
  logger.processor('Searching for test files in:', dir)
  const files = []
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      // console.log('fullPath', fullPath)
      
      // Skip node_modules and .git directories
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          logger.processor('Skipping directory:', fullPath)
          continue
        }
        traverse(fullPath)
      } else if (entry.name.endsWith('.test.js')) {
        files.push(fullPath)
        logger.processor('Found test file:', fullPath)
      }
    }
  }
  
  // Ensure the directory exists
  if (!fs.existsSync(dir)) {
    logger.processor('Directory does not exist:', dir)
    return []
  }

  // If it's a file, return just that file if it's a test file
  if (fs.statSync(dir).isFile()) {
    if (dir.endsWith('.test.js')) {
      return [dir]
    }
    return []
  }

  traverse(dir)
  return files
}

const readTestFile = (filePath) => {
  logger.processor('Reading test file:', filePath)
  return fs.readFileSync(filePath, 'utf8')
}

const modifyTestFile = (content, testDescription) => {
  logger.processor('Modifying test file for description:', testDescription)
  const lines = content.split('\n')
  const modifiedLines = lines.map(line => {
    if (line.includes(`test('${testDescription}'`) || 
        line.includes(`test("${testDescription}"`) || 
        line.includes(`test(\`${testDescription}\``)) {
      return line.replace('test(', 'test.only(')
    }
    return line
  })
  return modifiedLines.join('\n')
}

const HAS_IMPORT_EXPORT = /\b(?:import|export)\b/

function checkContentForESM(content) {
  /* Quick check if import or export word exist in the content */
  if (!HAS_IMPORT_EXPORT.test(content)) {
    return false
  }

  const lines = content.split('\n')
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false
  let backtickStack = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Count unescaped backticks in the line
    const backticksInLine = (line.match(/(?<!\\)`/g) || []).length
    
    // Track nested backticks
    if (backticksInLine > 0) {
      // For each backtick in the line
      for (let j = 0; j < backticksInLine; j++) {
        if (!inBacktick) {
          // Opening backtick
          backtickStack++
          inBacktick = true
        } else {
          // Closing backtick
          backtickStack--
          inBacktick = backtickStack > 0
        }
      }
    }
    
    const inQuoteBlock = inSingleQuote || inDoubleQuote || inBacktick
    
    // Skip if we're inside any type of quote
    if (inQuoteBlock) {
      // Only update single/double quote state if we're not in a backtick string
      if (!inBacktick) {
        // Count unescaped quotes in the line
        const singleQuotes = (line.match(/(?<!\\)'/g) || []).length
        const doubleQuotes = (line.match(/(?<!\\)"/g) || []).length
        
        // Update quote state
        if (singleQuotes % 2 === 1) inSingleQuote = !inSingleQuote
        if (doubleQuotes % 2 === 1) inDoubleQuote = !inDoubleQuote
      }
      continue
    }
    
    // Check for import/export statements at the start of a line (after whitespace)
    if (line.startsWith('import ') || line.startsWith('export ')) {
      // Only return true if we're not in any type of quote
      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        return true
      }
    }
    
    // Update quote state for next line if not in backtick
    if (!inBacktick) {
      const singleQuotes = (line.match(/(?<!\\)'/g) || []).length
      const doubleQuotes = (line.match(/(?<!\\)"/g) || []).length
      inSingleQuote = singleQuotes % 2 === 1
      inDoubleQuote = doubleQuotes % 2 === 1
    }
  }
  
  return false
}

async function createTempFile(content, originalFile) {
  const dir = path.dirname(originalFile)
  const ext = path.extname(originalFile)
  
  // Check if file is ESM
  const fileData = await isFileEsm(originalFile)
  let isESM = fileData.esm
  // console.log('isFileEsm', isESM, originalFile)
  
  // If not detected as ESM by is-file-esm, check content
  if (!isESM) {
    isESM = checkContentForESM(content)
    // console.log('checkContentForESM', isESM, originalFile)
  }
  
  const tempFile = path.join(dir, `${path.basename(originalFile, ext)}.temp${isESM ? '.mjs' : ''}`)
  fs.writeFileSync(tempFile, content)
  return tempFile
}

module.exports = {
  findTestFiles,
  readTestFile,
  modifyTestFile,
  createTempFile
} 