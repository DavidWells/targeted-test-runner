const { test } = require('uvu')
const assert = require('uvu/assert')

test('two', () => {
  assert.is(2 + 2, 4)
})

// Basic value comparison tests
test('should correctly add two numbers', () => {
  assert.is(2 + 2, 4)
})

test('should handle string concatenation', () => {
  assert.is('hello' + ' world', 'hello world')
})

// Array operation tests
test('should find the largest number in an array', () => {
  const numbers = [1, 5, 3, 9, 2]
  assert.is(Math.max(...numbers), 9)
})

test('should filter out even numbers from array', () => {
  const numbers = [1, 2, 3, 4, 5, 6]
  const oddNumbers = numbers.filter(n => n % 2 !== 0)
  assert.equal(oddNumbers, [1, 3, 5])
})

// Object property tests
test('should merge two objects correctly', () => {
  const obj1 = { a: 1, b: 2 }
  const obj2 = { c: 3, d: 4 }
  assert.equal({ ...obj1, ...obj2 }, { a: 1, b: 2, c: 3, d: 4 })
})

test('should check if object has required properties', () => {
  const user = { name: 'John', age: 30, email: 'john@example.com' }
  assert.ok('name' in user && 'age' in user)
})

// String manipulation tests
test('should convert string to uppercase', () => {
  assert.is('hello'.toUpperCase(), 'HELLO')
})

test('should count words in a sentence', () => {
  const sentence = 'The quick brown fox jumps'
  assert.is(sentence.split(' ').length, 5)
})

// Date handling tests
test('should create a valid date object', () => {
  const date = new Date('2024-01-01')
  assert.ok(date instanceof Date)
  assert.is(date.getFullYear(), 2024)
})

test('should calculate days between dates', () => {
  const date1 = new Date('2024-01-01')
  const date2 = new Date('2024-01-10')
  const diffTime = Math.abs(date2 - date1)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  assert.is(diffDays, 9)
})

test.run()
