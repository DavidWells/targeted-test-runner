const { test } = require('uvu')
const assert = require('uvu/assert')
const { findTestFiles, readTestFile, modifyTestFile, createTempFile } = require('../../src/utils/test-processor')

test('test processor functions exist', () => {
  assert.type(findTestFiles, 'function')
  assert.type(readTestFile, 'function')
  assert.type(modifyTestFile, 'function')
  assert.type(createTempFile, 'function')
})

test.run() 