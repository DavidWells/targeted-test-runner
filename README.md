# Targeted Test Runner (tt)

A CLI tool for running specific tests by description without manually modifying test files.

## Installation

```bash
npm install -g targeted-test-runner
```

## Usage

### Basic Usage

Run all test files in the current directory:

```bash
tt
```

Run a specific test by its description:

```bash
tt 'test description'
```

The tool will:
1. Find all test files in the current directory
2. Fuzzy match the test description (if provided)
3. Create a temporary file with `.only` added to the matched test (if description provided)
4. Run the test(s)
5. Clean up any temporary files

### Advanced Usage

#### Run Tests from a Specific File

Run tests from a specific file by providing the file path first:

```bash
tt ./path/to/test.js 'test description'
```

#### Run All Matching Tests

Use the `-a` or `--all` flag to run all matching tests instead of just the best match:

```bash
# Run all tests matching the description
tt -a 'test description'

# Run all tests from a specific file matching the description
tt ./path/to/test.js -a 'test description'
```

#### Examples

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

Run specific tests:

```bash
# Run all test files in the directory
tt

# Run the best matching test
tt 'test two'

# Run all tests containing 'test'
tt 'test' -a
tt 'test' --all

# Run tests from a specific file
tt ./path/to/test.js 'test two'

# Run all matching tests from a specific file
tt ./path/to/test.js 'test' -a 
tt ./path/to/test.js 'test' --all
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
