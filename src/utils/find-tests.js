const isFileEsm = require('is-file-esm')
const { readTestFile } = require('./test-processor')

const debug = false
const debugLog = (debug) ? console.log : () => {}
const HAS_IMPORT_EXPORT = /\b(?:import|export)\b/

function fastCheckForESM(content) {
  return HAS_IMPORT_EXPORT.test(content)
}

async function findTestsInFiles(testFiles) {
  const results = await Promise.all(testFiles.map(async (filePath) => {
    const content = readTestFile(filePath)
    const fileData = await isFileEsm(filePath)
    let isESM = fileData.esm

    // sometimes fileData.esm is false positive, so we need to check the content
    // if the content has import/export statements, then it's ESM
    if (!isESM) {
      const isContentEsm = checkContentForESM(content, filePath)
      isESM = isContentEsm
    }

    const lines = content.split('\n')
    const testMatches = []
    
    lines.forEach((line, lineNumber) => {
      // Match test() with any quote type, but ensure we don't match inside strings
      const matches = line.match(/test\s*\(\s*[`'\"]([^`'\"]+)[`'\"]/g) || []
      if (matches.length > 0) {
        // console.log('Found matches in line', lineNumber + 1, ':', matches)
      }
      matches.forEach(match => {
        const innerMatch = match.match(/test\s*\(\s*[`'\"]([^`'\"]+)[`'\"]/)
        let quoteType = "'"
        if (innerMatch[0].match(/\(\"/)) {
          quoteType = '"'
        } else if (innerMatch[0].match(/\(\'/)) {
          quoteType = "'"
        } else if (innerMatch[0].match(/\(\`/)) {
          quoteType = "`"
        }
        const description = innerMatch[1]
        testMatches.push({ file: filePath, description, quoteType, isESM: isESM, lineNumber: lineNumber + 1 })
      })
    })
    
    return testMatches
  }))
  
  return results.flat()
}

function checkContentForESM(content, filePath) {
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
    // console.log('line', line)
    
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
    
    // Log state for every line
    debugLog(`Line ${i + 1}: State - Single: ${inSingleQuote}, Double: ${inDoubleQuote}, Backtick: ${inBacktick}, Stack: ${backtickStack}`)

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
      debugLog(`Line ${i + 1}: Found ESM statement: "${line}"`)
      debugLog(`Line ${i + 1}: Quote states - Single: ${inSingleQuote}, Double: ${inDoubleQuote}, Backtick: ${inBacktick}, Stack: ${backtickStack}`)
      
      // Only return true if we're not in any type of quote
      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        debugLog('Returning true - ESM detected')
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
  
  debugLog('Returning false - No ESM detected')
  return false
}

function findTestsInFilesBasic(testFiles) {
  return testFiles.map(file => {
    const content = readTestFile(file)
    const lines = content.split('\n')
    let isESM = false
    let inSingleQuote = false
    let inDoubleQuote = false
    let inBacktick = false
    let backtickCount = 0
    
    for (const line of lines) {
      // Count backticks in the line
      const backticksInLine = (line.match(/`/g) || []).length
      backtickCount += backticksInLine
      
      // If we have an odd number of backticks, we're in a multiline string
      inBacktick = backtickCount % 2 === 1
      
      // Skip if we're inside any type of quote
      if (inSingleQuote || inDoubleQuote || inBacktick) {
        // Only update single/double quote state if we're not in a backtick string
        if (!inBacktick) {
          // Count quotes in the line
          const singleQuotes = (line.match(/'/g) || []).length
          const doubleQuotes = (line.match(/"/g) || []).length
          
          // Update quote state
          if (singleQuotes % 2 === 1) inSingleQuote = !inSingleQuote
          if (doubleQuotes % 2 === 1) inDoubleQuote = !inDoubleQuote
        }
        continue
      }
      
      // Check for import/export statements when not in quotes
      if (/(?:^|\n)\s*(?:import|export)\s/m.test(line)) {
        isESM = true
        break
      }
      
      // Update quote state for next line if not in backtick
      if (!inBacktick) {
        const singleQuotes = (line.match(/'/g) || []).length
        const doubleQuotes = (line.match(/"/g) || []).length
        inSingleQuote = singleQuotes % 2 === 1
        inDoubleQuote = doubleQuotes % 2 === 1
      }
    }
    
    const testMatches = []
    
    lines.forEach((line, lineNumber) => {
      // Match test() with any quote type, but ensure we don't match inside strings
      const matches = line.match(/test\s*\(\s*[`'\"]([^`'\"]+)[`'\"]/g) || []
      if (matches.length > 0) {
        // console.log('Found matches in line', lineNumber + 1, ':', matches)
      }
      matches.forEach(match => {
        const innerMatch = match.match(/test\s*\(\s*[`'\"]([^`'\"]+)[`'\"]/)
        let quoteType = "'"
        if (innerMatch[0].match(/\(\"/)) {
          quoteType = '"'
        } else if (innerMatch[0].match(/\(\'/)) {
          quoteType = "'"
        } else if (innerMatch[0].match(/\(\`/)) {
          quoteType = "`"
        }
        const description = innerMatch[1]
        testMatches.push({ file, description, quoteType, isESM, lineNumber: lineNumber + 1 })
      })
    })
    
    return testMatches
  }).flat()
}

function findTestsInFilesOtherFrameworks(testFiles) {
  return testFiles.flatMap((file) => {
    // Use flatMap for conciseness
    const content = readTestFile(file)
    // Regex to find test('name', ...), it('name', ...), describe('name', ...).test('name', ...) etc.
    // This is a simplified regex; a more robust solution might involve AST parsing.
    const testMatches = [...content.matchAll(/(?:test|it)\s*\(\s*[`'"]([^`'"]+)[`'"]/g)]
    return testMatches.map((match) => ({
      file,
      description: match[1],
    }))
  })
}

module.exports = {
  findTestsInFiles,
  findTestsInFilesBasic,
  findTestsInFilesOtherFrameworks,
}