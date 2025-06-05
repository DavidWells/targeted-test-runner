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

const FUSE_THRESHOLD = 0.3

// --- Helper Functions for CLI Logic ---

/**
 * Parses command line arguments to determine the test path and description.
 */
function parseCliArguments(args) {
  let testPath, testDescription

  if (!args || args.length === 0) {
    // No args: testPath and testDescription remain undefined
  } else if (args.length === 1) {
    const possiblePath = path.resolve(args[0])
    if (fs.existsSync(possiblePath) && !possiblePath.includes('node_modules')) {
      testPath = possiblePath
    } else {
      testDescription = args[0]
    }
  } else {
    // args.length >= 2
    const possiblePath = path.resolve(args[0])
    if (fs.existsSync(possiblePath) && !possiblePath.includes('node_modules')) {
      testPath = possiblePath
      testDescription = args.slice(1).join(' ')
    } else {
      testDescription = args.join(' ')
    }
  }
  if (testPath && testPath.includes('node_modules')) {
    logger.cli('Cannot run tests from node_modules directory')
    process.exit(1)
  }
  return { testPath, testDescription }
}

/**
 * Finds test files based on a path, or all test files if no path is given.
 * Exits if no test files are found.
 */
function getTestFilesOrExit(testPath) {
  const files = findTestFiles(testPath)
  if (files.length === 0) {
    const scope = testPath ? `in: ${nicePath(testPath)}` : 'in the project'
    logger.cli(`No test files found ${scope}`)
    process.exit(1)
  }
  return files
}

/**
 * Runs all tests in the provided list of files.
 */
async function runAllTestsInFiles(filesToRun, description = 'all tests') {
  logger.cli(`Running ${description}:`)
  filesToRun.forEach((file) => console.log(` - ${nicePath(file)}`))
  console.log()

  let overallExitCode = 0
  for (const file of filesToRun) {
    logger.cli(`Executing test file: ${nicePath(file)}`)
    try {
      const testExitCode = await executeTest(file)
      if (testExitCode !== 0) {
        overallExitCode = testExitCode
      }
    } catch (error) {
      logger.cli('Error executing test file:', error)
      overallExitCode = 1
    }
  }
  return overallExitCode
}

/**
 * Performs a fuzzy search on a list of tests.
 */
function performFuzzySearch(tests, searchTerm) {
  if (!searchTerm || tests.length === 0) return []
  const fuse = new Fuse(tests, {
    keys: ['description'],
    threshold: FUSE_THRESHOLD,
    sortFn: betterFuzzySort(searchTerm.toLowerCase()),
  })
  return fuse.search(searchTerm)
}

// --- Core Test Execution and Selection Logic ---

const formatTestOutput = (testDescriptions) => {
  if (!testDescriptions || testDescriptions.length === 0) return ''
  const maxPathLength = Math.max(...testDescriptions.map(({ file }) => nicePath(file).length))
  const paddingLength = maxPathLength + 5 // Add 5 for the " ◦ " separator

  return testDescriptions
    .map(({ file, description }) => {
      const paddedPath = nicePath(file).padEnd(paddingLength)
      return `   - ${paddedPath}"${description}"`
    })
    .join('\n')
}

