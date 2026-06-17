const admin = require('firebase-admin');

// Tickers that trade on the London Stock Exchange need the .L suffix for Yahoo Finance
const LSE_TICKERS = new Set([
  "VHVG", "VFEG", "VWRP", "VWRL", "VUSA", "VEVE", "VFEM", "VUAG",
  "CSPX", "SWDA", "HMWO", "IGLT", "ISF",
]);

const TICKERS = [
  // Personal holdings
  "VHVG", "VFEG", "VWRP", "VWRL", "VUSA", "VEVE", "VFEM", "VUAG",
  "O", "VICI",
  // Additional personal holdings
  "ROKU", "CRCL", "ACHR", "PLTR", "COIN", "HOOD", "TWST", "TEM",
  "GTLB", "CRSP", "RBLX", "PYPL", "TER", "MSTR", "SHOP", "XYZ", "ABNB",
  // Popular growth/tech
  "NET", "DDOG", "SNOW", "PATH", "ZS", "CRWD", "MDB", "TTD", "HUBS",
  "SPOT", "DUOL", "APP", "RXRX", "ASAN", "BILL", "GLBE", "CELH",
  // UK/EU ETFs (LSE)
  "CSPX", "SWDA", "HMWO", "IGLT", "ISF",
  // Popular UK retail holdings
  "ARM", "RIVN", "LCID", "SOFI", "IONQ", "RGTI", "SOUN", "LUNR", "RKT",
  // Crypto-adjacent ETFs
  "IBIT", "FBTC", "ARKK", "ARKB",
  // Missing S&P 500
  "SRE", "TMUS", "WBA", "F", "GM", "INTC", "QCOM", "TFC", "COP",
  // Top 200 S&P 500 by market cap
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "BRK.B", "AVGO",
  "JPM", "LLY", "V", "UNH", "XOM", "MA", "COST", "HD", "PG", "NFLX",
  "JNJ", "CRM", "BAC", "ABBV", "WMT", "MRK", "CVX", "ORCL", "KO", "AMD",
  "ACN", "PEP", "LIN", "TMO", "MCD", "CSCO", "ABT", "GE", "IBM", "TXN",
  "NOW", "PM", "GS", "ISRG", "INTU", "BKNG", "CAT", "RTX", "SPGI", "DHR",
  "AMGN", "LOW", "T", "VRTX", "NEE", "PLD", "BLK", "BSX", "AXP", "UBER",
  "MS", "SYK", "ETN", "SCHW", "GILD", "CB", "ADI", "DE", "PGR", "PANW",
  "AMAT", "MU", "REGN", "ADP", "LRCX", "SO", "CI", "DUK", "TJX", "ZTS",
  "CME", "MMC", "CL", "EOG", "WFC", "BMY", "ITW", "MCO", "AON", "KLAC",
  "ICE", "NOC", "SLB", "CTAS", "GD", "USB", "PH", "EMR", "FCX", "CEG",
  "WM", "APH", "CDNS", "SNPS", "HCA", "TT", "MMM", "MSI", "ROP", "WELL",
  "MCK", "ECL", "COF", "ELV", "ORLY", "FDX", "PSA", "OKE", "CARR", "AJG",
  "PCAR", "TDG", "HLT", "ADSK", "AFL", "FICO", "VRSK", "SHW", "NKE", "IDXX",
  "FAST", "KMB", "ALL", "BDX", "PAYX", "PCG", "AEP", "DLR", "CCI", "EW",
  "CSGP", "MNST", "RSG", "PPG", "IQV", "MCHP", "PRU", "CPRT", "FANG", "PSX",
  "VLO", "XEL", "WEC", "IR", "OTIS", "GEHC", "MTD", "GLW", "DOW", "LHX",
  "HPQ", "DD", "WAB", "ODFL", "AME", "NXPI", "HPE", "KDP", "TROW", "GIS",
  "CTSH", "MPWR", "ON", "DVN", "EXC", "ROK", "EFX", "HAL", "NUE", "TSCO",
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

// Tickers whose Yahoo Finance symbol differs from the standard ticker
const YAHOO_SYMBOL_MAP = {
  "BRK.B": "BRK-B",
};

function yahooSymbol(ticker) {
  if (YAHOO_SYMBOL_MAP[ticker]) return YAHOO_SYMBOL_MAP[ticker];
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

  const meta = result.meta ?? {};
  const price = meta.regularMarketPrice ?? meta.previousClose ?? null;
  const longName = meta.longName ?? null;
  const shortName = meta.shortName ?? null;
  const currency = meta.currency ?? null;
  const marketState = meta.marketState ?? null;

  console.log(`[yahoo] ${ticker} — price=${price} currency=${currency} marketState=${marketState} longName="${longName}" shortName="${shortName}"`);
  console.log(`[yahoo] ${ticker} — raw meta keys: ${Object.keys(meta).join(', ')}`);

  const name = longName ?? shortName ?? null;
  return { price, name, currency, meta };
}

async function fetchAndSave(ticker) {
  try {
    const { price, name, currency, meta } = await fetchQuote(ticker);

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
    if (currency) docData.currency = currency;
    docData.meta = meta;

    console.log(`[firebase] ${ticker} — writing stocks/${ticker} with price=${price}${name ? ` name="${name}"` : ''}${currency ? ` currency=${currency}` : ''}`);
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
