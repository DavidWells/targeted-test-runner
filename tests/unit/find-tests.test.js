const { test } = require('uvu')
const assert = require('uvu/assert')
const path = require('path')
const fs = require('fs')
const { findTestsInFiles, findTestsInFilesBasic } = require('../../src/utils/find-tests')

// Create test fixtures
const fixturesDir = path.join(__dirname, 'fixtures')
const createTestFile = (name, content) => {
  const filePath = path.join(fixturesDir, name)
  fs.mkdirSync(fixturesDir, { recursive: true })
  fs.writeFileSync(filePath, content)
  return filePath
}

test.before(() => {
  // Create test fixtures
  createTestFile('commonjs.test.js', `
const { test } = require('uvu')
const assert = require('uvu/assert')

test('commonjs test', () => {
  assert.equal(true, true)
})

test.run()
`)

  createTestFile('esm.test.js', `
import { test } from 'uvu'
import * as assert from 'uvu/assert'

test('esm test', () => {
  assert.equal(true, true)
})

test.run()
`)

  createTestFile('esm-with-comments.test.js', `
// Some comments
import { test } from 'uvu'
import * as assert from 'uvu/assert'

test('esm with comments test', () => {
  assert.equal(true, true)
})

test.run()
`)

  createTestFile('false-positive.test.js', `
const { test } = require('uvu')
const assert = require('uvu/assert')

test('false positive', () => {
  const str = \`
    import { foo } from 'bar'
    export const baz = 'qux'
  \`
  assert.equal(str.includes('import'), true)
})

test.run()
`)
})

test.after(() => {
  // Clean up test fixtures
  fs.rmSync(fixturesDir, { recursive: true, force: true })
})

test('findTestsInFiles - detects ESM correctly', async () => {
  const testFiles = [
    path.join(fixturesDir, 'commonjs.test.js'),
    path.join(fixturesDir, 'esm.test.js'),
    path.join(fixturesDir, 'esm-with-comments.test.js'),
    path.join(fixturesDir, 'false-positive.test.js')
  ]

  const results = await findTestsInFiles(testFiles)
  console.log('results', results)
  
  // Check ESM detection
  const esmResults = results.filter(r => r.isESM)
  const nonEsmResults = results.filter(r => !r.isESM)
  
  assert.is(esmResults.length, 2, 'should detect 2 ESM files')
  assert.is(nonEsmResults.length, 2, 'should detect 2 non-ESM files')
  
  // Check test detection
  assert.is(results.length, 4, 'should find all 4 tests')
  
  // Verify test descriptions
  const descriptions = results.map(r => r.description)
  assert.ok(descriptions.includes('commonjs test'), 'should find commonjs test')
  assert.ok(descriptions.includes('esm test'), 'should find esm test')
  assert.ok(descriptions.includes('esm with comments test'), 'should find esm with comments test')
  assert.ok(descriptions.includes('false positive'), 'should find false positive test')
})

test('findTestsInFilesBasic - detects ESM correctly', () => {
  const testFiles = [
    path.join(fixturesDir, 'commonjs.test.js'),
    path.join(fixturesDir, 'esm.test.js'),
    path.join(fixturesDir, 'esm-with-comments.test.js'),
    path.join(fixturesDir, 'false-positive.test.js')
  ]

  const results = findTestsInFilesBasic(testFiles)
  
  // Check ESM detection
  const esmResults = results.filter(r => r.isESM)
  const nonEsmResults = results.filter(r => !r.isESM)
  
  assert.is(esmResults.length, 2, 'should detect 2 ESM files')
  assert.is(nonEsmResults.length, 2, 'should detect 2 non-ESM files')
  
  // Check test detection
  assert.is(results.length, 4, 'should find all 4 tests')
  
  // Verify test descriptions
  const descriptions = results.map(r => r.description)
  assert.ok(descriptions.includes('commonjs test'), 'should find commonjs test')
  assert.ok(descriptions.includes('esm test'), 'should find esm test')
  assert.ok(descriptions.includes('esm with comments test'), 'should find esm with comments test')
  assert.ok(descriptions.includes('false positive'), 'should find false positive test')
})

test('findTestsInFiles - handles empty files', async () => {
  const emptyFile = createTestFile('empty.test.js', '')
  const results = await findTestsInFiles([emptyFile])
  assert.is(results.length, 0, 'should handle empty files')
})

test('findTestsInFilesBasic - handles empty files', () => {
  const emptyFile = createTestFile('empty.test.js', '')
  const results = findTestsInFilesBasic([emptyFile])
  assert.is(results.length, 0, 'should handle empty files')
})

test.run() 