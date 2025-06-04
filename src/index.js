#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const Fuse = require('fuse.js')
const prompts = require('prompts')
const { program } = require('commander')
const logger = require('./utils/logger')
const { findTestFiles, readTestFile, modifyTestFile, createTempFile } = require('./utils/test-processor')
const { executeTest } = require('./utils/test-runner')
const { cleanupTempFile } = require('./utils/cleanup')
const nicePath = require('./utils/nice-path')

const formatTestOutput = (testDescriptions) => {
  // Calculate the maximum length of file paths for alignment
  const maxPathLength = Math.max(...testDescriptions.map(({ file }) => nicePath(file).length))
  const paddingLength = maxPathLength + 5 // Add 5 for the " ◦ " separator

  return testDescriptions.map(({ file, description }) => {
    const paddedPath = nicePath(file).padEnd(paddingLength)
    return `   - ${paddedPath}"${description}"`
  }).join('\n')
}

const listTestDescriptions = async (testFiles, fuzzyResults, testDescription, listIsEnabled) => {
  const allTestDescriptions = []
  
  if (fuzzyResults) {
    // Use the fuzzy search results directly
    allTestDescriptions.push(...fuzzyResults.map(result => result.item))
  } else {
    // Use the findTestsInFiles function
    allTestDescriptions.push(...findTestsInFiles(testFiles))
  }
  
  console.log(`\n🔎 Found ${allTestDescriptions.length} tests in ${testFiles.length} test files:`)
  console.log(formatTestOutput(allTestDescriptions))
  console.log()

  if (listIsEnabled) {
    process.exit(0)
  }
  
  // Count tests per file
  const testsPerFile = {}
  allTestDescriptions.forEach(({ file }) => {
    testsPerFile[file] = (testsPerFile[file] || 0) + 1
  })

  // Get files with multiple tests
  const multiTestFiles = Object.entries(testsPerFile)
    .filter(([_, count]) => count > 1)
    .map(([file]) => file)

  const choices = [
    {
      title: testDescription ? `✓ Run all matching tests` : '✓ Run all tests',
      value: { runAll: true, testDescription }
    },
    // Include test files that contain more than 1 test as "Run all tests in [file]"
    ...multiTestFiles.map(file => ({
      title: `▶ Run file ${nicePath(file)}`,
      value: { runAllInFile: true, file }
    })),
    ...allTestDescriptions.map(({ file, description }) => ({
      title: `◉ Run test "${description}" in ${nicePath(file)}`,
      value: { file, description }
    })),
    // add Cancel option
    {
      title: '✖ Cancel',
      value: { cancel: true }
    },
  ]

  try {
    const response = await prompts({
      type: 'autocomplete',
      name: 'test',
      message: 'Select a test to run',
      choices,
      suggest: (input, choices) => choices.filter(i => 
        i.title.toLowerCase().includes(input.toLowerCase())
      )
    })

    if (!response || !response.test) {
      console.log('Selection cancelled')
      process.exit(0)
    }

    return response.test
  } catch (error) {
    console.error('Error selecting test:', error)
    process.exit(1)
  }
}

const runSingleTest = async (testInfo, testDescription = null, copyToClipboard = false) => {
  const { file, description } = testInfo
  logger.cli(`Running test: "${description}" in ${nicePath(file)}`)

  // Modify and create temp file
  const content = readTestFile(file)
  const modified = modifyTestFile(content, description)
  const tempFile = createTempFile(modified, file)

  logger.cli(`Created temporary file: ${tempFile}`)

  try {
    // Execute the test
    const testExitCode = await executeTest(tempFile, {
      bestMatch: testInfo,
      testDescription
    })

    // Clean up
    cleanupTempFile(tempFile)

    if (copyToClipboard) {
      // Copy command to clipboard
      const isLocalDev = (process.argv[1] || '').includes('targeted-test-runner/src')
      const cmdToCopy = (isLocalDev) ? 'node src/index.js' : 'tt'
      const command = `${cmdToCopy} ${cleanMacPath(file)} "${description}"`
      const clipboardy = await import('clipboardy')
      await clipboardy.default.write(command)
      console.log('\n📋 Command copied to clipboard:')
      console.log(command)
    }

    return testExitCode
  } catch (error) {
    logger.cli('Error executing test:', error)
    cleanupTempFile(tempFile)
    return 1
  }
}

