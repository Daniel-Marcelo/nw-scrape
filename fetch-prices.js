const admin = require('firebase-admin');

// Tickers that trade on the London Stock Exchange need the .L suffix for Yahoo Finance
const LSE_TICKERS = new Set([
  "VHVG", "VFEG", "VWRP", "VWRL", "VUSA", "VEVE", "VFEM", "VUAG",
]);

const TICKERS = [
  "VHVG", "VFEG", "VWRP", "O", "VICI",
  "VWRL", "VUSA", "VEVE", "VFEM", "AMZN",
  "AAPL", "VUAG", "GOOGL", "MSFT", "TSLA", "GOOG",
];

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is required');
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
console.log(`[firebase] credentials parsed — project_id=${serviceAccount.project_id} client_email=${serviceAccount.client_email}`);

if (!admin.apps.length) {
  console.log('[firebase] initialising admin app...');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('[firebase] admin app initialised');
} else {
  console.log('[firebase] admin app already initialised, reusing');
}
const db = admin.firestore();

function yahooSymbol(ticker) {
  return LSE_TICKERS.has(ticker) ? `${ticker}.L` : ticker;
}

async function fetchQuote(ticker) {
  const symbol = yahooSymbol(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  console.log(`[yahoo] GET ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  console.log(`[yahoo] ${ticker} → HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const error = json?.chart?.error;
    throw new Error(`No result in response${error ? ` — ${JSON.stringify(error)}` : ''}`);
  }

  const price = result.meta?.regularMarketPrice ?? result.meta?.previousClose ?? null;
  const longName = result.meta?.longName ?? null;
  const shortName = result.meta?.shortName ?? null;
  const currency = result.meta?.currency ?? null;
  const marketState = result.meta?.marketState ?? null;

  console.log(`[yahoo] ${ticker} — price=${price} currency=${currency} marketState=${marketState} longName="${longName}" shortName="${shortName}"`);

  // longName is the full company name; shortName is often an abbreviated or ticker-like value
  const name = longName ?? shortName ?? null;
  return { price, name };
}

async function fetchAndSave(ticker) {
  try {
    const { price, name } = await fetchQuote(ticker);

    if (!price || price === 0) {
      console.log(`[firebase] ${ticker} — no price returned, skipping`);
      return;
    }

    const stockRef = db.collection('stocks').doc(ticker);
    console.log(`[firebase] ${ticker} — fetching existing doc...`);
    const stockDoc = await stockRef.get();
    console.log(`[firebase] ${ticker} — doc exists=${stockDoc.exists}`);

    if (stockDoc.exists) {
      const stored = stockDoc.data().latestPrice;
      console.log(`[firebase] ${ticker} — stored latestPrice=${stored}, incoming=${price}`);
      if (stored === price) {
        console.log(`[firebase] ${ticker} — price unchanged, skipping write`);
        return;
      }
    }

    const timestamp = new Date();
    const isoTimestamp = timestamp.toISOString();
    const docData = {
      symbol: ticker,
      latestPrice: price,
      lastUpdated: admin.firestore.Timestamp.fromDate(timestamp),
    };
    if (name) docData.name = name;

    console.log(`[firebase] ${ticker} — writing stocks/${ticker} with price=${price}${name ? ` name="${name}"` : ''}`);
    await stockRef.set(docData, { merge: true });
    console.log(`[firebase] ${ticker} — stocks/${ticker} written`);

    console.log(`[firebase] ${ticker} — writing stocks/${ticker}/prices/${isoTimestamp}`);
    await stockRef.collection('prices').doc(isoTimestamp).set({
      price,
      timestamp: admin.firestore.Timestamp.fromDate(timestamp),
    });
    console.log(`[firebase] ${ticker} — done`);
  } catch (err) {
    console.error(`[error] ${ticker} — ${err.message}`);
  }
}

async function main() {
  console.log(`[main] fetching ${TICKERS.length} tickers from Yahoo Finance...`);

  for (const ticker of TICKERS) {
    console.log(`\n[main] ── ${ticker} ──`);
    await fetchAndSave(ticker);
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\n[main] all tickers processed');
  process.exit(0);
}

main();
