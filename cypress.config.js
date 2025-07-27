const { defineConfig } = require('cypress');
const { savePriceToFirestore } = require('./firebaseService');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on) {
      on('task', {
        savePriceToFirebase(data) {
          console.log("DATA PRINT", data);
          return true;
        },
      });
    },
  },
});
