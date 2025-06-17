const { test } = require('uvu')
const assert = require('uvu/assert')

test('sub-dir', () => {
  assert.is(2 + 2, 4)
})

// Basic value comparison tests
test('sandwich', async () => {
  await new Promise(resolve => setTimeout(resolve, 2000))

  assert.is(2 + 2, 4)
})

test('mmm tasty', () => {
  assert.is('hello' + ' world', 'helxlo world')
})

test.run()