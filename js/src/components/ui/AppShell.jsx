import React from 'react';

const navItems = [
  ['⌘', 'Dashboard', '/dashboard'],
  ['◎', 'Rankings', '/rankings'],
  ['▤', 'Backtest', '/backtest'],
  ['☷', 'Data Health', '/data-health'],
  ['☆', 'Analytics', '/analytics'],
];

export default function AppShell({ active = 'Dashboard', children, rightSlot }) {
  return (
    <main className="investment-shell">
      <header className="investment-topbar">
        <a className="investment-brand" href="/dashboard">
          <span className="investment-brand-mark">Σ</span>
          <span>
            <strong>StockProb-R</strong>
            <small>Quant investment terminal</small>
          </span>
        </a>
        <nav className="investment-nav" aria-label="Primary">
          {navItems.map(([icon, label, href]) => (
            <a key={label} className={active === label ? 'active' : ''} href={href}><span>{icon}</span>{label}</a>
          ))}
        </nav>
        <div className="investment-actions">
          <a className="source-badge" href="https://github.com/ayushap18/stockprob-r" target="_blank" rel="noreferrer">GitHub</a>
          <span className="status-badge live">API</span>
          {rightSlot}
          <span className="top-icon">⌁</span>
          <span className="top-icon">⚙</span>
          <span className="top-icon">⛶</span>
        </div>
      </header>
      <section className="investment-page">{children}</section>
    </main>
  );
}
