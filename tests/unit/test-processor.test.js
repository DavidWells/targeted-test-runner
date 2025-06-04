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
  assert.is(files.length, 1)
  assert.is(files[0].endsWith('example.test.js'), true)
})

test('readTestFile reads file content', () => {
  const content = readTestFile(path.join(__dirname, '../../fixtures/example.test.js'))
  assert.type(content, 'string')
  assert.is(content.includes('test one'), true)
})

test('modifyTestFile adds .only to matching test', () => {
  const content = `test('test one', () => {})
test('test two', () => {})`
  const modified = modifyTestFile(content, 'test two')
  assert.is(modified.includes('test.only('), true)
  assert.is(modified.includes('test two'), true)
})

test('createTempFile creates temporary file', () => {
  const testPath = path.join(__dirname, '../../fixtures/example.test.js')
  const tempPath = createTempFile('test content', testPath)
  assert.is(fs.existsSync(tempPath), true)
  fs.unlinkSync(tempPath)
})

test.run() 