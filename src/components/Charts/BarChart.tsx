import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MultiBarData {
  name?: string;
  month?: string;
  short_month?: string;
  amount?: number;
  expenses?: number;
  income?: number;
  net?: number;
}

interface CustomBarChartProps {
  data: MultiBarData[];
  title?: string;
  isComparison?: boolean;
}

const CustomBarChart: React.FC<CustomBarChartProps> = ({ data, title, isComparison = false }) => {
  return (
    <div className="w-full h-80">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis 
            dataKey={isComparison ? "short_month" : "name"} 
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
          />
          <Tooltip 
            formatter={(value: any, name: any) => [
              `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Amount'
            ]}
            labelStyle={{ color: '#374151' }}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          {isComparison && <Legend />}
          {isComparison ? (
            <>
              <Bar 
                dataKey="income" 
                name="Income"
                fill="#10B981" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="expenses" 
                name="Expenses"
                fill="#EF4444" 
                radius={[4, 4, 0, 0]}
              />
            </>
          ) : (
            <Bar 
              dataKey="amount" 
              fill="#3B82F6" 
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CustomBarChart;