const listAndSelectTests = async ({
  allTestItems = [], // Renamed from allTestDescriptions for clarity (items have file & desc)
  testFiles, // Used for context message
  fuzzyResults, // Optional: if provided, these are the primary items to list/select from
  testDescription, // The search term, if any
  listOnly, // Renamed from listIsEnabled
  totalTestCounts = {}, // New parameter for total test counts per file
}) => {
  // console.log('Debug - listAndSelectTests received totalTestCounts:', totalTestCounts)
  const itemsToList = fuzzyResults ? fuzzyResults.map((result) => result.item) : allTestItems

  console.log(
    `\n🔎 Found ${itemsToList.length} tests ${fuzzyResults ? `matching "${testDescription}"` : ''} in ${
      testFiles.length
    } test files:`,
  )
  console.log(formatTestOutput(itemsToList))
  console.log()

  if (listOnly) {
    process.exit(0)
  }

  const testsPerFile = {}
  itemsToList.forEach(({ file }) => {
    testsPerFile[file] = (testsPerFile[file] || 0) + 1
  })

  const multiTestFiles = Object.entries(testsPerFile)
    .filter(([_, count]) => count > 1)
    .map(([file]) => file)

  const choices = []
  if (fuzzyResults && fuzzyResults.length > 0) {
    const uniqueFiles = new Set(fuzzyResults.map(result => result.item.file))
    choices.push({
      title: `✓ Run all ${fuzzyResults.length} matching tests for "${testDescription}" in ${uniqueFiles.size} different files`,
      value: { runAllMatching: true, testDescription },
    })
  } else {
    choices.push({
      title: '✓ Run all found tests',
      value: { runAllFound: true },
    })
  }
  /*
  console.log('Debug - multiTestFiles:', multiTestFiles)
  console.log('Debug - totalTestCounts in choices:', totalTestCounts)
  /** */
  choices.push(
    ...multiTestFiles.map((file) => {
      // console.log(`Debug - count for ${file}:`, totalTestCounts[file])
      return {
        title: `▶ Run all ${totalTestCounts[file]} tests in file ${nicePath(file)}`,
        value: { runAllInFile: true, file },
      }
    }),
  )

  choices.push(
    ...itemsToList.map(({ file, description }) => ({
      title: `◉ Run test "${description}" in ${nicePath(file)}`,
      value: { file, description, isSingleTest: true },
    })),
  )

  choices.push({ title: '✖ Cancel', value: { cancel: true } })

  try {
    const response = await prompts({
      type: 'autocomplete',
      name: 'selectedOption',
      message: 'Select an option',
      choices,
      suggest: (input, currentChoices) =>
        currentChoices.filter((i) => i.title.toLowerCase().includes(input.toLowerCase())),
    })

    if (!response || !response.selectedOption || response.selectedOption.cancel) {
      console.log('Selection cancelled.')
      process.exit(0)
    }
    return response.selectedOption
  } catch (error) {
    console.error('Error during selection:', error)
    process.exit(1)
  }
}

async function runSingleTest(testInfo, originalSearchTerm = null, copyToClipboard = false) {
  const { file, description } = testInfo
  logger.cli(`Running test: "${description}" in ${nicePath(file)}`)

  const content = readTestFile(file)
  const modified = modifyTestFile(content, description)
  const tempFile = createTempFile(modified, file)
  logger.cli(`Created temporary file: ${tempFile}`)

  try {
    const testExitCode = await executeTest(tempFile, {
      bestMatch: testInfo,
      testDescription: originalSearchTerm || description, // Pass original search term if available
    })
    cleanupTempFile(tempFile)

    if (copyToClipboard) {
      await copyCommandToClipboard(`${cleanMacPath(file)} "${description}"`)
    }
    return testExitCode
  } catch (error) {
    logger.cli('Error executing single test:', error)
    cleanupTempFile(tempFile)
    return 1
  }
}

async function copyCommandToClipboard(commandValue) {
  const isLocalDev = (process.argv[1] || '').includes('targeted-test-runner/src')
  const cmdToCopy = isLocalDev ? 'node src/index.js' : 'tt'
  const command = `${cmdToCopy} ${commandValue}`
  try {
    const clipboardy = await import('clipboardy')
    await clipboardy.default.write(command)
    console.log('\n📋 Command copied to clipboard:')
    console.log(command)
  } catch (err) {
    logger.cli('\n📋 Failed to copy command to clipboard. Manual copy:')
    console.log(command)
    // logger.error('Clipboardy error:', err); // Optional: for debugging
  }
}

