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

test('CLI detects and reports skipped tests', () => {
  try {
    const cmd = 'node src/index.js test-skipped.test.js'
    const output = execSync(cmd, { encoding: 'utf8' })
    
    // Should detect 3 skipped tests
    assert.is(output.includes('Files with skipped tests (3)'), true, 'should show skipped test count')
    
    // Should mention the specific file with skipped tests
    assert.is(output.includes('test-skipped.test.js (3 skipped)'), true, 'should show file with skipped count')
  } catch (error) {
    // Command might exit with non-zero if there are only skipped tests, that's OK
    if (error.stdout) {
      // Check stdout for the expected skipped test output
      assert.is(error.stdout.includes('Files with skipped tests (3)'), true, 'should show skipped test count in stdout')
      assert.is(error.stdout.includes('test-skipped.test.js (3 skipped)'), true, 'should show file with skipped count in stdout')
    } else {
      throw error
    }
  }
})

test.run() 