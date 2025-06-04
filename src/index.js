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
  .option('-a, --all', 'Run all matching tests instead of just the best match')
  .argument('[args...]', 'Test description or [file] and description')
  .action(async (args, options) => {
    logger.cli('Initializing CLI with version 1.0.0')
    let testFiles = []
    let allTests = []
    let testFile, testDescription

    // If no args provided, run all test files
    if (!args || args.length === 0) {
      testFiles = findTestFiles()
      if (testFiles.length === 0) {
        logger.cli('No test files found')
        process.exit(1)
      }
      console.log(`Found ${testFiles.length} test files:`)
      testFiles.forEach(file => console.log(` - ${nicePath(file)}`))
      console.log()

      let exitCode = 0
      for (const file of testFiles) {
        logger.cli(`Running test file: ${nicePath(file)}`)
        try {
          const testExitCode = await executeTest(file)
          if (testExitCode !== 0) {
            exitCode = testExitCode
          }
        } catch (error) {
          logger.cli('Error executing test:', error)
          exitCode = 1
        }
      }
      process.exit(exitCode)
    }

    if (args.length === 1) {
      // Check if the single argument is a file path
      const possibleFile = path.resolve(args[0])
      if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
        // Check if file is in node_modules
        if (possibleFile.includes('node_modules')) {
          logger.cli('Cannot run tests from node_modules directory')
          process.exit(1)
        }
        // Run all tests in this specific file
        testFile = possibleFile
        testFiles = [testFile]
        logger.cli(`Running all tests in file: ${nicePath(testFile)}`)
        try {
          const testExitCode = await executeTest(testFile)
          process.exit(testExitCode)
        } catch (error) {
          logger.cli('Error executing test:', error)
          process.exit(1)
        }
      } else {
        // Treat as test description
        testDescription = args[0]
        testFiles = findTestFiles()
        if (testFiles.length === 0) {
          logger.cli('No test files found')
          process.exit(1)
        }
      }
    } else if (args.length >= 2) {
      // If the first arg looks like a file, use it
      const possibleFile = path.resolve(args[0])
      if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
        // Check if file is in node_modules
        if (possibleFile.includes('node_modules')) {
          logger.cli('Cannot run tests from node_modules directory')
          process.exit(1)
        }
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
    console.log(`🔎 Matched ${results.length} tests in ${uniqueFiles.length} files`)

    console.log(results.map(result => ` - "${result.item.description}" in ${nicePath(result.item.file)}`).join('\n'))

    // Process matches
    const matches = options.all ? results : [results[0]]
    let exitCode = 0

    for (const result of matches) {
      const bestMatch = result.item
      logger.cli(`Running test: "${bestMatch.description}" in ${nicePath(bestMatch.file)}`)

      // Modify and create temp file
      const content = readTestFile(bestMatch.file)
      const modified = modifyTestFile(content, bestMatch.description)
      const tempFile = createTempFile(modified, bestMatch.file)

      logger.cli(`Created temporary file: ${tempFile}`)

      try {
        // Execute the test
        const testExitCode = await executeTest(tempFile, {
          bestMatch,
          testDescription
        })

        // Update overall exit code if any test fails
        if (testExitCode !== 0) {
          exitCode = testExitCode
        }

        // Clean up
        cleanupTempFile(tempFile)
      } catch (error) {
        logger.cli('Error executing test:', error)
        cleanupTempFile(tempFile)
        exitCode = 1
      }
    }

    // Exit with overall test status
    process.exit(exitCode)
  })

program.parse() 