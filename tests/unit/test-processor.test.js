const { test } = require('uvu')
const assert = require('uvu/assert')
const path = require('path')
const fs = require('fs')
const { findTestFiles, readTestFile, modifyTestFile, createTempFile } = require('../../src/utils/test-processor')

test('test processor functions exist', () => {
  assert.type(findTestFiles, 'function')
  assert.type(readTestFile, 'function')
  assert.type(modifyTestFile, 'function')
  assert.type(createTempFile, 'function')
})

test('findTestFiles finds test files', () => {
  const files = findTestFiles(path.join(__dirname, '../../fixtures'))
  const readDirFiles = fs.readdirSync(path.join(__dirname, '../../fixtures'))
  const testFiles = readDirFiles.filter(file => file.endsWith('.test.js'))
  const subDirFiles = fs.readdirSync(path.join(__dirname, '../../fixtures/sub-dir'))
  const subDirTestFiles = subDirFiles.filter(file => file.endsWith('.test.js'))
  assert.is(files.length, testFiles.length + subDirTestFiles.length)
  assert.is(files[0].endsWith('.test.js'), true)
})

test('findTestFiles excludes node_modules', () => {
  // Create a temporary directory structure
  const tempDir = path.join(__dirname, '../../temp-test-dir')
  const nodeModulesDir = path.join(tempDir, 'node_modules')
  const testFile = path.join(nodeModulesDir, 'test.test.js')
  
  fs.mkdirSync(tempDir, { recursive: true })
  fs.mkdirSync(nodeModulesDir, { recursive: true })
  fs.writeFileSync(testFile, 'test content')
  
  try {
    const files = findTestFiles(tempDir)
    assert.is(files.length, 0)
  } finally {
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('readTestFile reads file content', () => {
  const content = readTestFile(path.join(__dirname, '../../fixtures/example-quotes-single.test.js'))
  assert.type(content, 'string')
  assert.is(content.includes('test one'), true)
})

test('modifyTestFile adds .only to matching test with single quotes', () => {
  const content = `test('test one', () => {})
test('test two', () => {})`
  const modified = modifyTestFile(content, 'test two')
  assert.is(modified.includes('test.only('), true)
  assert.is(modified.includes('test two'), true)
})

test('modifyTestFile adds .only to matching test with double quotes', () => {
  const content = `test("test one", () => {})
test("test two", () => {})`
  const modified = modifyTestFile(content, 'test two')
  assert.is(modified.includes('test.only('), true)
  assert.is(modified.includes('test two'), true)
})

test('modifyTestFile adds .only to matching test with backticks', () => {
  const content = 'test(`test one`, () => {})\ntest(`test two`, () => {})'
  const modified = modifyTestFile(content, 'test two')
  assert.is(modified.includes('test.only('), true)
  assert.is(modified.includes('test two'), true)
})

test('createTempFile creates temporary file', () => {
  const testPath = path.join(__dirname, '../../fixtures/example-quotes-single.test.js')
  const tempPath = createTempFile('test content', testPath)
  assert.is(fs.existsSync(tempPath), true)
  fs.unlinkSync(tempPath)
})

test.run() 