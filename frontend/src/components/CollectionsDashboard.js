import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';

function CollectionsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collections/aging', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const d = await res.json();
      setData(d);
    } catch (err) {
      setMessage({ text: 'Failed to load collections data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = async (customerId) => {
    try {
      const res = await fetch(`/api/collections/whatsapp-message/${customerId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const d = await res.json();
      if (d.whatsapp_url) {
        window.open(d.whatsapp_url, '_blank');
      }
    } catch (err) {
      setMessage({ text: 'Failed to generate WhatsApp message', type: 'error' });
    }
  };

  const getBucketColor = (customer) => {
    if (customer.bucket_90_plus > 0) return '#DC3545';
    if (customer.bucket_61_90 > 0) return '#E65100';
    if (customer.bucket_31_60 > 0) return '#F57F17';
    return '#28A745';
  };

  const getWorstBucket = (customer) => {
    if (customer.bucket_90_plus > 0) return '90+ days';
    if (customer.bucket_61_90 > 0) return '61-90 days';
    if (customer.bucket_31_60 > 0) return '31-60 days';
    return 'Current';
  };

  const filteredCustomers = () => {
    if (!data) return [];
    const all = data.customers || [];
    switch (filter) {
      case '90plus': return all.filter(c => c.bucket_90_plus > 0);
      case '61_90': return all.filter(c => c.bucket_61_90 > 0 && c.bucket_90_plus === 0);
      case '31_60': return all.filter(c => c.bucket_31_60 > 0 && c.bucket_61_90 === 0 && c.bucket_90_plus === 0);
      default: return all;
    }
  };

  const summary = data?.summary || {};

  return (
    <div style={{ padding: '24px 32px' }}>
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><DollarSign size={20} /></div>
          <div>
            <h1>Collections & Aging</h1>
            <p>Track outstanding payments and send WhatsApp reminders</p>
          </div>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Total Receivables', value: summary.total_receivables, color: '#1A3A5C', bg: '#EEF2FF' },
              { label: '0-30 Days (Current)', value: summary.current_0_30, color: '#28A745', bg: '#F0FFF4' },
              { label: '31-60 Days (Overdue)', value: summary.overdue_31_60, color: '#F57F17', bg: '#FFFDE7' },
              { label: '61-90 Days (Late)', value: summary.late_61_90, color: '#E65100', bg: '#FFF3E0' },
              { label: '90+ Days (Very Late)', value: summary.very_late_90_plus, color: '#DC3545', bg: '#FFEBEE' },
            ].map(card => (
              <div key={card.label} style={{
                background: card.bg, borderRadius: 8,
                padding: '14px 16px', textAlign: 'center',
                border: `1px solid ${card.color}20`
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>
                  {(card.value || 0).toFixed(3)}
                </div>
                <div style={{ fontSize: 10, color: card.color, fontWeight: 600, marginTop: 4 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 10, color: '#6C757D', marginTop: 2 }}>OMR</div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { key: 'all', label: `All Customers (${summary.customer_count || 0})` },
              { key: '90plus', label: `Very Late 90+ (${data?.customers?.filter(c => c.bucket_90_plus > 0).length || 0})` },
              { key: '61_90', label: '61-90 Days' },
              { key: '31_60', label: '31-60 Days' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '6px 14px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #DEE2E6', cursor: 'pointer',
                  background: filter === tab.key ? '#1A3A5C' : 'white',
                  color: filter === tab.key ? 'white' : '#333',
                  fontWeight: filter === tab.key ? 600 : 400
                }}
              >
                {tab.label}
              </button>
            ))}
            <button onClick={loadData} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 6,
              border: '1px solid #DEE2E6', cursor: 'pointer',
              background: 'white', color: '#333', marginLeft: 'auto'
            }}>
              Refresh
            </button>
          </div>

          {/* Customer List */}
          {filteredCustomers().length === 0 ? (
            <EmptyState title="No outstanding balances" hint="All customers are up to date with payments" />
          ) : (
            <div>
              {filteredCustomers().map(customer => (
                <div key={customer.customer_id} style={{
                  background: 'white', border: '1px solid #DEE2E6',
                  borderRadius: 8, marginBottom: 8, overflow: 'hidden'
                }}>
                  {/* Customer row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '12px 16px', cursor: 'pointer',
                      borderLeft: `4px solid ${getBucketColor(customer)}`,
                      flexWrap: 'wrap'
                    }}
                    onClick={() => setExpandedCustomer(
                      expandedCustomer === customer.customer_id ? null : customer.customer_id
                    )}
                  >
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {customer.customer_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#6C757D' }}>
                        {customer.customer_area || '-'} -- {customer.invoice_count} invoice(s)
                      </div>
                    </div>

                    {/* Aging buckets */}
                    {[
                      { v: customer.bucket_0_30, label: '0-30d', color: '#28A745' },
                      { v: customer.bucket_31_60, label: '31-60d', color: '#F57F17' },
                      { v: customer.bucket_61_90, label: '61-90d', color: '#E65100' },
                      { v: customer.bucket_90_plus, label: '90+d', color: '#DC3545' },
                    ].map(b => b.v > 0 ? (
                      <div key={b.label} style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: b.color }}>
                          {b.v.toFixed(3)}
                        </div>
                        <div style={{ fontSize: 10, color: b.color }}>{b.label}</div>
                      </div>
                    ) : null)}

                    {/* Total */}
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: getBucketColor(customer) }}>
                        {customer.total_outstanding.toFixed(3)} OMR
                      </div>
                      <div style={{ fontSize: 11, color: getBucketColor(customer), fontWeight: 600 }}>
                        {getWorstBucket(customer)}
                      </div>
                    </div>

                    {/* WhatsApp button */}
                    <button
                      className="submit-btn"
                      style={{ fontSize: 12, whiteSpace: 'nowrap', padding: '6px 12px' }}
                      onClick={e => { e.stopPropagation(); sendWhatsApp(customer.customer_id); }}
                    >
                      WhatsApp
                    </button>

                    <span style={{ color: '#6C757D', fontSize: 12 }}>
                      {expandedCustomer === customer.customer_id ? 'v' : '>'}
                    </span>
                  </div>

                  {/* Expanded invoice list */}
                  {expandedCustomer === customer.customer_id && (
                    <div style={{ borderTop: '1px solid #F0F0F0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#F8F9FA' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600 }}>Invoice</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>Outstanding</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>Due Date</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>Days Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.invoices.map(inv => (
                            <tr key={inv.invoice_id} style={{ borderTop: '1px solid #F0F0F0' }}>
                              <td style={{ padding: '8px 16px', fontFamily: 'monospace' }}>
                                {inv.invoice_number}
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>
                                {inv.outstanding.toFixed(3)} OMR
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', color: '#6C757D' }}>
                                {inv.due_date}
                              </td>
                              <td style={{
                                padding: '8px 16px', textAlign: 'right', fontWeight: 600,
                                color: inv.days_overdue > 90 ? '#DC3545' :
                                       inv.days_overdue > 60 ? '#E65100' :
                                       inv.days_overdue > 30 ? '#F57F17' : '#28A745'
                              }}>
                                {inv.days_overdue === 0 ? 'Current' : `${inv.days_overdue} days`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CollectionsDashboard;
