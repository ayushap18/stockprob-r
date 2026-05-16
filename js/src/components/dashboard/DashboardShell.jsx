import DataFreshnessBanner from './DataFreshnessBanner.jsx';
import DashboardHeader from './DashboardHeader.jsx';
import MemoryStatusPanel from './MemoryStatusPanel.jsx';
import SummaryCards from './SummaryCards.jsx';
import SystemStatusPanel from './SystemStatusPanel.jsx';

export default function DashboardShell({ snapshot, meta = {}, children }) {
  return (
    <section className="connected-dashboard-shell">
      <DataFreshnessBanner warnings={meta.warnings} isDemo={meta.isDemo} stale={meta.stale} />
      <DashboardHeader snapshot={snapshot} meta={meta} />
      <SummaryCards probabilities={snapshot?.probabilities} />
      {children}
      <section className="analytics-grid halves">
        <SystemStatusPanel systemHealth={snapshot?.systemHealth} providerHealth={snapshot?.providerHealth} memoryHealth={snapshot?.memoryHealth} />
        <MemoryStatusPanel memoryHealth={snapshot?.memoryHealth} />
      </section>
    </section>
  );
}
