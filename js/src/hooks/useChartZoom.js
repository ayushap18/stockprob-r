import { useCallback, useState } from 'react';

export function useChartZoom() {
  const [zoomedChart, setZoomedChart] = useState(null);
  const openChart = useCallback((chart) => setZoomedChart(chart), []);
  const closeChart = useCallback(() => setZoomedChart(null), []);
  return { zoomedChart, openChart, closeChart };
}
