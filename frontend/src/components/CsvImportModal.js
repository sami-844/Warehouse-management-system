// CsvImportModal.js — Reusable CSV import modal for products, customers, suppliers
import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileText } from 'lucide-react';

// ─── Column metadata per import type ─────────────────────────────────────────
const COLUMN_GUIDES = {
  products: [
    { col: 'name',           required: true,  desc: 'Product / display name' },
    { col: 'sku',            required: true,  desc: 'Unique stock-keeping unit code' },
    { col: 'category',       required: false, desc: 'Category name (must exist in system)' },
    { col: 'unit',           required: false, desc: 'Unit of measure — PCS, KG, Liter, etc.' },
    { col: 'selling_price',  required: true,  desc: 'Retail selling price (OMR)' },
    { col: 'standard_cost',  required: false, desc: 'Purchase / cost price (OMR)' },
    { col: 'barcode',        required: false, desc: 'EAN / barcode number' },
    { col: 'description',    required: false, desc: 'Short product description' },
  ],
  customers: [
    { col: 'name',         required: true,  desc: 'Shop / business name' },
    { col: 'code',         required: true,  desc: 'Unique customer code, e.g. CUST-001' },
    { col: 'phone',        required: false, desc: 'Primary phone number' },
    { col: 'email',        required: false, desc: 'Email address' },
    { col: 'city',         required: false, desc: 'City (e.g. Muscat)' },
    { col: 'area',         required: false, desc: 'Area / delivery route' },
    { col: 'credit_limit', required: false, desc: 'Credit limit in OMR' },
  ],
  suppliers: [
    { col: 'name',           required: true,  desc: 'Supplier company name' },
    { col: 'code',           required: true,  desc: 'Unique supplier code, e.g. SUP-001' },
    { col: 'contact_person', required: false, desc: 'Primary contact name' },
    { col: 'phone',          required: false, desc: 'Phone number' },
    { col: 'email',          required: false, desc: 'Email address' },
    { col: 'city',           required: false, desc: 'City' },
  ],
};

// ─── Sample CSV data per type ──────────────────────────────────────────────────
const SAMPLE_DATA = {
  products: [
    ['name', 'sku', 'category', 'unit', 'selling_price', 'standard_cost', 'barcode', 'description'],
    ['Al Marai Milk 1L', 'MILK-001', 'Dairy', 'Liter', '0.450', '0.320', '6281234567890', 'Fresh full-fat milk'],
    ['Sunflower Oil 5L', 'OIL-005', 'Cooking Oils', 'Liter', '2.800', '2.100', '6281234567891', '5 litre bottle'],
    ['Basmati Rice 10kg', 'RICE-010', 'Grains', 'KG', '5.500', '4.200', '', 'Premium long-grain rice'],
  ],
  customers: [
    ['name', 'code', 'phone', 'email', 'city', 'area', 'credit_limit'],
    ['Al Noor Grocery', 'CUST-001', '+968 2412 3456', 'alnoor@example.com', 'Muscat', 'Al Khuwair', '500'],
    ['Ruwi Market', 'CUST-002', '+968 2498 7654', '', 'Muscat', 'Ruwi', '1000'],
    ['Nizwa Fresh', 'CUST-003', '+968 2541 2222', '', 'Nizwa', 'Nizwa Souq', '300'],
  ],
  suppliers: [
    ['name', 'code', 'contact_person', 'phone', 'email', 'city'],
    ['Al Marai Company', 'SUP-001', 'Ahmed Al Balushi', '+968 2445 1100', 'almarai@supplier.com', 'Muscat'],
    ['Gulf Foods LLC', 'SUP-002', 'Khalid Nasser', '+968 2498 5500', '', 'Salalah'],
    ['Oman Oil Trading', 'SUP-003', 'Sara Mohammed', '+968 2412 7700', 'sara@oot.om', 'Muscat'],
  ],
};

// ─── Simple CSV parser ─────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse a single CSV line, handles quoted fields
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] !== undefined ? values[i] : ''; });
    return obj;
  });

  return { headers, rows };
}

// ─── Build CSV string from 2D array ───────────────────────────────────────────
function buildCSV(data) {
  return data
    .map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(',')
    )
    .join('\n');
}

