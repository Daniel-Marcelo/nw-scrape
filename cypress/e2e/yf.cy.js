describe('Fetch AAPL stock price', () => {
  it('gets price and saves to Firebase', () => {
    cy.visit('https://finance.yahoo.com/quote/AAPL');

    cy.get('fin-streamer[data-symbol="AAPL"][data-field="regularMarketPrice"]', { timeout: 10000 })
      .invoke('text')
      .then((priceText) => {
        const price = parseFloat(priceText.replace(',', ''));
        cy.task('savePriceToFirebase', { symbol: 'AAPL', price });
      });
  });
});