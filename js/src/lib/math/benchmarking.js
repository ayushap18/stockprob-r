export function benchmarkLabel(benchmark = 'SPY') {
  const labels = {
    SPY: 'S&P 500',
    QQQ: 'Nasdaq 100',
    DIA: 'Dow 30',
    IWM: 'Russell 2000',
    XLK: 'Technology',
    XLF: 'Financials',
    XLE: 'Energy',
    XLV: 'Healthcare',
  };
  return labels[benchmark] || benchmark;
}

export function excessReturnSeries(rows = []) {
  return rows.map((row) => ({
    date: row.date,
    excessReturn: Number(row.stockReturn || 0) - Number(row.spyReturn || 0),
  }));
}
