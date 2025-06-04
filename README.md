# Targeted Test Runner (tt)

A CLI tool for running specific tests by description without manually modifying test files.

## Installation

```bash
npm install -g targeted-test-runner
```

## Usage

Run a specific test by its description:

```bash
tt 'test description'
```

The tool will:
1. Find all test files in the current directory
2. Fuzzy match the test description
3. Create a temporary file with `.only` added to the matched test
4. Run the test
5. Clean up the temporary file

### Example

Given a test file:

```js
const { test } = require('uvu')
const assert = require('uvu/assert')

test('test one', () => {
  assert.equal(1, 1)
})

test('test two', () => {
  assert.equal(2, 2)
})

test.run()
```

Run a specific test:

```bash
tt 'test two'
```

## Configuration

### Debug Logging

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=tt:* tt 'test description'
```

Available debug namespaces:
- `tt:cli`: CLI operations
- `tt:processor`: Test file processing
- `tt:runner`: Test execution

## Development

### Setup

```bash
npm install
```

### Running Tests

```bash
npm test
```

### Project Structure

```
.
├── src/
│   ├── index.js           # CLI entry point
│   └── utils/
│       ├── logger.js      # Logging configuration
│       ├── test-processor.js  # Test file processing
│       ├── test-runner.js # Test execution
│       └── cleanup.js     # Temporary file cleanup
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
└── fixtures/             # Test fixtures
```

## License

ISC