function cleanMacPath(filePath) {
  // Renamed for clarity
  return filePath.replace(/^\/Users\/([A-Za-z0-9_-]*)\//, '~/')
}

// --- Main Program Logic ---
program
  .version('1.0.0')
  .description('Run targeted tests by description')
  .option('-a, --all', 'Run all matching tests instead of just the best match')
  .option('-l, --list', 'List all test descriptions found')
  .option('--ls', 'List all test descriptions found (alias for --list)')
  .argument('[args...]', 'Test description or [file/directory] and description')
  .action(async (args, options) => {
    logger.cli('Initializing CLI with version 1.0.0')

    const listOnly = options.list || options.ls
    const runAllMatchingFlag = options.all || options.a

    const { testPath, testDescription } = parseCliArguments(args)
    const testFiles = getTestFilesOrExit(testPath) // testPath can be undefined for all files
    const allRunnableTests = findTestsInFiles(testFiles).filter((test, index, self) =>
      index === self.findIndex((t) => t.file === test.file && t.description === test.description)
    )

    // const allRunnableTests = []

    if (allRunnableTests.length === 0) {
      console.log(`No runnable tests found in ${process.cwd()}`)
      process.exit(1)
    }

    const totalTestCounts = allRunnableTests.reduce((acc, { file }) => {
      acc[file] = (acc[file] || 0) + 1
      return acc
    }, {})

    // If no args provided, run all test files
    if (!args || args.length === 0) {
      if (listOnly) {
        await listAndSelectTests({ 
          allTestItems: allRunnableTests, 
          testFiles, 
          listOnly: true,
          allFlag: runAllMatchingFlag,
          totalTestCounts
        })
        // listAndSelectTests will exit if listOnly is true
      }

      console.log(`Found ${testFiles.length} test files:`)
      testFiles.forEach(file => console.log(` - ${nicePath(file)}`))
      console.log()

      const exitCode = await runAllTestsInFiles(testFiles, 'all tests')
      process.exit(exitCode)
    }

    // If we have a path but no description, run all tests in that path
    if (testPath && !testDescription) {
      if (listOnly) {
        await listAndSelectTests({ 
          allTestItems: allRunnableTests, 
          testFiles, 
          listOnly: true,
          allFlag: runAllMatchingFlag,
          totalTestCounts
        })
        // listAndSelectTests will exit if listOnly is true
      }

      console.log(`Running all tests in: ${nicePath(testPath)}\n`)
      const exitCode = await runAllTestsInFiles(testFiles, `all tests in ${nicePath(testPath)}`)
      process.exit(exitCode)
    }

    // Handle non-TTY scenarios first
    if (!process.stdout.isTTY) {
      logger.cli('Non-TTY environment detected, running non-interactively.')
      let exitCode = 0
      if (testDescription) {
        const fuzzyResults = performFuzzySearch(allRunnableTests, testDescription)
        if (fuzzyResults.length > 0) {
          const bestMatch = fuzzyResults[0].item
          logger.cli(
            `Running best match for "${testDescription}": "${bestMatch.description}" in ${nicePath(bestMatch.file)}`,
          )
          exitCode = await runSingleTest(bestMatch, testDescription)
        } else {
          logger.cli(`No tests found matching "${testDescription}".`)
          exitCode = 1
        }
      } else {
        // No description, run all tests in the determined scope
        const scopeDesc = testPath ? `all tests in ${nicePath(testPath)}` : 'all tests in project'
        exitCode = await runAllTestsInFiles(testFiles, scopeDesc)
      }
      process.exit(exitCode)
    }

    // Interactive TTY mode from here

    if (!testDescription) {
      // No description provided, potentially list or run all
      if (listOnly) {
        await listAndSelectTests({ 
          allTestItems: allRunnableTests, 
          testFiles, 
          listOnly: true,
          allFlag: runAllMatchingFlag,
          totalTestCounts
        })
        // listAndSelectTests will exit if listOnly is true
      }

      // If not just listing, prompt to select from all or run all
      const selection = await listAndSelectTests({ 
        allTestItems: allRunnableTests, 
        testFiles, 
        listOnly: false,
        allFlag: runAllMatchingFlag,
        totalTestCounts
      })
      return handleSelectionResult(selection, allRunnableTests, testFiles, null, runAllMatchingFlag)
    }

    // We have a testDescription, proceed with fuzzy search
    const fuzzyResults = performFuzzySearch(allRunnableTests, testDescription)

    if (fuzzyResults.length === 0) {
      console.log(`No tests found matching "${testDescription}".`)
      console.log(`Run "tt --list" to see all tests in the current directory.`)
      process.exit(0)
    }

    if (listOnly) {
      await listAndSelectTests({ 
        fuzzyResults, 
        testFiles, 
        testDescription, 
        listOnly: true,
        totalTestCounts
      })
      // listAndSelectTests will exit
    }

    if (!runAllMatchingFlag && fuzzyResults.length > 1) {
      // Multiple matches, not --all flag, prompt user
      const selection = await listAndSelectTests({
        fuzzyResults,
        testFiles: [...new Set(fuzzyResults.map((r) => r.item.file))], // Files relevant to fuzzy results
        testDescription,
        listOnly: false,
        totalTestCounts
      })
      return handleSelectionResult(
        selection,
        fuzzyResults.map((r) => r.item),
        testFiles,
        testDescription,
        runAllMatchingFlag,
      )
    }

    // Single match, or --all flag with one or more matches
    const testsToExecute = runAllMatchingFlag ? fuzzyResults.map((r) => r.item) : [fuzzyResults[0].item]
    let overallExitCode = 0

    if (testsToExecute.length === 1) {
      overallExitCode = await runSingleTest(testsToExecute[0], testDescription, true)
    } else {
      // Multiple tests due to --all flag
      logger.cli(`Running all ${testsToExecute.length} tests matching "${testDescription}":`)
      for (const testInfo of testsToExecute) {
        const singleExitCode = await runSingleTest(testInfo, testDescription, false) // No individual copy for --all
        if (singleExitCode !== 0) overallExitCode = singleExitCode
      }
      if (testsToExecute.length > 0) {
        await copyCommandToClipboard(`"${testDescription}" --all`)
      }
    }
    process.exit(overallExitCode)
  })

/**
 * Handles the result from the interactive prompt.
 * This replaces parts of the old `handleTestSelection`.
 */
async function handleSelectionResult(
  selectedOption, // The choice object from prompts
  candidateTests, // All tests that were part of the fuzzy search or initial list
  allFoundTestFiles, // All files originally found in scope
  originalSearchTerm, // The description user typed, if any
  runAllMatchingFlag,
) {
  // The --all flag state
  if (selectedOption.cancel) {
    logger.cli('Selection cancelled.')
    process.exit(0)
  }

  let exitCode = 0

  if (selectedOption.runAllMatching) {
    // User chose "Run all X matching tests for '...'"
    logger.cli(`Running all ${candidateTests.length} tests matching "${selectedOption.testDescription}":`)
    for (const testInfo of candidateTests) {
      // candidateTests here are the fuzzyResults.map(r => r.item)
      const testExitCode = await runSingleTest(testInfo, selectedOption.testDescription)
      if (testExitCode !== 0) exitCode = testExitCode
    }
    if (candidateTests.length > 0) {
      await copyCommandToClipboard(`"${selectedOption.testDescription}" --all`)
    }
  } else if (selectedOption.runAllFound) {
    // User chose "Run all found tests" (when no initial description)
    exitCode = await runAllTestsInFiles(allFoundTestFiles, 'all found tests')
    // No specific command to copy for "all found tests" unless we define one.
  } else if (selectedOption.runAllInFile) {
    logger.cli(`Running all tests in: ${nicePath(selectedOption.file)}`)
    exitCode = await executeTest(selectedOption.file)
    // Potentially copy command: tt path/to/file
    await copyCommandToClipboard(cleanMacPath(selectedOption.file))
  } else if (selectedOption.isSingleTest) {
    // User picked a specific test
    exitCode = await runSingleTest(selectedOption, originalSearchTerm, true)
  } else {
    logger.cli('Unknown selection. Aborting.')
    exitCode = 1
  }
  process.exit(exitCode)
}

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

function findTestsInFiles(testFiles) {
  return testFiles.map(file => {
    const content = readTestFile(file)
    const testMatches = content.match(/[^'`"]test\([`'\"]([^`'\"]+)[`'\"]/g) || []
    return testMatches.map(match => {
      const description = match.match(/[^'`"]test\([`'\"]([^`'\"]+)[`'\"]/)[1]
      return { file, description }
    })
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

program.parse()
