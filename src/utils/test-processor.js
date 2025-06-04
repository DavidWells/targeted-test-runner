const fs = require('fs')
const path = require('path')
const logger = require('./logger')

const findTestFiles = (dir = process.cwd()) => {
  logger.processor('Searching for test files in:', dir)
  const files = []
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        traverse(fullPath)
      } else if (entry.name.endsWith('.test.js')) {
        files.push(fullPath)
        logger.processor('Found test file:', fullPath)
      }
    }
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
    if (line.includes(`test('${testDescription}'`) || line.includes(`test("${testDescription}"`)) {
      return line.replace('test(', 'test.only(')
    }
    return line
  })
  return modifiedLines.join('\n')
}

const createTempFile = (content, originalPath) => {
  const tempPath = `${originalPath}.temp`
  logger.processor('Creating temporary file:', tempPath)
  fs.writeFileSync(tempPath, content)
  return tempPath
}

module.exports = {
  findTestFiles,
  readTestFile,
  modifyTestFile,
  createTempFile
} 