# Targeted Test Runner (tt) - Product Requirements Document

## 1. Core Functionality & Purpose

The primary problem this product solves is the tedious and error-prone process of manually modifying test files to run specific tests. Currently, developers must manually add and remove `.only` modifiers to test declarations, which is time-consuming and can lead to accidental commits of modified test files.

The core functionality is a CLI tool that automates the process of running specific tests by their description, eliminating the need for manual file modifications.

## 2. Key Goals & Scope

Critical Objectives:
- Reduce developer friction when running specific tests
- Eliminate the risk of committing test files with `.only` modifiers
- Provide a simple, intuitive interface for test selection
- Support fuzzy matching of test descriptions
- Ensure clean test execution environment

Out of Scope:
- Test result visualization or reporting
- Test file creation or modification
- Test runner configuration management
- Integration with CI/CD pipelines
- Support for multiple test runners beyond uvu

## 3. User Interaction & Design Insights

Primary User Type:
- Developers working with uvu test files
- Command-line interface users

User Interaction:
- Simple command-line interface: `tt 'test description'`
- Fuzzy matching of test descriptions
- Automatic test execution
- No manual file modifications required

## 4. Essential Features & Implementation Highlights

Must-have Functionalities:
1. Test File Processing
   - File discovery in project
   - Temporary file creation
   - Test description matching
   - `.only` modifier injection

2. Test Execution
   - Integration with uvu test runner
   - Clean execution environment
   - Proper error handling

3. File Management
   - Temporary file creation
   - Automatic cleanup
   - Original file preservation

## 5. Acceptance Criteria & Definition of "Done"

1. Test Selection
   - Successfully matches test descriptions using fuzzy matching
   - Correctly identifies and modifies target test
   - Preserves all other tests in their original state

2. Test Execution
   - Successfully runs the modified test file
   - Maintains original test output format
   - Properly handles test failures and errors

3. File Management
   - Creates temporary files without modifying originals
   - Cleans up temporary files after execution
   - Handles file system errors gracefully

## 6. Key Requirements & Constraints

Technical Requirements:
- Node.js runtime
- File system access
- uvu test runner integration
- Fuzzy matching library

Non-functional Requirements:
- Performance: Test execution time should not be significantly impacted
- Reliability: Must not corrupt original test files
- Security: Safe file system operations
- Maintainability: Clean code structure for future enhancements

## 7. Success Metrics

User Success Metrics:
- Reduction in time spent modifying test files
- Elimination of accidental `.only` commits
- Developer satisfaction with test execution workflow

Technical Success Metrics:
- Successful test execution rate
- File system operation reliability
- Error handling effectiveness

## 8. Development Logistics & Lookahead

Technical Risks:
- File system race conditions during temporary file operations
- Test runner integration complexity
- Fuzzy matching accuracy

Assumptions:
- Test files follow standard uvu structure
- File system permissions are sufficient
- Node.js environment is available

Future Considerations:
- Support for multiple test runners
- Watch mode implementation
- Enhanced test discovery patterns
- Test result formatting options
- Multiple test selection support 