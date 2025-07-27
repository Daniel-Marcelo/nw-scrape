const { defineConfig } = require('cypress');

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
