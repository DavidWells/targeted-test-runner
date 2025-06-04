const { test } = require('uvu')
const assert = require('uvu/assert')
const { execSync } = require('child_process')
const path = require('path')

test('CLI finds and matches test', () => {
  const output = execSync('DEBUG=tt:* node src/index.js "test two"', { encoding: 'utf8' })
  assert.is(output.includes('Matched test: "test two"'), true)
  assert.is(output.includes('Created temporary file'), true)
})

test('CLI handles no matches gracefully', () => {
  try {
    execSync('DEBUG=tt:* node src/index.js "nonexistent test"', { encoding: 'utf8' })
    assert.unreachable('Should have thrown error')
  } catch (error) {
    assert.is(error.status, 1)
    assert.is(error.stdout.includes('No matching tests found'), true)
  }
})

test.run() 