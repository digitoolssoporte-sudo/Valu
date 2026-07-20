import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Currency, Rates } from '../types';
import { CURRENCIES } from '../data';
import { formatCurrencyValue } from '../utils';

interface CurrencyChartProps {
  rates: Rates;
  baseCode?: string;
}

export default function CurrencyChart({ rates, baseCode = 'USD' }: CurrencyChartProps) {
  const [selectedCode, setSelectedCode] = useState<string>('PEN');
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('7D');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Find selected currency details
  const currencyInfo = useMemo(() => {
    return CURRENCIES.find((c) => c.code === selectedCode) || CURRENCIES[1]; // default to PEN
  }, [selectedCode]);

  // Generate realistic historical points using seeded pseudo-randomness (so it's stable but dynamic)
  const chartData = useMemo(() => {
    const currentRate = rates[selectedCode] ?? 1.0;
    const pointsCount = timeframe === '7D' ? 7 : timeframe === '30D' ? 12 : 18;
    
    // Seed function for stable pseudo-random values
    const seedRandom = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
      };
    };

    const rand = seedRandom(selectedCode + timeframe);
    const data: { label: string; value: number; changePercent: number }[] = [];
    
    let tempRate = currentRate;
    const now = new Date();

    for (let i = pointsCount - 1; i >= 0; i--) {
      const date = new Date(now);
      if (timeframe === '7D') {
        date.setDate(now.getDate() - i);
      } else if (timeframe === '30D') {
        date.setDate(now.getDate() - i * 3);
      } else {
        date.setDate(now.getDate() - i * 5);
      }

      const label = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      
      // Calculate realistic walk from standard rate
      let multiplier = 1 + (rand() * 0.04 - 0.02); // max 2% change each step
      if (i === 0) {
        tempRate = currentRate; // anchor last point to the actual current live rate
      } else {
        tempRate = tempRate * multiplier;
      }

      // Calculate change compared to standard base
      const changePercent = ((tempRate - currentRate) / currentRate) * 100;

      data.push({
        label,
        value: tempRate,
        changePercent
      });
    }

    return data;
  }, [selectedCode, timeframe, rates]);

  // Calculations for SVG layout
  const stats = useMemo(() => {
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const difference = max - min || 1;
    const lastPoint = chartData[chartData.length - 1];
    const firstPoint = chartData[0];
    const periodChange = ((lastPoint.value - firstPoint.value) / firstPoint.value) * 100;

    return { min, max, avg, difference, periodChange };
  }, [chartData]);

  // Width & height configurations for the SVG trendline
  const width = 600;
  const height = 180;
  const padding = { top: 15, right: 20, bottom: 25, left: 20 };

  const svgPoints = useMemo(() => {
    if (chartData.length === 0) return '';
    return chartData.map((point, index) => {
      const x = padding.left + (index / (chartData.length - 1)) * (width - padding.left - padding.right);
      // normalized y coordinate (inverted since SVG 0 is top)
      const normalizedY = (point.value - stats.min) / stats.difference;
      const y = height - padding.bottom - normalizedY * (height - padding.top - padding.bottom);
      return { x, y, ...point };
    });
  }, [chartData, stats, width, height]);

  // Create a smooth SVG path
  const pathD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    let d = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      const p = svgPoints[i];
      // Cubic bezier control points for curved smoothing
      const prev = svgPoints[i - 1];
      const cpX1 = prev.x + (p.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (p.x - prev.x) / 2;
      const cpY2 = p.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }
    return d;
  }, [svgPoints]);

  // Closed path for filled gradient below the line
  const areaD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const bottomY = height - padding.bottom;
    return `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${bottomY} L ${svgPoints[0].x} ${bottomY} Z`;
  }, [svgPoints, pathD]);

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl w-full mb-8">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-chart-line"></i> Analítica & Tendencias de Mercado
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Gráfico histórico interactivo del {currencyInfo.name} ({currencyInfo.code}) frente al USD
          </p>
        </div>

        {/* Currency selector and Timeframe pill controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              id="chart-currency-select"
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {CURRENCIES.filter(c => c.code !== 'USD').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-slate-500">
              <i className="fa-solid fa-chevron-down"></i>
            </span>
          </div>

          <div className="bg-slate-950 p-1 rounded-xl flex border border-slate-800">
            {(['7D', '30D', '90D'] as const).map((t) => (
              <button
                key={t}
                id={`chart-timeframe-${t}`}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                  timeframe === t
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid containing Quick Statistics & Interactive SVG Line chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Statistics Column */}
        <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tasa Máxima</span>
            <span className="text-base font-bold text-slate-100 font-mono block">
              {formatCurrencyValue(stats.max)}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">Por 1 USD</span>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tasa Mínima</span>
            <span className="text-base font-bold text-slate-100 font-mono block">
              {formatCurrencyValue(stats.min)}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">Por 1 USD</span>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Rendimiento</span>
            <span className={`text-base font-bold font-mono block flex items-center gap-1 ${
              stats.periodChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <i className={`fa-solid ${stats.periodChange >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-xs`}></i>
              {stats.periodChange >= 0 ? '+' : ''}{stats.periodChange.toFixed(2)}%
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">En el periodo</span>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Volatilidad</span>
            <span className="text-base font-bold text-amber-400 font-mono block">
              {((stats.max - stats.min) / stats.avg * 100).toFixed(3)}%
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">Coef. Volatilidad</span>
          </div>
        </div>

        {/* Vector SVG Chart Column */}
        <div className="lg:col-span-9 bg-slate-950/50 rounded-2xl p-4 border border-slate-800/40 relative flex flex-col justify-between min-h-[220px]">
          
          {/* Axis labels & metadata */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-2">
            <span>Ref: 1 USD</span>
            <span>{timeframe === '7D' ? 'Historial de 7 Días' : timeframe === '30D' ? 'Historial de 1 Mes' : 'Historial de 3 Meses'}</span>
          </div>

          {/* SVG Rendering Stage */}
          <div className="relative flex-1">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Neon green spline glow gradients */}
                <linearGradient id="chartGlowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="chartStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Grid Lines */}
              {[0, 0.5, 1].map((ratio) => {
                const yVal = padding.top + ratio * (height - padding.top - padding.bottom);
                return (
                  <line
                    key={ratio}
                    x1={padding.left}
                    y1={yVal}
                    x2={width - padding.right}
                    y2={yVal}
                    stroke="rgba(51, 65, 85, 0.25)"
                    strokeDasharray="4,4"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Filled Area Gradient path */}
              <motion.path
                d={areaD}
                fill="url(#chartGlowGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              />

              {/* Spline Path stroke */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="url(#chartStrokeGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />

              {/* Interactive Hover Nodes */}
              {svgPoints.map((pt, idx) => (
                <g key={idx}>
                  {/* Invisible broad hitbox for hovering ease */}
                  <rect
                    x={pt.x - 15}
                    y={0}
                    width={30}
                    height={height}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {/* Small point circle dots */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIndex === idx ? 6 : 3}
                    fill={hoveredIndex === idx ? '#10b981' : '#047857'}
                    stroke={hoveredIndex === idx ? '#ffffff' : 'transparent'}
                    strokeWidth="1.5"
                    className="transition-all duration-150"
                  />
                </g>
              ))}
            </svg>

            {/* Dynamic HTML Tooltip Layer synced with hover indexes */}
            <AnimatePresence>
              {hoveredIndex !== null && svgPoints[hoveredIndex] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    position: 'absolute',
                    left: `${(hoveredIndex / (chartData.length - 1)) * 90 + 5}%`,
                    top: '10%'
                  }}
                  className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-2xl pointer-events-none z-10 text-right min-w-[120px] font-mono"
                >
                  <p className="text-[9px] text-slate-500 font-sans tracking-wide">
                    {svgPoints[hoveredIndex].label}
                  </p>
                  <p className="text-xs font-bold text-slate-100 mt-0.5">
                    {formatCurrencyValue(svgPoints[hoveredIndex].value)} {selectedCode}
                  </p>
                  <p className={`text-[9px] font-bold mt-0.5 ${
                    svgPoints[hoveredIndex].changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {svgPoints[hoveredIndex].changePercent >= 0 ? '▲ +' : '▼ '}
                    {svgPoints[hoveredIndex].changePercent.toFixed(3)}%
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Date labels */}
          <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono border-t border-slate-900 pt-2 px-1">
            {chartData.map((d, i) => {
              // Only display sparse labels on narrow screens to prevent overlap
              if (chartData.length > 7 && i % 3 !== 0 && i !== chartData.length - 1) return null;
              return <span key={i}>{d.label}</span>;
            })}
          </div>

        </div>

      </div>

    </div>
  );
}
