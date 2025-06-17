const { test } = require('uvu')
const assert = require('uvu/assert')

test('passing test', () => {
  assert.is(1 + 1, 2)
})

test.skip('skipped test 1', () => {
  assert.is(1 + 1, 3) // This would fail but it's skipped
})

test.skip('skipped test 2', () => {
  assert.is(2 + 2, 5) // This would fail but it's skipped
})

test.skip('skipped test 3', () => {
  assert.is(3 + 3, 7) // This would fail but it's skipped
})

test.run()