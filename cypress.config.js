const { defineConfig } = require('cypress');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

let db; // keep reference for reuse


module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on) {
      on('task', {
        async savePriceToFirebase(data) {
          const { symbol, price } = data;
          console.log('Symbol', symbol, 'price', price);
          if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
          }

          if (!admin.apps.length) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
            db = getFirestore();
          }

          await db.collection('stocks').doc(symbol).set({
            price,
            updatedAt: new Date().toISOString(),
          });

          return null;
        },
      });
    },
  },
});
