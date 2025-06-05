const { test, after } = require('uvu')
const assert = require('uvu/assert')

function parse(str) {
  return { what: str }
}

test('false positive', () => {
  console.log('false positive')
  const one = `
  what="
import {foo} from 'lodash'
import {bar} from 'lodash'
import {zaz} from 'lodash'
"`
  assert.equal(one, one)
})

test('false positive two', () => {
  console.log('false positive two')
  const one = `
  what='
import {foo} from 'lodash'
import {bar} from 'lodash'
import {zaz} from 'lodash'
'`
  assert.equal(one, one)
})

test('false positive three', () => {
  console.log('false positive three')
  const one = `
  what=\`
import {foo} from 'lodash'
import {bar} from 'lodash'
import {zaz} from 'lodash'
\``
  assert.equal(one, one)
})

test.run()