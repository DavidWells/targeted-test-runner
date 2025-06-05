import { test } from 'uvu';
import * as assert from 'uvu/assert';

test('Big ESM test', () => {
	assert.equal(true, true)
})

test('Array operations', () => {
	const arr = [1, 2, 3]
	assert.equal(arr.length, 3)
})

test('String manipulation', () => {
	const str = 'hello'
	assert.equal(str.toUpperCase(), 'HELLO')
})

test('Object properties', () => {
	const obj = { name: 'test', value: 42 }
	assert.equal(obj.name, 'test')
})

test('Math calculations', () => {
	assert.equal(2 + 2, 4)
})

test('Async operation', async () => {
	const result = await Promise.resolve(42)
	assert.equal(result, 42)
})

test('Array filtering', () => {
	const numbers = [1, 2, 3, 4, 5]
	const even = numbers.filter(n => n % 2 === 0)
	assert.equal(even.length, 2)
})

test('String concatenation', () => {
	const a = 'hello'
	const b = 'world'
	assert.equal(a + ' ' + b, 'hello world')
})

test('Object destructuring', () => {
	const { x, y } = { x: 1, y: 2 }
	assert.equal(x + y, 3)
})

test('Array mapping', () => {
	const doubled = [1, 2, 3].map(n => n * 2)
	assert.equal(doubled[1], 4)
})

test('Type checking', () => {
	assert.is(typeof 'hello', 'string')
})

test.run()