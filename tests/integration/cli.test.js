const { test } = require('uvu')
const assert = require('uvu/assert')
const { execSync } = require('child_process')
const path = require('path')

test('CLI finds and matches test', () => {
  const cmd = 'DEBUG=tt:* node src/index.js "test two"'
  console.log('cmd', cmd)
  const output = execSync(cmd, { encoding: 'utf8' })
  console.log('CMD output')
  console.log(output)
  assert.is(output.includes('Starting test "test two"'), true, 'should match test two')
})

test('CLI handles no matches gracefully', () => {
  try {
    execSync('DEBUG=tt:* node src/index.js "nonexistent test"', { encoding: 'utf8' })
    assert.unreachable('Should have thrown error')
  } catch (error) {
    // .log('error', error)
    assert.is(error.status, 1, 'should exit with status 1')
    assert.is(error.stderr.includes('No tests found matching'), true, 'should show no matching tests found')
  }
})

test('CLI shows skipped tests in output', () => {
  const cmd = 'node src/index.js "./fixtures/test-skipped.test.js"'
  console.log('cmd', cmd)
  const output = execSync(cmd, { encoding: 'utf8' })
  console.log('CMD output for skipped tests')
  console.log(output)
  
  // Verify that skipped tests section appears
  assert.is(output.includes('Files with skipped tests'), true, 'should show Files with skipped tests header')
  
  // Verify the file path and skipped count appear
  assert.is(output.includes('./fixtures/test-skipped.test.js'), true, 'should show the test file path')
  assert.is(output.includes('3 skipped'), true, 'should show correct skipped test count')
})

test.run() 