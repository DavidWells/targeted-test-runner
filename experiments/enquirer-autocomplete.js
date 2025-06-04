const { AutoComplete } = require('enquirer')

const prompt = new AutoComplete({
  name: 'flavor',
  message: 'Pick your favorite flavor',
  limit: 10,
  initial: 2,
  choices: [
    'apple',
    'banana',
    'cherry',
    'chocolate',
    'coconut',
    'grape',
    'lemon',
    'lime',
    'orange',
    'peach',
    'pear',
    'pineapple',
    'strawberry',
    'vanilla',
    'watermelon'
  ]
})

prompt
  .run()
  .then(answer => {
    console.log('Selected flavor:', answer)
  })
  .catch(console.error)
