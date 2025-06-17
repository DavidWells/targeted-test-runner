const { test } = require('uvu')
const assert = require('uvu/assert')

test('passing test', () => {
  assert.is(2 + 2, 4)
})

test.skip('skipped test one', () => {
  assert.is(1 + 1, 2)
})

test.skip('skipped test two', () => {
  assert.is(3 + 3, 6)
})

test.skip('skipped test three', () => {
  assert.is(4 + 4, 8)
})

test('another passing test', () => {
  assert.is(5 + 5, 10)
})

test.run()