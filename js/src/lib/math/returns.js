export function simpleReturn(current, previous) {
  return finite(current) && finite(previous) && Number(previous) !== 0 ? Number(current) / Number(previous) - 1 : null;
}

export function logReturn(current, previous) {
  const simple = simpleReturn(current, previous);
  return finite(simple) && simple > -1 ? Math.log1p(simple) : null;
}

export function cumulativeReturn(values = []) {
  const rows = values.filter(finite).map(Number);
  if (rows.length < 2 || rows[0] === 0) return 0;
  return rows.at(-1) / rows[0] - 1;
}

export function annualizedReturn(totalReturn, tradingDays = 252) {
  if (!finite(totalReturn) || !finite(tradingDays) || Number(tradingDays) <= 0) return null;
  return (1 + Number(totalReturn)) ** (252 / Number(tradingDays)) - 1;
}

export function excessReturnVsBenchmark(stockReturn, benchmarkReturn) {
  return finite(stockReturn) && finite(benchmarkReturn) ? Number(stockReturn) - Number(benchmarkReturn) : null;
}

export function returnSeries(rows = []) {
  return rows.slice(1).map((row, index) => simpleReturn(row.close, rows[index]?.close)).filter(finite);
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
