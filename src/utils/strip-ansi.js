const stripAnsiBase = require('strip-ansi')

/**
 * Strips both ANSI codes and terminal link sequences from a string
 * @param {string} str - The string to strip
 * @returns {string} The stripped string
 */
function stripAnsi(str) {
  // Debug the raw string
  /*
  console.log('Raw string:', JSON.stringify(str))
  /** */
  let result = str
  
  // Try a simpler pattern that just looks for the content between the sequences
  const simpleMatch = str.match(/\x1b\]8;;.*?\x1b\\(.*?)\x1b\]8;;\x1b\\/)
  // console.log('simpleMatch', simpleMatch)
  if (simpleMatch) {
    const linkWord = simpleMatch[1]
    // console.log('linkWord', linkWord)
    result = str.replace(simpleMatch[0], linkWord)
  }
  
  // Then strip ANSI codes
  result = stripAnsiBase(result)
  // console.log('result3', result)
  
  // Handle any remaining OSC sequences
  result = result.replace(/\x1b\]\d+;[^\x1b]*\x1b\\/g, '')
  
  // console.log('result', result)
  
  return result
}

module.exports = stripAnsi