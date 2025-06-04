# Targeted Test Runner (tt)

A CLI tool for running specific tests by description without manually modifying test files.

## Problem

When working with test files (e.g., using uvu), running specific tests requires manually adding `.only` to test declarations:

```js
// Before
test('test two', () => {
  // test code
})

// After manual modification
test.only('test two', () => {
  // test code
})
```

This process is tedious and error-prone, especially when:
- Adding/removing `.only` manually
- Forgetting to remove `.only` before committing
- Needing to run multiple specific tests

## Solution

Create a CLI tool (`tt`) that:
1. Takes a test description as input
2. Creates a temporary copy of the test file
3. Fuzzy matches the test description
4. Adds `.only` to the matched test
5. Runs the modified test file
6. Cleans up temporary files

### Usage Example

```bash
tt 'two'
```

This would:
1. Find test files in the project
2. Match tests containing "two" in their description
3. Create a temporary copy with `.only` added
4. Run the test
5. Clean up after completion

### Technical Requirements

- Node.js based CLI
- File system operations for copying/modifying test files
- Fuzzy matching for test descriptions
- Test runner integration (uvu)
- Temporary file management
- Clean error handling

### Future Enhancements

- Support for multiple test matches
- Custom test runner configuration
- Watch mode for continuous testing
- Test file discovery patterns
- Test result formatting 
