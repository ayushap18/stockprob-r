export default function TickerSearch({ value, onChange, onSubmit }) {
  return (
    <form className="analytics-search dashboard-search" onSubmit={onSubmit}>
      <input aria-label="Dashboard ticker" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <button type="submit">Load</button>
    </form>
  );
}
