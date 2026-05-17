import React from 'react';
import { CHART_RANGES } from '../../lib/chartRanges.js';

export default function RangeSelector({ value = '1Y', onChange, ranges = CHART_RANGES }) {
  return (
    <div className="range-selector" onClick={(event) => event.stopPropagation()}>
      {ranges.map((range) => (
        <button key={range} type="button" className={range === value ? 'active' : ''} onClick={() => onChange?.(range)}>
          {range}
        </button>
      ))}
    </div>
  );
}
