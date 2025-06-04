#!/usr/bin/env node

const { program } = require('commander')
const Fuse = require('fuse.js')
const path = require('path')
const fs = require('fs')
const logger = require('./utils/logger')
const { findTestFiles, readTestFile, modifyTestFile, createTempFile } = require('./utils/test-processor')
const { executeTest } = require('./utils/test-runner')
const { cleanupTempFile } = require('./utils/cleanup')
const nicePath = require('./utils/nice-path')

program
  .version('1.0.0')
  .description('Run targeted tests by description')
  .argument('<args...>', 'Test description or [file] and description')
  .action(async (args) => {
    logger.cli('Initializing CLI with version 1.0.0')
    let testFiles = []
    let allTests = []
    let testFile, testDescription

    if (args.length === 1) {
      testDescription = args[0]
      testFiles = findTestFiles()
      if (testFiles.length === 0) {
        logger.cli('No test files found')
        process.exit(1)
      }
    } else if (args.length >= 2) {
      // If the first arg looks like a file, use it
      const possibleFile = path.resolve(args[0])
      if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
        testFile = possibleFile
        testDescription = args.slice(1).join(' ')
        testFiles = [testFile]
      } else {
        // Fallback: treat all args as description
        testDescription = args.join(' ')
        testFiles = findTestFiles()
        if (testFiles.length === 0) {
          logger.cli('No test files found')
          process.exit(1)
        }
      }
    } else {
      logger.cli('No test description provided')
      process.exit(1)
    }

    // Search for matching tests
    testFiles.forEach(file => {
      const content = readTestFile(file)
      const testMatches = content.match(/test\([`'\"]([^`'\"]+)[`'\"]/g) || []
      testMatches.forEach(match => {
        const description = match.match(/test\([`'\"]([^`'\"]+)[`'\"]/)[1]
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
      console.log('No matching tests found')
      process.exit(1)
    }

    const uniqueFiles = [...new Set(results.map(result => result.item.file))]
    console.log(`Matched ${results.length} tests in ${uniqueFiles.length} files`)

    console.log(results.map(result => ` - "${result.item.description}" in ${nicePath(result.item.file)}`).join('\n'))
    console.log()


    // Process the best match
    const bestMatch = results[0].item
    logger.cli(`Matched test: "${bestMatch.description}" in ${nicePath(bestMatch.file)}`)

    // Modify and create temp file
    const content = readTestFile(bestMatch.file)
    const modified = modifyTestFile(content, bestMatch.description)
    const tempFile = createTempFile(modified, bestMatch.file)

    logger.cli(`Created temporary file: ${tempFile}`)

    try {
      // Execute the test
      const exitCode = await executeTest(tempFile, {
        bestMatch,
        testDescription
      })

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