const prompts = require('prompts')
const path = require('path')
const fs = require('fs')

async function runPrompt() {
  try {
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
          files.push({
            title: relativePath,
            value: fullPath
          })
        }
      }
    }
    traverse(process.cwd())

    // Example of multiple choice selection with autocomplete
    const response = await prompts({
      type: 'autocompleteMultiselect',
      name: 'items',
      message: 'Pick multiple files',
      choices: files,
      hint: '- Space to select. Return to submit',
      instructions: false,
      validate: value => value.length === 0 ? `Please select at least one item` : true,
      suggest: (input, choices) => choices.filter(i => 
        i.title.toLowerCase().includes(input.toLowerCase())
      )
    })

    if (!response || !response.items) {
      console.log('Selection cancelled')
      process.exit(0)
    }

    console.log('Selected files:', response.items.map(file => path.relative(process.cwd(), file)))
  } catch (error) {
    console.error('Error:', error)
  }
}

runPrompt() 