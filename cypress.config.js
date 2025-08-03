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
          }

          const db = getFirestore();

          const timestamp = new Date();
          const isoTimestamp = timestamp.toISOString();

          // Update the top-level stock doc with latest price
          await db.collection('stocks').doc(symbol).set({
            symbol,
            latestPrice: price,
            lastUpdated: admin.firestore.Timestamp.fromDate(timestamp),
          }, { merge: true });

          // Add a new entry to the price history subcollection
          await db.collection('stocks')
            .doc(symbol)
            .collection('prices')
            .doc(isoTimestamp) // use timestamp as doc ID
            .set({
              price,
              timestamp: admin.firestore.Timestamp.fromDate(timestamp),
            });

          return null;
        }
      });
    },
  },
});
