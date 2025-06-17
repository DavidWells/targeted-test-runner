const { test } = require('uvu')
const assert = require('uvu/assert')
const path = require('path')
const fs = require('fs')
const { executeTest } = require('../../src/utils/test-runner')

test('executeTest runs test file', async () => {
  const testFile = path.join(__dirname, '../../fixtures/example-quotes-single.test.js')
  const result = await executeTest(testFile)
  // console.log('result', result)
  assert.equal(result.exitCode, 0)
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