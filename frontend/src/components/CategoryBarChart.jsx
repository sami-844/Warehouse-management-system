/**
 * CategoryBarChart — horizontal bar chart of inventory value per category
 * Props: data [{category, total_value, product_count, low_stock, out_of_stock}]
 */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

const BRAND_COLORS = ['#1A7B5B','#2EA87B','#D4A017','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316'];

const CategoryBarChart = ({ data = [] }) => {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-name">{d.category}</p>
          <p className="chart-tooltip-value">Products: {d.product_count}</p>
          <p className="chart-tooltip-value">Value: {Number(d.total_value).toLocaleString('en-US', { minimumFractionDigits: 2 })} OMR</p>
          {d.low_stock > 0 && <p className="chart-tooltip-value" style={{ color: '#F59E0B' }}>{d.low_stock} low stock</p>}
          {d.out_of_stock > 0 && <p className="chart-tooltip-value" style={{ color: '#EF4444' }}>{d.out_of_stock} out of stock</p>}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Inventory by Category</h3>
        </div>
        <div className="chart-empty">No category data available</div>
      </div>
    );
  }

  /* truncate long category names for axis */
  const truncate = (s, n = 14) => s && s.length > n ? s.slice(0, n - 1) + '…' : s;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">Inventory by Category</h3>
        <span className="chart-subtitle">{data.length} categories</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'Outfit, system-ui, sans-serif' }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
          />
          <YAxis
            type="category" dataKey="category"
            tick={{ fontSize: 12, fill: '#374151', fontFamily: 'Outfit, system-ui, sans-serif', fontWeight: 500 }}
            axisLine={false} tickLine={false} width={90}
            tickFormatter={truncate}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total_value" name="Value (OMR)" radius={[0, 6, 6, 0]} barSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
            ))}
            <LabelList
              dataKey="total_value"
              position="right"
              formatter={(v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              style={{ fontSize: 11, fill: '#374151', fontWeight: 600, fontFamily: 'Outfit, system-ui, sans-serif' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryBarChart;