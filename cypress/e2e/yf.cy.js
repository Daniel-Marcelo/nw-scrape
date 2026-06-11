
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
            let matchedSelector = null;
            for (const sel of selectors) {
              const found = doc.querySelector(sel);
              if (found && found.textContent?.trim()) {
                el = found;
                matchedSelector = sel;
                break;
              }
            }
            const text = el?.textContent?.trim();
            if (el && text && !isNaN(parseFloat(text.replace(/,/g, '')))) {
              console.log(`[selector] matched: "${matchedSelector}"`);
              console.log(`[selector] el.tagName=${el.tagName} el.className="${el.className}"`);
              console.log(`[selector] el.textContent="${el.textContent}"`);
              console.log(`[selector] el.innerHTML="${el.innerHTML}"`);
              console.log(`[selector] parent.className="${el.parentElement?.className}"`);
              console.log(`[selector] parent.innerHTML="${el.parentElement?.innerHTML}"`);
              // Log all js-symbol-last elements on the page for comparison
              const allMatches = doc.querySelectorAll('[class*="js-symbol-last"]');
              console.log(`[selector] total [class*="js-symbol-last"] elements on page: ${allMatches.length}`);
              allMatches.forEach((m, i) => {
                console.log(`[selector]   [${i}] tagName=${m.tagName} class="${m.className}" textContent="${m.textContent?.trim()}"`);
              });
              return cy.wrap({ el, matchedSelector });
            } else if (attempts++ < maxAttempts) {
              cy.log(`Waiting for valid price element... (${attempts})`);
              return Cypress.Promise.delay(2000).then(check);
            } else {
              // Log what selectors found (or didn't) for debugging
              selectors.forEach(sel => {
                const found = doc.querySelector(sel);
                console.log(`[selector:timeout] "${sel}" => ${found ? `found, text="${found.textContent?.trim()}"` : 'not found'}`);
              });
              throw new Error(`Could not get valid price text after ${maxAttempts} attempts`);
            }
          });
        };
        return check();
      }

      waitForAnyPrice(priceSelectors).then(({ el, matchedSelector }) => {
        const text = el.textContent;
        if (!text) cy.log('text value is falsy', text);
        const price = parseFloat(text.replace(/,/g, ''));
        console.log(`[price] ticker=${ticker} selector="${matchedSelector}" rawText="${text}" parsed=${price}`);
        cy.log(`TradingView price: $${price}`);
        cy.task('savePriceToFirebase', { symbol: ticker, price });
      });
    });
  });
});
