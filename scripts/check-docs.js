const fs = require('fs')
const path = require('path')

// Check if README.md exists
if (!fs.existsSync('README.md')) {
  console.error('Error: README.md not found')
  process.exit(1)
}

// Check if README.md has required sections
const readme = fs.readFileSync('README.md', 'utf8')
const requiredSections = [
  '## Installation',
  '## Usage',
  '## Configuration',
  '## Development'
]

const missingSections = requiredSections.filter(section => !readme.includes(section))
if (missingSections.length > 0) {
  console.error('Error: README.md missing required sections:', missingSections.join(', '))
  process.exit(1)
}

console.log('Documentation check passed')
process.exit(0) 