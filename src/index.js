#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const Fuse = require('fuse.js')
// Alt searcher maybe https://github.com/kentcdodds/match-sorter/blob/main/src/index.ts
const prompts = require('prompts')
const { program } = require('commander')
const logger = require('./utils/logger')
const { findTestFiles, readTestFile, modifyTestFile, createTempFile } = require('./utils/test-processor')
const { executeTest } = require('./utils/test-runner')
const { cleanupTempFile, trackTempFile } = require('./utils/cleanup')
const { logBox } = require('@davidwells/box-logger')
const nicePath = require('./utils/nice-path')
const chalk = require('./utils/chalk')
const { createEditorLink } = require('./utils/links')
const { logLine, logHeader } = require('@davidwells/box-logger')
const { findTestsInFiles, findFailedTestLines } = require('./utils/find-tests')

const FUSE_THRESHOLD = 0.3

// --- Helper Functions for CLI Logic ---

/**
 * Logs failed tests before process exit
 */
function logFailedTests(failedTests, caller = '') {
  // console.log('failedTests', failedTests)
  if (!failedTests || failedTests.length === 0) {
    return
  }

  if (caller === 'exact-match-single') {
    return
  }

  if (caller) {
    // console.log('caller', caller)
  }

  console.log()
  const fileWord = failedTests.length === 1 ? 'file' : 'files'
  console.log(chalk.redBright(`✖ Failed ${fileWord} (${failedTests.length}):\n`))
  failedTests.forEach((failedTest) => {
    // console.log('failedTest', failedTest)
    const { file, exitCode, error, description, stderr, stdout } = failedTest
    const filePath = nicePath(file)
    if (error || stdout || stderr) {
      // If we have stderr, use the first line that starts with 'Error:' or the actual error message
      let errorMessage = stderr ? stderr.split('\n').find(line => line.startsWith('Error:')) || error : error
      if (!errorMessage) {
        errorMessage = `Exit code: ${exitCode}`
      }
      console.log(
        chalk.redBright(`- ${filePath}${description ? ` - "${description}"` : ''} - ${errorMessage}`)
      )
      // If we have stderr output, show it
      if (stderr) {
        // Get all lines after the first Error: line
        const lines = stderr.split('\n')
        const errorIndex = lines.findIndex(line => 
          line.startsWith('Error:') || 
          line.startsWith('ReferenceError:') ||
          line.startsWith('TypeError:') ||
          line.startsWith('SyntaxError:') ||
          line.startsWith('RangeError:') ||
          line.startsWith('EvalError:') ||
          line.startsWith('URIError:') ||
          line.startsWith('AssertionError:') ||
          line.startsWith('ValidationError:') ||
          line.startsWith('AggregateError:')
        )
        if (errorIndex !== -1) {
          const stackLines = lines.slice(errorIndex + 1)
            .filter(line => line.trim().startsWith('at '))
          if (stackLines.length > 0) {
            console.log(chalk.gray(`    Stack trace:\n${stackLines.join('\n')}`))
          }
        }
      }
      // Find failed tests in stdout
      if (stdout) {
        const failedTestNames = stdout.split('\n')
          .filter(line => line.trim().startsWith('FAIL'))
          .map(line => {
            const match = line.match(/FAIL\s+"([^"]+)"/)
            return match ? match[1] : null
          })
          .filter(Boolean)

        //console.log('failedTestNames', failedTestNames)
        
        if (failedTestNames.length > 0) {
          const testWord = failedTestNames.length === 1 ? 'test' : 'tests'
          console.log(
            chalk.gray(`Failed ${testWord} (${failedTestNames.length}):\n${findFailedTestLines(file, failedTestNames)}`)
          )
          console.log()
        }
      }
    } else {
      console.log(
        chalk.redBright(`x  • ${filePath}${description ? ` - "${description}"` : ''} - Exit code: ${exitCode}`)
      )
    }
  })
  console.log()
}

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
    console.log(`No test files found ${scope}`)
    process.exit(1)
  }
  return files
}

/**
 * Runs all tests in the provided list of files.
 */
