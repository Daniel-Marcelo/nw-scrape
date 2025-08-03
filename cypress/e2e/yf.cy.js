
const symbolsBatch = (Cypress.env('SYMBOLS_BATCH') || '').split(',');

console.log('Tickers loaded', symbolsBatch);

describe('Fetch stock price from TradingView', () => {

  symbolsBatch.forEach(ticker => {
    console.log('Ticker ', ticker)

    it('gets price and saves to Firebase', () => {
      cy.visit('https://www.tradingview.com/symbols/' + ticker + '/', {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      });

      function waitForTradingViewPrice(selector, maxAttempts = 20) {
        let attempts = 0;
        const check = () => {
          return cy.document().then((doc) => {
            const el = doc.querySelector(selector);
            const text = el?.textContent?.trim();

            if (el && text) {
              return cy.wrap(el);
            } else if (attempts++ < maxAttempts) {
              cy.log(`Waiting for valid price element... (${attempts})`);
              return Cypress.Promise.delay(2000).then(check);
            } else {
              throw new Error(`Could not get valid price text after ${maxAttempts} attempts`);
            }
          });
        };
        return check();
      }

      const priceSelector = '#js-category-content > div.tv-react-category-header > div.js-symbol-page-header-root > div > div > div > div.quotesRow-iJMmXWiA > div:nth-child(1) > div > div.lastContainer-zoF9r75I > span.last-zoF9r75I.js-symbol-last > span';

      waitForTradingViewPrice(priceSelector).then(($el) => {
        const text = $el[0].textContent;
        if (!text) cy.log('text value is falsy', text)
        const price = parseFloat(text.replace(',', ''));
        console.log('text', text);
        console.log('price', price)
        cy.log(`TradingView price: $${price}`);
        cy.task('savePriceToFirebase', { symbol: ticker, price });
      });
    });
  });
});
