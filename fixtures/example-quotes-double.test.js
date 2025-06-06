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

test("double quotes one", () => {
  assert.equal(otherCode(), 1)
})

test("double quotes two", () => {
  assert.equal(otherCodeTwo(), 2)
})

test.run()