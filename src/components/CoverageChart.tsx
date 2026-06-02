import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatTime } from '../lib/utils';
import { HourCoverage } from '../lib/coverage';

interface CoverageChartProps {
  coverage: HourCoverage[];
  isDarkMode?: boolean;
}

export default function CoverageChart({ coverage, isDarkMode = false }: CoverageChartProps) {
  const chartData = useMemo(() => {
    return coverage.map(({ hour, scheduled, target }) => {
      const rounded = Number(scheduled.toFixed(2));
      return {
        hourStr: `${formatTime(hour)} - ${formatTime(hour + 1)}`,
        scheduled: rounded,
        target,
        delta: Number((rounded - target).toFixed(2))
      };
    });
  }, [coverage]);

  const getBarColor = (scheduled: number, target: number) => {
    if (target <= 0) {
      return scheduled > 0 ? '#a855f7' : '#10b981'; // surplus or perfect empty
    }
    const delta = scheduled - target;
    if (delta <= -0.5) return '#ef4444'; // Understaffed / Deficit
    if (delta < 0) return '#f59e0b'; // Amber / Warning
    if (delta === 0) return '#10b981'; // Solid Match / Perfect Staffing (Emerald)
    return '#a855f7'; // Purple / Surplus staff (+0.5 or above)
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      const verb = p.delta > 0 ? 'Surplus' : p.delta < 0 ? 'Deficit' : 'Optimal Match';
      const deltaColor = p.delta > 0 ? 'text-purple-400' : p.delta < 0 ? 'text-red-400' : 'text-emerald-400';
      return (
        <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-lg shadow-xl text-sm max-w-[200px]">
          <p className="font-semibold text-slate-300 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-slate-400">Scheduled:</span>
              <span className="font-mono text-slate-200">{p.scheduled.toFixed(2)}h</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-slate-400">Target:</span>
              <span className="font-mono text-slate-200">{p.target}h</span>
            </p>
            <div className="w-full h-[1px] bg-slate-800 my-1 pb-0.5"></div>
            <p className={`flex justify-between gap-4 ${deltaColor}`}>
              <span>{verb}:</span>
              <span className="font-bold font-mono">
                {p.delta === 0 ? 'Optimal' : `${p.delta > 0 ? '+' : ''}${p.delta.toFixed(2)}h`}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-4">
      {/* Dynamic Visual Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-800 py-2.5">
        <span className="mr-2">Status Key:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500 inline-block" />
          <span>Deficit (-0.5h+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
          <span>Warning Gap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
          <span>Perfect Match</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-500 inline-block" />
          <span>Surplus Roster (Purple)</span>
        </div>
      </div>

      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
            <XAxis 
              dataKey="hourStr" 
              tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
              tickFormatter={(val) => val.split(' - ')[0]} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis 
              tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
              axisLine={false} 
              tickLine={false} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc' }} />
            
            <Bar dataKey="scheduled" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.scheduled, entry.target)} />
              ))}
            </Bar>
            
            <Line 
              type="step" 
              dataKey="target" 
              stroke={isDarkMode ? '#e2e8f0' : '#0f172a'} 
              strokeWidth={2} 
              dot={false}
              activeDot={{ r: 4, fill: isDarkMode ? '#e2e8f0' : '#0f172a' }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
