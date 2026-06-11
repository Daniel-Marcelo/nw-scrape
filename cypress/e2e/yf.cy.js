
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

      // Target js-symbol-last itself (not a child span) so textContent gives the full price
      // even when TradingView splits digits across multiple child spans.
      const priceSelectors = [
        'span.js-symbol-last',
        '[class*="js-symbol-last"]',
      ];

      function waitForAnyPrice(selectors, maxAttempts = 20) {
        let attempts = 0;
        const check = () => {
          return cy.document().then((doc) => {
            // Log all js-symbol-last elements every attempt so we can see what's on the page
            const allMatches = doc.querySelectorAll('[class*="js-symbol-last"]');
            cy.log(`[selector] js-symbol-last elements found: ${allMatches.length}`);
            allMatches.forEach((m, i) => {
              cy.log(`[selector]   [${i}] <${m.tagName.toLowerCase()} class="${m.className}"> text="${m.textContent?.trim()}"`);
            });

            let el = null;
            let matchedSelector = null;
            for (const sel of selectors) {
              const found = doc.querySelector(sel);
              const text = found?.textContent?.trim();
              if (found && text && !isNaN(parseFloat(text.replace(/,/g, '')))) {
                el = found;
                matchedSelector = sel;
                break;
              }
            }

            const text = el?.textContent?.trim();
            if (el && text) {
              cy.log(`[selector] matched "${matchedSelector}" → text="${text}"`);
              return cy.wrap({ el, matchedSelector });
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

      waitForAnyPrice(priceSelectors).then(({ el, matchedSelector }) => {
        const text = el.textContent.trim();
        if (!text) cy.log('text value is falsy');
        const price = parseFloat(text.replace(/,/g, ''));
        cy.log(`[price] ticker=${ticker} selector="${matchedSelector}" rawText="${text}" parsed=${price}`);

        // Scrape company name — try known stable selectors then fall back to <h1>
        const titleSelectors = [
          '[class*="js-symbol-description"]',
          '[class*="symbolName"]',
          '[class*="title-qWnJ9M1C"]',
          'h1',
        ];
        return cy.document().then((doc) => {
          let title = null;
          for (const sel of titleSelectors) {
            const el = doc.querySelector(sel);
            const t = el?.textContent?.trim();
            if (t) { title = t; cy.log(`[title] matched "${sel}" → "${t}"`); break; }
          }
          if (!title) cy.log('[title] no title found, saving price only');
          cy.task('savePriceToFirebase', { symbol: ticker, price, title });
        });
      });
    });
  });
});
