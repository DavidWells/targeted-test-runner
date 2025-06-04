const { test } = require('uvu')
const assert = require('uvu/assert')
const { execSync } = require('child_process')
const path = require('path')

test('CLI finds and matches test', () => {
  const output = execSync('DEBUG=tt:* node src/index.js "test two"', { encoding: 'utf8' })
  console.log(output)
  assert.is(output.includes('Testing "test two"'), true, 'should match test two')
})

test('CLI handles no matches gracefully', () => {
  try {
    execSync('DEBUG=tt:* node src/index.js "nonexistent test"', { encoding: 'utf8' })
    assert.unreachable('Should have thrown error')
  } catch (error) {
    assert.is(error.status, 1, 'should exit with status 1')
    assert.is(error.stdout.includes('No matching tests found'), true, 'should show no matching tests found')
  }
})

test.run() 