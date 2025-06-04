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

    const response = await prompts({
      type: 'autocomplete',
      name: 'item',
      message: 'Pick a file',
      choices: files,
      suggest: (input, choices) => choices.filter(i => i.title.toLowerCase().includes(input.toLowerCase()))
    })

    if (!response || !response.item) {
      console.log('Selection cancelled')
      process.exit(0)
    }
    
    console.log('response', response)
    console.log('Selected file:', path.relative(process.cwd(), response.item))
  } catch (error) {
    console.error('Error:', error)
  }
}

runPrompt() 