// ─── Validation ────────────────────────────────────────────────────────────────
function validateRows(type, rows) {
  const guide = COLUMN_GUIDES[type] || [];
  const required = guide.filter(g => g.required).map(g => g.col);
  const errors = [];
  rows.forEach((row, idx) => {
    required.forEach(col => {
      if (!row[col] || String(row[col]).trim() === '') {
        errors.push(`Row ${idx + 2}: "${col}" is required`);
      }
    });
  });
  return errors;
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
function CsvImportModal({ type = 'products', onClose, onImport }) {
  const fileInputRef = useRef(null);
  const [parsedResult, setParsedResult] = useState(null); // { headers, rows }
  const [validationErrors, setValidationErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');

  const guide = COLUMN_GUIDES[type] || [];
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  // Download sample CSV
  const handleDownloadSample = () => {
    const csvContent = buildCSV(SAMPLE_DATA[type] || []);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_${type}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setImportDone(false);
    setImportError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const result = parseCSV(text);
      if (result.headers.length === 0) {
        setParsedResult(null);
        setValidationErrors(['Could not parse file. Make sure it is a valid CSV with a header row.']);
        return;
      }
      const errors = validateRows(type, result.rows);
      setParsedResult(result);
      setValidationErrors(errors);
    };
    reader.onerror = () => {
      setValidationErrors(['Failed to read file.']);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Trigger import
  const handleImport = async () => {
    if (!parsedResult || parsedResult.rows.length === 0) return;
    setImporting(true);
    setImportError('');
    try {
      await onImport(parsedResult.rows);
      setImportCount(parsedResult.rows.length);
      setImportDone(true);
    } catch (err) {
      setImportError(err?.message || 'Import failed. Check console for details.');
    } finally {
      setImporting(false);
    }
  };

  const previewRows = parsedResult ? parsedResult.rows.slice(0, 5) : [];
  const hasErrors = validationErrors.length > 0;
  const canImport = parsedResult && parsedResult.rows.length > 0 && !hasErrors && !importing && !importDone;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-r-xl)',
          boxShadow: 'var(--ds-shadow-lg)',
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--ds-border)',
          background: 'var(--ds-surface-raised)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--ds-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0,
            }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 'var(--ds-text-lg)', color: 'var(--ds-text)' }}>
                Import {typeLabel} from CSV
              </div>
              <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', marginTop: 1 }}>
                Upload a .csv file to bulk-import records
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ds-text-muted)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ds-surface-sunken)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ── Column Guide ── */}
          <div style={{
            background: 'var(--ds-surface-raised)',
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-r-md)',
            marginBottom: 24,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--ds-border)',
            }}>
              <span style={{
                fontWeight: 700, fontSize: 'var(--ds-text-sm)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--ds-text-muted)',
              }}>
                Expected Columns
              </span>
              <button
                onClick={handleDownloadSample}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--ds-surface)',
                  border: '1px solid var(--ds-border-mid)',
                  borderRadius: 'var(--ds-r-sm)',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--ds-font-ui)',
                  fontWeight: 600,
                  fontSize: 'var(--ds-text-xs)',
                  color: 'var(--ds-text-sub)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ds-green)'; e.currentTarget.style.color = 'var(--ds-green)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ds-border-mid)'; e.currentTarget.style.color = 'var(--ds-text-sub)'; }}
              >
                <Download size={13} /> Download Example CSV
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--ds-text-sm)' }}>
              <thead>
                <tr>
                  {['Column', 'Required', 'Description'].map(h => (
                    <th key={h} style={{
                      background: 'var(--ds-navy)', color: '#fff',
                      padding: '8px 14px', textAlign: 'left',
                      fontFamily: 'var(--ds-font-ui)', fontSize: 'var(--ds-text-xs)',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guide.map((g, i) => (
                  <tr key={g.col} style={{ background: i % 2 === 0 ? '#fff' : 'var(--ds-surface-raised)' }}>
                    <td style={{
                      padding: '7px 14px',
                      fontFamily: 'var(--ds-font-mono)',
                      fontSize: 'var(--ds-text-sm)',
                      color: 'var(--ds-info)',
                      fontWeight: 500,
                      borderBottom: '1px solid var(--ds-border)',
                    }}>
                      {g.col}
                    </td>
                    <td style={{ padding: '7px 14px', borderBottom: '1px solid var(--ds-border)' }}>
                      {g.required ? (
                        <span style={{
                          background: 'var(--ds-danger-bg)', color: 'var(--ds-danger)',
                          border: '1px solid var(--ds-danger-border)',
                          borderRadius: 4, padding: '1px 7px',
                          fontSize: 'var(--ds-text-xs)', fontWeight: 700, textTransform: 'uppercase',
                        }}>Required</span>
                      ) : (
                        <span style={{
                          background: 'var(--ds-neutral-bg)', color: 'var(--ds-neutral)',
                          border: '1px solid var(--ds-neutral-border)',
                          borderRadius: 4, padding: '1px 7px',
                          fontSize: 'var(--ds-text-xs)', fontWeight: 700, textTransform: 'uppercase',
                        }}>Optional</span>
                      )}
                    </td>
                    <td style={{
                      padding: '7px 14px', color: 'var(--ds-text-sub)',
                      fontSize: 'var(--ds-text-sm)', borderBottom: '1px solid var(--ds-border)',
                    }}>
                      {g.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── File Input ── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontFamily: 'var(--ds-font-ui)',
              fontSize: 'var(--ds-text-xs)', fontWeight: 700,
              color: 'var(--ds-text-sub)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 8,
            }}>
              Select CSV File
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              border: '2px dashed var(--ds-border-mid)',
              borderRadius: 'var(--ds-r-md)',
              padding: '20px 24px',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
              background: 'var(--ds-surface-raised)',
            }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ds-green)'; e.currentTarget.style.background = 'var(--ds-green-tint)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ds-border-mid)'; e.currentTarget.style.background = 'var(--ds-surface-raised)'; }}
            >
              <Upload size={28} color="var(--ds-text-muted)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--ds-text-sub)', fontSize: 'var(--ds-text-sm)' }}>
                  {fileName ? fileName : 'Click to choose a .csv file'}
                </div>
                <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', marginTop: 2 }}>
                  Only .csv files are accepted. UTF-8 encoding recommended.
                </div>
              </div>
              {fileName && (
                <span style={{
                  background: 'var(--ds-success-bg)', color: 'var(--ds-green)',
                  border: '1px solid var(--ds-success-border)',
                  borderRadius: 4, padding: '2px 8px',
                  fontSize: 'var(--ds-text-xs)', fontWeight: 700,
                }}>
                  Loaded
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* ── Validation Summary ── */}
          {parsedResult && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap',
              }}>
                <div style={{
                  background: 'var(--ds-info-bg)', border: '1px solid var(--ds-info-border)',
                  borderRadius: 6, padding: '6px 14px',
                  fontFamily: 'var(--ds-font-ui)', fontSize: 'var(--ds-text-sm)', fontWeight: 600,
                  color: 'var(--ds-info)',
                }}>
                  {parsedResult.rows.length} row{parsedResult.rows.length !== 1 ? 's' : ''} detected
                </div>
                <div style={{
                  background: 'var(--ds-surface-raised)', border: '1px solid var(--ds-border)',
                  borderRadius: 6, padding: '6px 14px',
                  fontFamily: 'var(--ds-font-ui)', fontSize: 'var(--ds-text-sm)', fontWeight: 600,
                  color: 'var(--ds-text-sub)',
                }}>
                  {parsedResult.headers.length} column{parsedResult.headers.length !== 1 ? 's' : ''}: {parsedResult.headers.join(', ')}
                </div>
                {hasErrors ? (
                  <div style={{
                    background: 'var(--ds-danger-bg)', border: '1px solid var(--ds-danger-border)',
                    borderRadius: 6, padding: '6px 14px',
                    fontFamily: 'var(--ds-font-ui)', fontSize: 'var(--ds-text-sm)', fontWeight: 600,
                    color: 'var(--ds-danger)',
                  }}>
                    {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''}
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--ds-success-bg)', border: '1px solid var(--ds-success-border)',
                    borderRadius: 6, padding: '6px 14px',
                    fontFamily: 'var(--ds-font-ui)', fontSize: 'var(--ds-text-sm)', fontWeight: 600,
                    color: 'var(--ds-green)',
                  }}>
                    Validation passed
                  </div>
                )}
              </div>

              {/* Validation errors list */}
              {hasErrors && (
                <div style={{
                  background: 'var(--ds-danger-bg)', border: '1px solid var(--ds-danger-border)',
                  borderRadius: 6, padding: '10px 14px', marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--ds-danger)', fontSize: 'var(--ds-text-sm)', marginBottom: 6 }}>
                    Fix these errors before importing:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#7f1d1d', fontSize: 'var(--ds-text-xs)', lineHeight: 1.8 }}>
                    {validationErrors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li>...and {validationErrors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Preview Table ── */}
          {previewRows.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontWeight: 700, fontSize: 'var(--ds-text-sm)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--ds-text-muted)', marginBottom: 8,
                paddingBottom: 6, borderBottom: '1px solid var(--ds-border)',
              }}>
                Preview — First {previewRows.length} of {parsedResult.rows.length} rows
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-r-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--ds-text-sm)' }}>
                  <thead>
                    <tr>
                      {parsedResult.headers.map(h => (
                        <th key={h} style={{
                          background: 'var(--ds-navy)', color: '#fff',
                          padding: '8px 12px', textAlign: 'left',
                          fontFamily: 'var(--ds-font-ui)', fontSize: 'var(--ds-text-xs)',
                          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : 'var(--ds-surface-raised)' }}>
                        {parsedResult.headers.map(h => (
                          <td key={h} style={{
                            padding: '7px 12px',
                            borderBottom: '1px solid var(--ds-border)',
                            color: 'var(--ds-text)',
                            fontFamily: 'var(--ds-font-ui)',
                            fontSize: 'var(--ds-text-sm)',
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {row[h] || <span style={{ color: 'var(--ds-text-muted)', fontStyle: 'italic' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Import Result ── */}
          {importDone && (
            <div style={{
              background: 'var(--ds-success-bg)',
              border: '1px solid var(--ds-success-border)',
              borderLeft: '3px solid var(--ds-green)',
              borderRadius: 'var(--ds-r-sm)',
              padding: '10px 16px',
              fontFamily: 'var(--ds-font-ui)',
              fontWeight: 600,
              fontSize: 'var(--ds-text-sm)',
              color: 'var(--ds-green-deeper)',
              marginBottom: 16,
            }}>
              Import complete — {importCount} record{importCount !== 1 ? 's' : ''} processed successfully.
            </div>
          )}

          {importError && (
            <div style={{
              background: 'var(--ds-danger-bg)',
              border: '1px solid var(--ds-danger-border)',
              borderLeft: '3px solid var(--ds-danger)',
              borderRadius: 'var(--ds-r-sm)',
              padding: '10px 16px',
              fontFamily: 'var(--ds-font-ui)',
              fontWeight: 600,
              fontSize: 'var(--ds-text-sm)',
              color: '#7f1d1d',
              marginBottom: 16,
            }}>
              {importError}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, padding: '16px 24px',
          borderTop: '1px solid var(--ds-border)',
          background: 'var(--ds-surface-raised)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px',
              background: 'var(--ds-surface)',
              border: '1px solid var(--ds-border-mid)',
              borderRadius: 'var(--ds-r-sm)',
              fontFamily: 'var(--ds-font-ui)',
              fontWeight: 600,
              fontSize: 'var(--ds-text-sm)',
              color: 'var(--ds-text-sub)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--ds-surface-raised)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--ds-surface)'; }}
          >
            {importDone ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px',
              background: canImport ? 'var(--ds-green)' : 'var(--ds-border-mid)',
              color: canImport ? '#fff' : 'var(--ds-text-muted)',
              border: 'none',
              borderRadius: 'var(--ds-r-sm)',
              fontFamily: 'var(--ds-font-ui)',
              fontWeight: 700,
              fontSize: 'var(--ds-text-sm)',
              cursor: canImport ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (canImport) e.currentTarget.style.background = 'var(--ds-green-dark)'; }}
            onMouseLeave={e => { if (canImport) e.currentTarget.style.background = 'var(--ds-green)'; }}
          >
            <Upload size={15} />
            {importing ? 'Importing...' : `Import ${parsedResult ? parsedResult.rows.length : ''} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CsvImportModal;
