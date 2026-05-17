import React from 'react';

export default function SegmentedControl({ value, options = [], onChange, label, className = '' }) {
  return (
    <div className={className}>
      {label && <span className="section-kicker">{label}</span>}
      <div className="segmented-control">
        {options.map((option) => {
          const item = typeof option === 'object' ? option : { label: option, value: option };
          return <button key={item.value} type="button" className={String(value) === String(item.value) ? 'active' : ''} onClick={() => onChange(item.value)}>{item.label}</button>;
        })}
      </div>
    </div>
  );
}
