const { readTestFile } = require('./test-processor')

async function findTestsInFiles(testFiles) {
  const results = await Promise.all(testFiles.map(async (filePath) => {
    const content = readTestFile(filePath)
    const lines = content.split('\n')
    const testMatches = []
    
    lines.forEach((line, lineNumber) => {
      // Match test() with any quote type, robustly. https://regex101.com/r/XHhx1u/2
      const matches = line.match(/test\s*\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g) || []
      if (matches.length > 0) {
        // console.log('Found matches in line', lineNumber + 1, ':', matches)
      }
      matches.forEach(match => {
        // Try robust match first
        let innerMatch = match.match(/test\s*\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/)
        let description = innerMatch && (innerMatch[1] || innerMatch[2] || innerMatch[3])
        let quoteType = "'"
        if (innerMatch && innerMatch[2]) quoteType = '"'
        else if (innerMatch && innerMatch[3]) quoteType = '`'
        // Fallback: if no robust match, try to capture everything after the opening quote
        if (!description) {
          const looseMatch = match.match(/test\s*\(\s*(['"`])(.*)$/)
          if (looseMatch) {
            description = looseMatch[2]
            quoteType = looseMatch[1]
          }
        }
        testMatches.push({ file: filePath, description, quoteType, lineNumber: lineNumber + 1 })
      })
    })
    
    return testMatches
  }))
  
  return results.flat()
}

function findTestsInFilesBasic(testFiles) {
  return testFiles.map(file => {
    const content = readTestFile(file)
    const lines = content.split('\n')
    const testMatches = []
    
    lines.forEach((line, lineNumber) => {
      // Match test() with any quote type, robustly
      const matches = line.match(/test\s*\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g) || []
      if (matches.length > 0) {
        // console.log('Found matches in line', lineNumber + 1, ':', matches)
      }
      matches.forEach(match => {
        // Try robust match first
        let innerMatch = match.match(/test\s*\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/)
        let description = innerMatch && (innerMatch[1] || innerMatch[2] || innerMatch[3])
        let quoteType = "'"
        if (innerMatch && innerMatch[2]) quoteType = '"'
        else if (innerMatch && innerMatch[3]) quoteType = '`'
        // Fallback: if no robust match, try to capture everything after the opening quote
        if (!description) {
          const looseMatch = match.match(/test\s*\(\s*(['"`])(.*)$/)
          if (looseMatch) {
            description = looseMatch[2]
            quoteType = looseMatch[1]
          }
        }
        testMatches.push({ file, description, quoteType, lineNumber: lineNumber + 1 })
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

/**
 * Finds line numbers for failed tests and creates hyperlinks
 * @param {string} filePath - Path to the test file
 * @param {string[]} failedTestNames - Array of failed test names
 * @param {Array<{file: string, description: string, lineNumber: number}>} [itemsToList] - Optional array of test items with line numbers
 * @returns {string} Formatted output with hyperlinks
 */
function findFailedTestLines(filePath, failedTestNames, itemsToList = null) {
  const { createEditorLink, removeQuotes } = require('./links')
  
  return failedTestNames.map(testName => {
    let lineNumber
    
    if (itemsToList) {
      // Find the test in itemsToList
      const testItem = itemsToList.find(item => 
        item.file === filePath && item.description === testName
      )
      lineNumber = testItem?.lineNumber
    }
    
    if (!lineNumber) {
      // Fallback to reading file if itemsToList not provided or test not found
      const content = readTestFile(filePath)
      const lines = content.split('\n')
      lineNumber = lines.findIndex(line => {
        // Match test() with any quote type
        const match = line.match(/test\s*\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/)
        if (match) {
          // console.log('match', match)
          // console.log('line', line)
        }
        return match && match[1] === testName
      }) + 1 // Convert to 1-based line number
    }
    
    if (!lineNumber) {
      return ` ${removeQuotes(testName)}` // No line number found, just return the cleaned name
    }
    
    // Create hyperlink to the test
    const linkText = removeQuotes(testName)
    // console.log('linkText', linkText)
    const link = createEditorLink(filePath, lineNumber, 0, `"${linkText}"`, 'white')
    return ` ${link}`
  }).join('\n')
}

module.exports = {
  findTestsInFiles,
  findTestsInFilesBasic,
  findTestsInFilesOtherFrameworks,
  findFailedTestLines
}