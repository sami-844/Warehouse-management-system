export const fmtOMR = (value) =>
  `${parseFloat(value || 0).toFixed(3)} OMR`;

export const fmtDate = (dateStr) => {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

export const fmtNumber = (value) =>
  parseFloat(value || 0).toLocaleString('en-US', { minimumFractionDigits: 3 });
