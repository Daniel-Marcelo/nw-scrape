const { defineConfig } = require('cypress');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

let db; // keep reference for reuse


module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      config.env.SYMBOLS_BATCH = process.env.SYMBOLS_BATCH || '';
      on('task', {
        async savePriceToFirebase(data) {
          const { symbol, price } = data;
          console.log(`[firebase] savePriceToFirebase called — symbol=${symbol} price=${price}`);

          if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
          }

          let serviceAccount;
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            console.log(`[firebase] credentials parsed — project_id=${serviceAccount.project_id} client_email=${serviceAccount.client_email}`);
          } catch (err) {
            throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
          }

          if (!admin.apps.length) {
            console.log('[firebase] initialising admin app...');
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('[firebase] admin app initialised');
          } else {
            console.log('[firebase] admin app already initialised, reusing');
          }

          const db = getFirestore();
          const timestamp = new Date();
          const isoTimestamp = timestamp.toISOString();

          console.log(`[firebase] fetching existing doc for ${symbol}...`);
          const stockRef = db.collection('stocks').doc(symbol);
          const stockDoc = await stockRef.get();
          console.log(`[firebase] doc exists=${stockDoc.exists}`);

          if (stockDoc.exists) {
            const latestPrice = stockDoc.data().latestPrice;
            console.log(`[firebase] stored latestPrice=${latestPrice}, incoming price=${price}`);
            if (latestPrice === price) {
              console.log(`[firebase] price unchanged for ${symbol} (${price}), skipping write`);
              return null;
            }
          }

          console.log(`[firebase] writing updated price for ${symbol}: ${price}`);
          await stockRef.set({
            symbol,
            latestPrice: price,
            lastUpdated: admin.firestore.Timestamp.fromDate(timestamp),
          }, { merge: true });
          console.log(`[firebase] stocks/${symbol} doc written`);

          await stockRef.collection('prices').doc(isoTimestamp).set({
            price,
            timestamp: admin.firestore.Timestamp.fromDate(timestamp),
          });
          console.log(`[firebase] stocks/${symbol}/prices/${isoTimestamp} written`);

          console.log(`[firebase] done — price updated for ${symbol}: ${price}`);
          return null;
        }

      });

      return config;
    },
  },
});