async function runAllTestsInFiles(filesToRun, description = 'all tests', testCounts) {
  logger.cli(`Running ${description}:`)
  // Get the filesToRun from testCounts
  const filteredTestCounts = Object.entries(testCounts).filter(([file]) => filesToRun.includes(file))
  
  // Calculate max path length for alignment
  const maxPathLength = Math.max(...filteredTestCounts.map(([file]) => nicePath(file).length))
  const paddingLength = maxPathLength + 5 // Add 5 for the ": " separator

  console.log('filesToRun:')
  filteredTestCounts.forEach(([file, count]) => {
    const paddedPath = nicePath(file).padEnd(paddingLength)
    console.log(` - ${paddedPath}${count} tests`)
  })
  console.log()

  let overallExitCode = 0
  const failedTests = []
  
  for (const file of filesToRun) {
    console.log(`Running test file: ${nicePath(file)}`)
    try {
      const testResult = await executeTest(file)
      if (!testResult.success) {
        overallExitCode = testResult.exitCode
        // console.log('testResult', testResult)
        failedTests.push({ 
          file,
          exitCode: testResult.exitCode,
          stdout: testResult.stdout,
          stderr: testResult.stderr
        })
      }
    } catch (error) {
      logger.cli('Error executing test file:', error)
      overallExitCode = 1
      console.log('error', error)
      failedTests.push({ 
        file, 
        error: error.message || error,
        stderr: error.stderr || null
      })
    }
  }
  
  return { exitCode: overallExitCode, failedTests }
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

function fuzzyHighlight(text, query, chalkColor = 'cyan') {
  let result = ''
  let queryIndex = 0
  
  for (let i = 0; i < text.length; i++) {
    if (queryIndex < query.length && text[i].toLowerCase() === query[queryIndex].toLowerCase()) {
      result += chalk[chalkColor](text[i])
      queryIndex++
    } else {
      result += text[i]
    }
  }
  
  return result
}

function highlightMatch(text = '', query = '', chalkColor = 'cyan') {
  if (!query) return text
  
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) {
    // Attempt fuzzy highlight if no exact match
    return fuzzyHighlight(text, query, chalkColor)
  }
  
  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)
  
  return `${before}${chalk[chalkColor](match)}${after}`
}

function formatTestDescription(description, searchTerm) {
  if (!searchTerm) return description
  const chalkColor = 'redBright'
  const regex = new RegExp(`(${searchTerm})`, 'gi')

  if (description.match(regex)) {
    return description.replace(regex, (match) => chalk[chalkColor](match))
  }
  return highlightMatch(description, searchTerm, chalkColor)
}

function chalkGray(text) {
  return chalk.hex('#888888')(text)
}

function formatTestWrapper(description, searchTerm, quoteType) {
  const useHex = true
  const color = 'gray'
  const wrapperColor = (useHex ? chalk.hex('#888888') : chalk[color]) 
  const formattedDescription = formatTestDescription(description, searchTerm)
  return `${wrapperColor(`test(${quoteType}`) + `${formattedDescription}` + wrapperColor(`${quoteType})`)}`
}

