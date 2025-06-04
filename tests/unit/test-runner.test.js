const { test } = require('uvu')
const assert = require('uvu/assert')
const path = require('path')
const fs = require('fs')
const { executeTest } = require('../../src/utils/test-runner')

test('executeTest runs test file', async () => {
  const testFile = path.join(__dirname, '../../fixtures/example.test.js')
  const exitCode = await executeTest(testFile)
  assert.is(exitCode, 0)
})

test('executeTest handles non-existent file', async () => {
  try {
    await executeTest('nonexistent.test.js')
    assert.unreachable('Should have thrown error')
  } catch (error) {
    assert.is(error.code, 'ENOENT')
  }
})

test.run() 