#!/usr/bin/env node

const { program } = require('commander')
const Fuse = require('fuse.js')
const logger = require('./utils/logger')
const { findTestFiles, readTestFile, modifyTestFile, createTempFile } = require('./utils/test-processor')
const { executeTest } = require('./utils/test-runner')
const { cleanupTempFile } = require('./utils/cleanup')

program
  .version('1.0.0')
  .description('Run targeted tests by description')
  .argument('<test-description>', 'Description of the test to run')
  .action(async (testDescription) => {
    logger.cli('Initializing CLI with version 1.0.0')
    
    // Find all test files
    const testFiles = findTestFiles()
    if (testFiles.length === 0) {
      logger.cli('No test files found')
      process.exit(1)
    }
    
    // Search for matching tests
    const allTests = []
    testFiles.forEach(file => {
      const content = readTestFile(file)
      const testMatches = content.match(/test\([`'"]([^`'"]+)[`'"]/g) || []
      testMatches.forEach(match => {
        const description = match.match(/test\([`'"]([^`'"]+)[`'"]/)[1]
        allTests.push({ file, description })
      })
    })
    
    // Fuzzy match test descriptions
    const fuse = new Fuse(allTests, {
      keys: ['description'],
      threshold: 0.3
    })
    
    const results = fuse.search(testDescription)
    if (results.length === 0) {
      logger.cli('No matching tests found')
      process.exit(1)
    }
    
    // Process the best match
    const bestMatch = results[0].item
    logger.cli(`Matched test: "${bestMatch.description}" in ${bestMatch.file}`)
    
    // Modify and create temp file
    const content = readTestFile(bestMatch.file)
    const modified = modifyTestFile(content, bestMatch.description)
    const tempFile = createTempFile(modified, bestMatch.file)
    
    logger.cli(`Created temporary file: ${tempFile}`)
    
    try {
      // Execute the test
      const exitCode = await executeTest(tempFile)
      
      // Clean up
      cleanupTempFile(tempFile)
      
      // Exit with test status
      process.exit(exitCode)
    } catch (error) {
      logger.cli('Error executing test:', error)
      cleanupTempFile(tempFile)
      process.exit(1)
    }
  })

program.parse() 