export const CHART_RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '2Y', '5Y', 'MAX'];

const RANGE_DAYS = {
  '1D': 1,
  '5D': 5,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 366,
  '2Y': 366 * 2,
  '5Y': 366 * 5,
};

export function filterByRange(rows = [], range = '1Y', dateKey = 'date') {
  const sorted = sortByDate(rows, dateKey);
  if (!sorted.length || range === 'MAX') return sorted;
  const lastDate = parseChartDate(sorted.at(-1)?.[dateKey] || sorted.at(-1)?.time);
  if (!lastDate) return sorted;
  let start;
  if (range === 'YTD') {
    start = new Date(Date.UTC(lastDate.getUTCFullYear(), 0, 1));
  } else {
    const days = RANGE_DAYS[range] || RANGE_DAYS['1Y'];
    start = new Date(lastDate);
    start.setUTCDate(start.getUTCDate() - days);
  }
  const filtered = sorted.filter((row) => {
    const date = parseChartDate(row?.[dateKey] || row?.time);
    return date && date >= start && date <= lastDate;
  });
  return filtered.length ? filtered : sorted.slice(-Math.min(sorted.length, RANGE_DAYS[range] || 120));
}

export function sortByDate(rows = [], dateKey = 'date') {
  return [...(Array.isArray(rows) ? rows : [])]
    .filter(Boolean)
    .sort((first, second) => {
      const a = parseChartDate(first?.[dateKey] || first?.time)?.getTime() || 0;
      const b = parseChartDate(second?.[dateKey] || second?.time)?.getTime() || 0;
      return a - b;
    });
}

export function parseChartDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'number') {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function dateKey(row) {
  return row?.date || row?.time || row?.publishedAt || row?.asOf || '';
}
