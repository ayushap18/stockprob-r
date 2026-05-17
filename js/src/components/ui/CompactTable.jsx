import React from 'react';

export default function CompactTable({ columns = [], rows = [], renderCell }) {
  return (
    <div className="compact-table-wrap">
      <table className="compact-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key || column}>{column.label || column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.symbol || row.ticker || rowIndex}>
              {columns.map((column) => (
                <td key={column.key || column}>{renderCell ? renderCell(row, column, rowIndex) : row[column.key || column]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
