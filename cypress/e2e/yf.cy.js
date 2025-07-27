describe('Fetch AAPL stock price from TradingView', () => {
  it('gets price and saves to Firebase', () => {
    cy.visit('https://www.tradingview.com/symbols/NASDAQ-AAPL/', {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });

    // Retry-safe function to wait for the price element
    function waitForTradingViewPrice(selector, maxAttempts = 10) {
      let attempts = 0;
      const check = () => {
        return cy.document().then((doc) => {
          const el = doc.querySelector(selector);
          if (el) {
            return cy.wrap(el);
          } else if (attempts++ < maxAttempts) {
            cy.log(`Waiting for price element... (${attempts})`);
            return Cypress.Promise.delay(2000).then(check);
          } else {
            throw new Error(`Could not find price element after ${maxAttempts} attempts`);
          }
        });
      };
      return check();
    }

    const priceSelector = '#js-category-content > div.tv-react-category-header > div.js-symbol-page-header-root > div > div > div > div.quotesRow-iJMmXWiA > div:nth-child(1) > div > div.lastContainer-zoF9r75I > span.last-zoF9r75I.js-symbol-last > span';

    waitForTradingViewPrice(priceSelector).then(($el) => {
      const text = $el[0].textContent;
      const price = parseFloat(text.replace(',', ''));
      console.log('text', text);
      console.log('price', price)
      cy.log(`TradingView price: $${price}`);
      cy.task('savePriceToFirebase', { symbol: 'AAPL', price });
    });
  });
});
