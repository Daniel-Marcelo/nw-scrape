
describe('Fetch stock price from TradingView', () => {
const tickers = [
  "VHVG", "VFEG", "VWRP", "O", "VICI",
  "VWRL", "VUSA", "VEVE", "VFEM", "AMZN",
  "AAPL", "VUAG", "GOOGL", "MSFT", "TSLA", "GOOG",
];
  tickers.forEach(ticker => {

    it('gets price and saves to Firebase', () => {
      cy.visit('https://www.tradingview.com/symbols/' + ticker + '/', {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      });

      // TradingView uses hashed CSS module class names that change on every deploy.
      // Target the stable semantic js- classes instead.
      const priceSelectors = [
        'span.js-symbol-last > span',
        '[class*="js-symbol-last"] > span',
        'div.js-symbol-page-header-root [class*="last"] span',
      ];

      function waitForAnyPrice(selectors, maxAttempts = 20) {
        let attempts = 0;
        const check = () => {
          return cy.document().then((doc) => {
            let el = null;
            for (const sel of selectors) {
              el = doc.querySelector(sel);
              if (el && el.textContent?.trim()) break;
            }
            const text = el?.textContent?.trim();
            if (el && text && !isNaN(parseFloat(text.replace(/,/g, '')))) {
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

      waitForAnyPrice(priceSelectors).then(($el) => {
        const text = $el[0].textContent;
        if (!text) cy.log('text value is falsy', text)
        const price = parseFloat(text.replace(/,/g, ''));
        console.log('text', text);
        console.log('price', price)
        cy.log(`TradingView price: $${price}`);
        cy.task('savePriceToFirebase', { symbol: ticker, price });
      });
    });
  });
});
