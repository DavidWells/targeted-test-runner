const { test } = require('uvu')
const assert = require('uvu/assert')

test('sub folder', () => {
  assert.is(2 + 2, 4)
})

// Basic value comparison tests
test('sandwich two', () => {
  assert.is(2 + 2, 4)
})

test('mmm tasty two', () => {
  assert.is('hello' + ' world', 'hello world')
})

test.run()
