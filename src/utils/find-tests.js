const { readTestFile } = require('./test-processor')

async function findTestsInFiles(testFiles) {
  const results = await Promise.all(testFiles.map(async (filePath) => {
    const content = readTestFile(filePath)
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

module.exports = {
  findTestsInFiles,
  findTestsInFilesBasic,
  findTestsInFilesOtherFrameworks,
}