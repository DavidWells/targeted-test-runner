const { test } = require('uvu')
const assert = require('uvu/assert')
const path = require('path')
const fs = require('fs')
const { cleanupTempFile } = require('../../src/utils/cleanup')

test('cleanupTempFile removes temporary file', () => {
  const tempFile = path.join(__dirname, '../../fixtures/temp.test.js')
  fs.writeFileSync(tempFile, 'test content')
  
  cleanupTempFile(tempFile)
  assert.is(fs.existsSync(tempFile), false)
})

test('cleanupTempFile handles non-existent file', () => {
  const tempFile = 'nonexistent.test.js'
  cleanupTempFile(tempFile) // Should not throw
})

test.run() 