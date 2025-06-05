const safeChalk = require('safe-chalk')

// If --json flag disable chalk colors
const DISABLE_COLORS = process.env.NO_COLORS
const chalk = safeChalk(DISABLE_COLORS)

module.exports = chalk