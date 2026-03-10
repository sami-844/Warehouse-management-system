/**
 * AlertsPanel — collapsible notification strip
 * Props: alerts { summary: {low_stock, out_of_stock, dead_stock, overdue, total},
 *                 alerts: [...] }
 *         expanded (bool), onToggle (fn)
 */
import React from 'react';

const AlertsPanel = ({ alerts = {}, expanded, onToggle }) => {
  const { summary = {}, alerts: alertList = [] } = alerts;
  if (!summary.total) return null;                          /* nothing to show */

  const criticalCount = (summary.out_of_stock || 0) + (summary.overdue || 0);

  return (
    <div className="alerts-panel">
      {/* header row — always visible */}
      <button className="alerts-header" onClick={onToggle} aria-expanded={expanded}>
        <div className="alerts-header-left">
          <span className="alerts-bell">!</span>
          <span className="alerts-title">Alerts</span>
          {criticalCount > 0        && <span className="alerts-badge critical">{criticalCount} Critical</span>}
          {summary.low_stock > 0    && <span className="alerts-badge warning">{summary.low_stock} Low Stock</span>}
          {summary.dead_stock > 0   && <span className="alerts-badge info">{summary.dead_stock} Dead Stock</span>}
        </div>
        <span className="alerts-toggle">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* expandable detail list */}
      {expanded && (
        <div className="alerts-list">
          {alertList.map((alert, i) => (
            <div key={i}
                 className={`alert-item ${alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info'}`}>
              <span className={`alert-type-badge ${alert.type}`}>
                {(alert.type || '').replace(/_/g, ' ')}
              </span>
              <span className="alert-message">{alert.message}</span>
              {alert.type === 'overdue' && alert.total_amount != null && (
                <span className="alert-amount">{Number(alert.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} OMR</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;