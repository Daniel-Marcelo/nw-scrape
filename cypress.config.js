const { defineConfig } = require('cypress');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

let db; // keep reference for reuse


module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on) {
      config.env.SYMBOLS_BATCH = process.env.SYMBOLS_BATCH || '';
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

          const stockRef = db.collection('stocks').doc(symbol);
          const stockDoc = await stockRef.get();

          // Check latest price
          if (stockDoc.exists) {
            const latestPrice = stockDoc.data().latestPrice;
            if (latestPrice === price) {
              console.log(`Price unchanged for ${symbol} (${price}). Skipping write.`);
              return null;  // Skip writing if no change
            }
          }

          // Price changed or new stock, proceed to write
          await stockRef.set({
            symbol,
            latestPrice: price,
            lastUpdated: admin.firestore.Timestamp.fromDate(timestamp),
          }, { merge: true });

          await stockRef.collection('prices').doc(isoTimestamp).set({
            price,
            timestamp: admin.firestore.Timestamp.fromDate(timestamp),
          });

          console.log(`Price updated for ${symbol}: ${price}`);
          return null;
        }

      });

      return config;
    },
  },
});
