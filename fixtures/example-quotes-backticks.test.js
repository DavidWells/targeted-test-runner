const { test } = require('uvu')
const assert = require('uvu/assert')

function otherCode() {
  console.log('otherCode')
  return 1
}

function otherCodeTwo() {
  console.log('otherCodeTwo')
  return 2
}

test(`backticks one`, () => {
  assert.equal(otherCode(), 11)
})

test(`backticks two`, () => {
  assert.equal(otherCodeTwo(), 2)
})

test.run()