import React, { useState, useEffect } from 'react';
import { Currency, Rates } from '../types';
import { CURRENCIES } from '../data';
import { formatCurrencyValue } from '../utils';

interface ConverterTabProps {
  usdValue: number;
  onUsdValueChange: (value: number) => void;
  rates: Rates;
  connectionStatus: string;
  onRefreshRates: () => Promise<void>;
  lastUpdated: string;
}

export default function ConverterTab({
  usdValue,
  onUsdValueChange,
  rates,
  connectionStatus,
  onRefreshRates,
  lastUpdated,
}: ConverterTabProps) {
  // Local state to keep track of raw user strings to prevent cursor jumping
  const [localInputs, setLocalInputs] = useState<{ [code: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Synchronize local inputs whenever parent usdValue or rates change
  useEffect(() => {
    const nextInputs: { [code: string]: string } = {};
    CURRENCIES.forEach((curr) => {
      // Do not overwrite the active focused input to avoid disturbing user typing
      if (curr.code === focusedCode) {
        nextInputs[curr.code] = localInputs[curr.code] ?? '';
        return;
      }
      
      const rate = rates[curr.code] ?? 1.0;
      const currencyVal = usdValue * rate;
      nextInputs[curr.code] = formatCurrencyValue(currencyVal);
    });
    setLocalInputs(nextInputs);
  }, [usdValue, rates, focusedCode]);

  const handleInputChange = (code: string, rawVal: string) => {
    // Sanitize input: allow digits, one decimal point, and prevent double dots
    let sanitized = rawVal.replace(/[^0-9.]/g, '');
    const dotCount = (sanitized.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Keep only first dot
      const parts = sanitized.split('.');
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    // Update local string immediately for typing fluidness
    setLocalInputs((prev) => ({ ...prev, [code]: sanitized }));

    if (sanitized === '' || sanitized === '.') {
      onUsdValueChange(0);
      return;
    }

    const parsedNum = parseFloat(sanitized);
    if (!isNaN(parsedNum)) {
      const rate = rates[code] ?? 1.0;
      const newUsd = parsedNum / rate;
      onUsdValueChange(newUsd);
    }
  };

  const handleQuickAmount = (amountInUsd: number) => {
    onUsdValueChange(amountInUsd);
    setFocusedCode(null);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshRates();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Filter currencies based on search query
  const filteredCurrencies = CURRENCIES.filter((curr) =>
    curr.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    curr.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="converter-section" className="w-full max-w-4xl mx-auto px-1 sm:px-4 py-2">
      {/* Search and Quick Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        {/* Search input */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <i className="fa-solid fa-magnifying-glass"></i>
          </span>
          <input
            id="currency-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar moneda (PEN, EUR...)"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              <i className="fa-solid fa-circle-xmark"></i>
            </button>
          )}
        </div>

        {/* Quick Amount Pills */}
        <div className="flex flex-wrap gap-2 items-center justify-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
            Fijar USD:
          </span>
          {[1, 10, 100, 1000].map((amount) => (
            <button
              key={amount}
              id={`quick-usd-${amount}`}
              onClick={() => handleQuickAmount(amount)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                Math.abs(usdValue - amount) < 0.001
                  ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              ${amount}
            </button>
          ))}
          <button
            id="converter-reset-btn"
            onClick={() => handleQuickAmount(0)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100/70 transition-all cursor-pointer"
          >
            Limpiar todo
          </button>
        </div>
      </div>

      {/* Grid of Currencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCurrencies.map((curr) => {
          const isPrimary = curr.code === 'USD';
          const rate = rates[curr.code] ?? 1.0;
          const displayRate = formatCurrencyValue(rate);
          const inverseRate = rate > 0 ? formatCurrencyValue(1 / rate) : '0';

          return (
            <div
              key={curr.code}
              id={`currency-card-${curr.code}`}
              className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                focusedCode === curr.code
                  ? 'bg-white border-emerald-500 shadow-md ring-4 ring-emerald-500/5'
                  : 'bg-white/80 border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              {/* Card Header (Flag, Names, Symbol) */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl shadow-sm rounded-md bg-slate-100 px-1 py-0.5 select-none">{curr.flag}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 tracking-tight">{curr.code}</span>
                      {isPrimary && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          Base
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 block truncate max-w-[160px] md:max-w-[200px]">
                      {curr.name}
                    </span>
                  </div>
                </div>

                <span className="text-sm font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-xl">
                  {curr.symbol}
                </span>
              </div>

              {/* Bidirectional Input Form */}
              <div className="relative">
                <input
                  id={`currency-input-${curr.code}`}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={localInputs[curr.code] ?? ''}
                  onFocus={() => setFocusedCode(curr.code)}
                  onBlur={() => setFocusedCode(null)}
                  onChange={(e) => handleInputChange(curr.code, e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-left"
                />
              </div>

              {/* Exchange Rate Details footer inside card */}
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
                {!isPrimary ? (
                  <>
                    <span>1 USD = {displayRate} {curr.code}</span>
                    <span>1 {curr.code} = {inverseRate} USD</span>
                  </>
                ) : (
                  <span className="text-[9px] text-slate-400">Divisa base de cotización de ValutaX</span>
                )}
              </div>
            </div>
          );
        })}

        {filteredCurrencies.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 text-center bg-white border border-slate-200 rounded-3xl p-6">
            <i className="fa-solid fa-face-frown text-3xl mb-3 text-slate-300"></i>
            <p className="text-sm font-semibold">No se encontraron monedas</p>
            <p className="text-xs text-slate-400 mt-1">Intenta buscar con otro término como "Euro" o "PEN".</p>
          </div>
        )}
      </div>

      {/* Connection & Update status panel */}
      <div className="mt-8 p-4 bg-white/70 border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {connectionStatus === 'success' && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
            {connectionStatus === 'partial' && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            )}
            {connectionStatus === 'offline' && (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            )}
            {connectionStatus === 'fetching' && (
              <span className="relative inline-flex h-3 w-3">
                <i className="fa-solid fa-circle-notch animate-spin text-emerald-500 text-xs"></i>
              </span>
            )}
          </div>

          <div className="text-left">
            <span className="text-xs font-bold text-slate-700 block">
              {connectionStatus === 'success' && 'Conectado a APIs en tiempo real (SUNAT & Open-ER)'}
              {connectionStatus === 'partial' && 'Conexión parcial (Tasas de respaldo SUNAT activas)'}
              {connectionStatus === 'offline' && 'Modo Offline - Tasas de respaldo activas'}
              {connectionStatus === 'fetching' && 'Sincronizando tasas de cambio...'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Última actualización: {lastUpdated || 'No sincronizado'}
            </span>
          </div>
        </div>

        <button
          id="refresh-rates-btn"
          disabled={isRefreshing || connectionStatus === 'fetching'}
          onClick={handleManualRefresh}
          className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
        >
          <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'animate-spin' : ''}`}></i>
          Sincronizar ahora
        </button>
      </div>
    </div>
  );
}
