import React from 'react';

export const PRICE_INDICATORS = [
  { key: 'sma20', label: 'SMA 20' },
  { key: 'sma50', label: 'SMA 50' },
  { key: 'sma200', label: 'SMA 200' },
  { key: 'ema20', label: 'EMA 20' },
  { key: 'ema50', label: 'EMA 50' },
  { key: 'bollinger', label: 'BB' },
  { key: 'volume', label: 'Volume' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'atr', label: 'ATR' },
  { key: 'volatility', label: 'Vol' },
  { key: 'beta', label: 'Beta' },
  { key: 'relativeStrength', label: 'RS' },
];

export default function IndicatorControls({ value = {}, onChange, indicators = PRICE_INDICATORS }) {
  function toggle(key) {
    onChange?.({ ...value, [key]: !value[key] });
  }
  return (
    <div className="indicator-controls" onClick={(event) => event.stopPropagation()}>
      {indicators.map((indicator) => (
        <button key={indicator.key} type="button" className={value[indicator.key] ? 'active' : ''} onClick={() => toggle(indicator.key)}>
          {indicator.label}
        </button>
      ))}
    </div>
  );
}
