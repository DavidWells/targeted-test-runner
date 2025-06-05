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

function createTempFile(content, originalFile, isESM = false) {
  const dir = path.dirname(originalFile)
  const ext = path.extname(originalFile)
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