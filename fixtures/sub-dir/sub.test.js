const { test } = require('uvu')
const assert = require('uvu/assert')

test('sub-dir', () => {
  assert.is(2 + 2, 4)
})

// Basic value comparison tests
test('sandwich', () => {
  assert.is(2 + 2, 4)
})

test('mmm tasty', () => {
  assert.is('hello' + ' world', 'hello world')
})

test.run()
