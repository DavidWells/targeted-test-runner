const inquirer = require('inquirer')
const path = require('path')
const fs = require('fs')

// Register the autocomplete prompt
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))

async function runPrompt() {
  try {
    const { selection } = await inquirer.prompt({
      type: 'autocomplete',
      name: 'selection',
      message: 'Select a file:',
      suggest: (input, choices) => 
        choices.filter(i => i.name.toLowerCase().includes(input.toLowerCase())),
      source: (answersSoFar, input) => {
        const files = []
        function traverse(dir) {
          const entries = fs.readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              if (!entry.name.startsWith('.') && 
                  entry.name !== 'node_modules' && 
                  entry.name !== '.git') {
                traverse(fullPath)
              }
            } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
              const relativePath = path.relative(process.cwd(), fullPath)
              if (!input || relativePath.toLowerCase().includes(input.toLowerCase())) {
                files.push({
                  name: relativePath,
                  value: fullPath
                })
              }
            }
          }
        }
        traverse(process.cwd())
        return Promise.resolve(files)
      }
    })
    console.log('selection', selection)
    console.log('Selected file:', path.relative(process.cwd(), selection))
  } catch (error) {
    console.error('Error:', error)
  }
}

runPrompt() 