// --- Core Test Execution and Selection Logic ---
const COLUMN_WIDTH = 12
const formatTestOutput = (testDescriptions, searchTerm = null) => {
  if (!testDescriptions || testDescriptions.length === 0) return ''
  const maxPathLength = Math.max(...testDescriptions.map(({ file }) => nicePath(file).length))
  const paddingLength = maxPathLength + COLUMN_WIDTH // Add 5 for the " ◦ " separator

  return testDescriptions
    .map(({ file, description, quoteType, lineNumber }) => {
      const displayPath = `${nicePath(file)}:${lineNumber}`
      const editorLink = createEditorLink(file, lineNumber, 0, 'Open')
      const paddedPath = displayPath.padEnd(paddingLength)
      return `  ${editorLink} - ${paddedPath}${formatTestWrapper(description, searchTerm, quoteType)}`
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
  cb,
}) => {
  // console.log('Debug - listAndSelectTests received totalTestCounts:', totalTestCounts)
  const itemsToList = fuzzyResults ? fuzzyResults.map((result) => result.item) : allTestItems

  console.log(
    `\n🔎  Found ${itemsToList.length} tests${fuzzyResults ? ` matching "${testDescription}"` : ' '}in ${
      testFiles.length
    } test files:`,
  )
  console.log()
  console.log(formatTestOutput(itemsToList, testDescription))
  console.log()

  // TODO make custom electron app for this protocol to work?
  //console.log(`\x1b]8;;clipboard:${encodeURIComponent('lol')}\x1b\\Click to copy\x1b]8;;\x1b\\`)

  if (listOnly) {
    if (cb) {
      cb({ itemsToList, testFiles, testDescription, listOnly, totalTestCounts })
    }
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

  choices.push(
    ...multiTestFiles.map((file) => ({
      title: `▶ Run all ${totalTestCounts[file]} tests in file ${nicePath(file)}`,
      value: { runAllInFile: true, file },
    })),
  )

  choices.push(
    ...itemsToList.map((item) => {
      const { file, description, quoteType, lineNumber } = item
      let highlightedDescription = description
      if (testDescription) {
        const regex = new RegExp(`(${testDescription})`, 'gi')
        highlightedDescription = description.replace(regex, (match) => chalk.redBright(match))
      }
      return {
        title: `◉ Run ${formatTestWrapper(description, testDescription, quoteType)} in ${nicePath(file)}`,
        value: Object.assign(item, { isSingleTest: true }),
      }
    }),
  )

  choices.push({ title: '✖ Cancel', value: { cancel: true } })

  try {
    const response = await prompts({
      type: 'autocomplete',
      name: 'selectedOption',
      message: 'Select a test',
      choices,
      suggest: (input, currentChoices) =>
        currentChoices.filter((i) => i.title.toLowerCase().includes(input.toLowerCase())),
    })
    console.log()

    if (!response || !response.selectedOption || response.selectedOption.cancel) {
      console.log('Test selection cancelled.')
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
  const tempFile = await createTempFile(modified, file)
  logger.cli(`Created temporary file: ${tempFile}`)
  
  // Track the temp file for cleanup
  trackTempFile(tempFile)

  try {
    const testResult = await executeTest(tempFile, {
      bestMatch: testInfo,
      testDescription: originalSearchTerm || description, // Pass original search term if available
    })
    cleanupTempFile(tempFile)

    await copyCommandToClipboard(`${cleanMacPath(file)} "${description}" --exact`, copyToClipboard)
    const openLinkTiny = createEditorLink(testInfo.file, testInfo.lineNumber, 0, `${nicePath(file)}:${testInfo.lineNumber}`)
    const symbol = testResult.success ? 'success' : 'error'
    const thickness = testResult.success ? 'bold' : 'thick'
    logLine[symbol](` Ending test "${description}" ${openLinkTiny}`, { borderStyle: thickness })
    console.log()

    return testResult
  } catch (error) {
    console.log('Error executing single test:', error)
    // Log stderr if available
    if (error.stderr) {
      console.log('Test stderr output:', error.stderr)
    }
    cleanupTempFile(tempFile)
    return { success: false, exitCode: 1 }
  }
}

async function copyCommandToClipboard(commandValue, shouldCopy = false) {
  const isLocalDev = (process.argv[1] || '').includes('targeted-test-runner/src')
  const cmdToCopy = isLocalDev ? 'node src/index.js' : 'tt'
  const command = `${cmdToCopy} ${commandValue}`
  try {
    if (shouldCopy) {
      const clipboardy = await import('clipboardy')
      await clipboardy.default.write(command)
    }
    console.log('Run tests again with CLI command:')
    console.log(`${command}`)
    console.log()
  } catch (err) {
    logger.cli('📋 Failed to copy command to clipboard. Manual copy:')
    logger.cli(command)
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
  .option('-r, --run', 'Alias for --all: Run all matching tests')
  .option('-f, --force', 'Alias for --all: Run all matching tests')
  .option('-e, --exact', 'Run exact match only')
  .option('-l, --list', 'List all test descriptions found')
  .option('--ls', 'List all test descriptions found (alias for --list)')
  .option('-c, --copy', 'Copy the command to clipboard')
  .argument('[args...]', 'Test description or [file/directory] and description')
  .addHelpText('after', `
Examples:
  # Run all tests in the current directory
  $ tt

  # List all available tests
  $ tt --list

  # Run a specific test by description
  $ tt "should handle user login"

  # Run all tests matching a description
  $ tt "login" --all

  # Run all tests in a specific file
  $ tt src/tests/auth.test.js

  # Run tests in a specific file matching a description
  $ tt src/tests/auth.test.js "login"

  # Run all tests in a directory
  $ tt src/tests/

  # Run tests in a directory matching a description
  $ tt src/tests/ "login"

  # Run a test and copy the command to clipboard
  $ tt "login" --copy
`)
  .action(async (args, options) => {
    logger.cli('Initializing CLI with version 1.0.0')
    const emptyFlags = Object.keys(options).length === 0
    const listOnly = options.list || options.ls
    const runAllMatchingFlag = options.all || options.a || options.run || options.r || options.force || options.f
    const exactFlag = options.exact || options.e
    const forceFlag = options.force || options.f
    const copyToClipboard = options.copy || options.c
    const listHijack = emptyFlags && (args.length === 1 && (args[0] === 'list' || args[0] === 'ls'))
    const runHijack = emptyFlags && (args.length === 1 && (args[0] === 'run' || args[0] === 'r'))
    const { testPath, testDescription } = parseCliArguments(args)
    const testFiles = getTestFilesOrExit(testPath) // testPath can be undefined for all files
    const allRunnableTests = (await findTestsInFiles(testFiles)).filter((test, index, self) =>
      index === self.findIndex((t) => t.file === test.file && t.description === test.description)
    )
    // console.log('allRunnableTests', allRunnableTests)
    // process.exit(0)

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
    if (!args || args.length === 0 || listHijack) {
      await listAndSelectTests({ 
        allTestItems: allRunnableTests, 
        testFiles, 
        listOnly: true,
        allFlag: runAllMatchingFlag,
        totalTestCounts,
        cb: ({ itemsToList, testFiles, testDescription, listOnly, totalTestCounts }) => {
          logBox.info({
            title: 'Tests Found',
            text: `${itemsToList.length} tests${testDescription ? ` matching "${testDescription}"` : ' '}in ${testFiles.length} test files`,
            borderStyle: 'rounded',
            borderWidth: 1,
            padding: 1,
            margin: 1,
            minWidth: 70,
          })
        }
      })
    }

    if (runHijack) {
      console.log(`Running all ${allRunnableTests.length} tests in ${process.cwd()}\n`)
      const { exitCode, failedTests } = await runAllTestsInFiles(testFiles, 'all tests', totalTestCounts)
      logFailedTests(failedTests, 'run-all-tests')
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
      const { exitCode, failedTests } = await runAllTestsInFiles(
        testFiles, 
        `all tests in ${nicePath(testPath)}`, 
        totalTestCounts
      )
      logFailedTests(failedTests, 'run-all-tests-in-path')
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
          const testResult = await runSingleTest(bestMatch, testDescription)
          if (!testResult.success) {
            logFailedTests([{ file: bestMatch.file, exitCode: testResult.exitCode, description: bestMatch.description }], 'non-tty-single-test')
          }
        } else {
          logger.cli(`No tests found matching "${testDescription}".`)
          exitCode = 1
        }
      } else {
        // No description, run all tests in the determined scope
        const scopeDesc = testPath ? `all tests in ${nicePath(testPath)}` : 'all tests in project'
        const result = await runAllTestsInFiles(testFiles, scopeDesc, totalTestCounts)
        exitCode = result.exitCode
        logFailedTests(result.failedTests, 'non-tty')
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
      return handleSelectionResult(selection, allRunnableTests, testFiles, null, runAllMatchingFlag, copyToClipboard, totalTestCounts)
    }

    // We have a testDescription, proceed with fuzzy search
    const fuzzyResults = performFuzzySearch(allRunnableTests, testDescription)

    if (fuzzyResults.length === 0) {
      console.log(`No tests found matching "${testDescription}".`)
      console.log(`Run "tt --list" to see all tests in the current directory.`)
      process.exit(0)
    }

    // Check for exact matches
    const exactMatches = fuzzyResults.filter(result => 
      result.item.description.toLowerCase() === testDescription.toLowerCase()
    )

    /* If one exact match, and --force flag, run it directly */
    if (exactFlag && exactMatches.length === 1) {
      console.log('Using --force flag, running exact match directly.\n')
      logger.cli(
        `Found exact match for "${testDescription}": "${exactMatches[0].item.description}" in ${nicePath(exactMatches[0].item.file)}`
      )
      const testResult = await runSingleTest(exactMatches[0].item, testDescription, copyToClipboard)
      if (!testResult.success) {
        logFailedTests([{ file: exactMatches[0].item.file, exitCode: testResult.exitCode, description: exactMatches[0].item.description }], 'exact-match-force')
      }
      process.exit(testResult.exitCode)
    }

    if (exactMatches.length === 1 && !runAllMatchingFlag) {
      // Check if any other fuzzy results start with the exact match
      const hasPrefixMatches = fuzzyResults.some(result => 
        !exactMatches.includes(result) && 
        result.item.description.toLowerCase().startsWith(exactMatches[0].item.description.toLowerCase())
      )

      if (!hasPrefixMatches) {
        // If we have exactly one exact match, no prefix matches, and not using --all flag, run it directly
        logger.cli(
          `Found exact match for "${testDescription}": "${exactMatches[0].item.description}" in ${nicePath(exactMatches[0].item.file)}`
        )
        if (fuzzyResults.length > 1) {
          console.log(`Found ${fuzzyResults.length} tests fuzzy matching "${testDescription}".`)
          console.log(`But using the exact match: "${exactMatches[0].item.description}" in ${nicePath(exactMatches[0].item.file)}\n`)
        }
        const testResult = await runSingleTest(exactMatches[0].item, testDescription, copyToClipboard)
        if (!testResult.success) {
          logFailedTests([{ file: exactMatches[0].item.file, exitCode: testResult.exitCode, description: exactMatches[0].item.description }], 'exact-match-single')
        }
        process.exit(testResult.exitCode)
      }
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
        copyToClipboard,
        totalTestCounts,
      )
    }

    // Single match, or --all flag with one or more matches
    const testsToExecute = runAllMatchingFlag ? fuzzyResults.map((r) => r.item) : [fuzzyResults[0].item]
    let overallExitCode = 0

    if (testsToExecute.length === 1) {
      const testResult = await runSingleTest(testsToExecute[0], testDescription, false)
      if (!testResult.success) {
        overallExitCode = testResult.exitCode
        logFailedTests([{ file: testsToExecute[0].file, exitCode: testResult.exitCode, description: testsToExecute[0].description }], 'run-single-or-multiple')
      }
    } else {
      // Multiple tests due to --all flag
      logger.cli(`Running all ${testsToExecute.length} tests matching "${testDescription}":`)
      const failedTests = []
      for (const testInfo of testsToExecute) {
        const testResult = await runSingleTest(testInfo, testDescription, false)
        if (!testResult.success) {
          overallExitCode = testResult.exitCode
          failedTests.push({ 
            file: testInfo.file, 
            exitCode: testResult.exitCode, 
            description: testInfo.description,
            stdout: testResult.stdout,
            stderr: testResult.stderr
          })
        }
      }
      logFailedTests(failedTests, 'run-all-matching')
      if (testsToExecute.length > 0) {
        const niceDir = nicePath(testPath)
        const niceDirRender = (niceDir) ? `${niceDir} ` : ''
        await copyCommandToClipboard(`${niceDirRender}"${testDescription}" --all`, copyToClipboard)
      }
    }
    logFailedTests(overallExitCode !== 0 && testsToExecute.length === 1 ? [{ file: testsToExecute[0].file, exitCode: overallExitCode, description: testsToExecute[0].description }] : [], 'run-single-or-multiple')
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
  copyToClipboard,
  totalTestCounts, // Test counts per file
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
    const failedTests = []
    for (const testInfo of candidateTests) {
      // candidateTests here are the fuzzyResults.map(r => r.item)
      const testResult = await runSingleTest(testInfo, selectedOption.testDescription, false)
      if (!testResult.success) {
        exitCode = testResult.exitCode
        failedTests.push({ 
          file: testInfo.file, 
          exitCode: testResult.exitCode, 
          description: testInfo.description,
          stdout: testResult.stdout,
          stderr: testResult.stderr
        })
      }
    }
    logFailedTests(failedTests, 'run-all-matching-selection')
    if (candidateTests.length > 0) {
      await copyCommandToClipboard(`"${selectedOption.testDescription}" --all`, copyToClipboard)
    }
  } else if (selectedOption.runAllFound) {
    // User chose "Run all found tests" (when no initial description)
    const result = await runAllTestsInFiles(allFoundTestFiles, 'all found tests', totalTestCounts)
    exitCode = result.exitCode
    logFailedTests(result.failedTests, 'run-all-found')
    // No specific command to copy for "all found tests" unless we define one.
  } else if (selectedOption.runAllInFile) {
    logger.cli(`Running all tests in: ${nicePath(selectedOption.file)}`)
    const testResult = await executeTest(selectedOption.file)
    if (!testResult.success) {
      logFailedTests([{ file: selectedOption.file, exitCode: testResult.exitCode }], 'run-all-in-file')
    }
    // Potentially copy command: tt path/to/file
    await copyCommandToClipboard(cleanMacPath(selectedOption.file), copyToClipboard)
  } else if (selectedOption.isSingleTest) {
    // User picked a specific test
    const testResult = await runSingleTest(selectedOption, originalSearchTerm, copyToClipboard)
    if (!testResult.success) {
      logFailedTests([{ file: selectedOption.file, exitCode: testResult.exitCode, description: selectedOption.description }], 'run-single-test-selection')
    }
    process.exit(testResult.exitCode)
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

program.parse()