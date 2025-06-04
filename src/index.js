#!/usr/bin/env node

const { program } = require('commander')
const logger = require('./utils/logger')

program
  .version('1.0.0')
  .description('Run targeted tests by description')
  .argument('<test-description>', 'Description of the test to run')
  .action((testDescription) => {
    logger.cli('Initializing CLI with version 1.0.0')
  })

program.parse() 