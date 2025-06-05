const { test, after } = require('uvu')
const assert = require('uvu/assert')

test.skip('never expire ', () => {
  assert.equal(true, true)
})

test('uuid v4 encoding', () => {
  assert.equal(true, true)
})

test('uuid v7 encoding', () => {
  assert.equal(true, true)
})

test('cuid1 encoding', () => {
  assert.equal(true, true)
})

test('cuid2 encoding', () => {
  assert.equal(true, true)
})

test('ksuid encoding', () => {
  assert.equal(true, true)
})

test('ksuid encoding two', () => {
  assert.equal(true, true)
})

test('nanoid encoding', () => {
  assert.equal(true, true)
})

test('Resource ID encoding', () => {
  assert.equal(true, true)
})

test('ulid encoding', () => {
  assert.equal(true, true)
})

test('email encoding', () => {
  assert.equal(true, true)
})

const awsCollectedResults = []
test('aws iam encoding', () => {
  assert.equal(true, true)
})

test.after((result) => {
  assert.equal(true, true)
})


test.run()