function cleanMacPath(path) {
  return path.replace(/^\/Users\/([A-Za-z0-9_-]*)\//, '~/')
}

const handleTestSelection = async ({
  testFiles,
  fuzzyResults,
  testDescription = null,
  listIsEnabled = false
}) => {
  // Skip interactive prompt if not in TTY environment
  if (!process.stdout.isTTY) {
    if (fuzzyResults && fuzzyResults.length > 0) {
      const bestMatch = fuzzyResults[0].item
      const testExitCode = await runSingleTest(bestMatch, testDescription)
      process.exit(testExitCode)
    }
    // If no fuzzy results, run all tests in the first file
    const testExitCode = await executeTest(testFiles[0])
    process.exit(testExitCode)
  }

  const selectedTest = await listTestDescriptions(testFiles, fuzzyResults, testDescription, listIsEnabled)
  if (selectedTest) {
    // console.log('selectedTest', selectedTest)
    if (selectedTest.cancel) {
      console.log('Selection cancelled')
      process.exit(0)
    } else if (selectedTest.runAll) {
      let exitCode = 0
      if (selectedTest.testDescription && fuzzyResults) {
        console.log('Running only the matching tests')
        // Run only the matching tests
        for (const result of fuzzyResults) {
          const testExitCode = await runSingleTest(result.item, selectedTest.testDescription, true)
          if (testExitCode !== 0) {
            exitCode = testExitCode
          }
        }
      } else {
        console.log('Running all tests in all files')
        // Run all tests in all files
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
      }
      process.exit(exitCode)
    } else if (selectedTest.runAllInFile) {
      logger.cli(`Running all tests in: ${nicePath(selectedTest.file)}`)
      const testExitCode = await executeTest(selectedTest.file)
      process.exit(testExitCode)
    } else {
      const exitCode = await runSingleTest(selectedTest, testDescription, true)
      process.exit(exitCode)
    }
  }
  process.exit(0)
}

program
  .version('1.0.0')
  .description('Run targeted tests by description')
  .option('-a, --all', 'Run all matching tests instead of just the best match')
  .option('-l, --list', 'List all test descriptions found')
  .option('--ls', 'List all test descriptions found (alias for --list)')
  .argument('[args...]', 'Test description or [file/directory] and description')
  .action(async (args, options) => {
    logger.cli('Initializing CLI with version 1.0.0')
    let testFiles = []
    let allTests = []
    let testPath, testDescription
    const listIsEnabled = options.list || options.l || options.ls

    // If no args provided, run all test files
    if (!args || args.length === 0) {
      console.log('No args provided')
      testFiles = findTestFiles()
      if (testFiles.length === 0) {
        logger.cli('No test files found')
        process.exit(1)
      }

      if (options.list || options.l || options.ls) {
        await handleTestSelection({
          testFiles,
          fuzzyResults: null,
          listIsEnabled
        })
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

    /* Only 1 arg provided */
    if (args.length === 1) {
      logger.cli('1 arg provided')
      // Check if the single argument is a file or directory path
      const possiblePath = path.resolve(args[0])
      if (fs.existsSync(possiblePath)) {
        // Check if path is in node_modules
        if (possiblePath.includes('node_modules')) {
          logger.cli('Cannot run tests from node_modules directory')
          process.exit(1)
        }
        // Run all tests in this specific file or directory
        testPath = possiblePath
        testFiles = findTestFiles(testPath)
        if (testFiles.length === 0) {
          logger.cli('No test files found in:', nicePath(testPath))
          process.exit(1)
        }

        if (listIsEnabled) {
          await handleTestSelection({
            testFiles,
            fuzzyResults: null,
            listIsEnabled
          })
        }

        console.log(`Running all tests in: ${nicePath(testPath)}\n`)
        let exitCode = 0
        for (const file of testFiles) {
          try {
            console.log(`Running test file: ${nicePath(file)}`)
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
      } else {
        // Treat as test description
        testDescription = args[0]
        testFiles = findTestFiles()
        if (testFiles.length === 0) {
          logger.cli('No test files found')
          process.exit(1)
        }

        // fuzzy search test descriptions
        // Search for matching tests
        const foundTests = findTestsInFiles(testFiles)
        // console.log('foundTests', foundTests)

        // Fuzzy match test descriptions
        const searchTerm = testDescription.toLowerCase()
        const fuse = new Fuse(foundTests, {
          keys: ['description'],
          threshold: 0.3,
          sortFn: betterFuzzySort(searchTerm)
        })

        const results = fuse.search(testDescription)
  
        if (results.length === 0) {
          console.log('No matching tests found')
          process.exit(1)
        }

        if (results.length === 1) {
          const bestMatch = results[0].item
          const testExitCode = await runSingleTest(bestMatch, testDescription, true)
          //console.log('testExitCode', testExitCode)
          process.exit(testExitCode)
        }

        if (results.length > 1 || listIsEnabled) {
          await handleTestSelection({
            testFiles,
            fuzzyResults: results,
            testDescription,
            listIsEnabled
          })
        }
      }
    } else if (args.length >= 2) {
      logger.cli('2 or more args provided')
      // If the first arg looks like a file or directory, use it
      const possiblePath = path.resolve(args[0])
      if (fs.existsSync(possiblePath)) {
        // Check if path is in node_modules
        if (possiblePath.includes('node_modules')) {
          logger.cli('Cannot run tests from node_modules directory')
          process.exit(1)
        }
        testPath = possiblePath
        testDescription = args.slice(1).join(' ')
        testFiles = findTestFiles(testPath)
        if (testFiles.length === 0) {
          logger.cli('No test files found in:', nicePath(testPath))
          process.exit(1)
        }

        if (listIsEnabled) {
          await handleTestSelection({
            testFiles,
            fuzzyResults: null,
            listIsEnabled
          })
        }
      } else {
        // Fallback: treat all args as description
        testDescription = args.join(' ')
        testFiles = findTestFiles()
        if (testFiles.length === 0) {
          logger.cli('No test files found')
          process.exit(1)
        }

        if (listIsEnabled) {
          await handleTestSelection({
            testFiles,
            fuzzyResults: null,
            listIsEnabled
          })
        }
      }
    }

    /* 2 or more args provided */

    // Search for matching tests
    allTests = findTestsInFiles(testFiles)
    // console.log('allTests', allTests)
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
    // console.log(`🔎  Matched ${results.length} tests in ${uniqueFiles.length} files`)
    // console.log(formatTestOutput(results.map(result => result.item)))

    // If not using --all flag and multiple matches found, show interactive prompt
    if (!options.all && results.length > 1) {
      // Filter found allTest to only our results matches
      const filteredAllTest = results.map(result => result.item)
      const filteredTestFiles = [...new Set(filteredAllTest.map(test => test.file))]
      // console.log('filteredTestFiles', filteredTestFiles)
      await handleTestSelection({
        testFiles: filteredTestFiles,
        fuzzyResults: results,
        testDescription,
        listIsEnabled
      })
    }

    // Process matches
    const matches = options.all ? results : [results[0]]
    let exitCode = 0

    for (const result of matches) {
      const bestMatch = result.item
      const testExitCode = await runSingleTest(bestMatch, testDescription)
      if (testExitCode !== 0) {
        exitCode = testExitCode
      }
    }

    // Exit with overall test status
    process.exit(exitCode)
  })


function betterFuzzySort(searchTerm) {
  return (a, b) => {
    // Get descriptions in lowercase for comparison
    const aDescription = a.item['0'].v.toLowerCase()
    const bDescription = b.item['0'].v.toLowerCase()
    
    // Check for exact matches
    const aIsExact = aDescription === searchTerm
    const bIsExact = bDescription === searchTerm
    if (aIsExact && !bIsExact) return -1
    if (!aIsExact && bIsExact) return 1
    
    // If neither is exact, check for contains matches
    const aContains = aDescription.includes(searchTerm)
    const bContains = bDescription.includes(searchTerm)
    if (aContains && !bContains) return -1
    if (!aContains && bContains) return 1
    
    // If both are contains matches or neither is, use the fuzzy score
    // Lower score is better in Fuse.js
    return (b.score || 0) - (a.score || 0)
  }
}

const findTestsInFiles = (testFiles) => {
  return testFiles.map(file => {
    const content = readTestFile(file)
    const testMatches = content.match(/test\([`'\"]([^`'\"]+)[`'\"]/g) || []
    return testMatches.map(match => {
      const description = match.match(/test\([`'\"]([^`'\"]+)[`'\"]/)[1]
      return { file, description }
    })
  }).flat()
}

program.parse() 