import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { safeEvaluate, formatCurrencyValue } from '../utils';

interface CalculatorTabProps {
  onResultEvaluated: (result: number) => void;
}

export default function CalculatorTab({ onResultEvaluated }: CalculatorTabProps) {
  const [expression, setExpression] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<number>(0);
  const [history, setHistory] = useState<{ expression: string; result: number; id: string }[]>(() => {
    try {
      const saved = localStorage.getItem('valutax_calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep history updated in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('valutax_calc_history', JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }
  }, [history]);

  // Live calculation preview
  useEffect(() => {
    if (!expression) {
      setPreviewResult(0);
      return;
    }

    // Clean up trailing operator for live preview evaluation
    let cleanExpr = expression.trim();
    if (['+', '-', '×', '÷'].includes(cleanExpr.slice(-1))) {
      cleanExpr = cleanExpr.slice(0, -1);
    }

    if (cleanExpr) {
      const val = safeEvaluate(cleanExpr);
      setPreviewResult(val);
    } else {
      setPreviewResult(0);
    }
  }, [expression]);

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setExpression('');
      setPreviewResult(0);
    } else if (key === '⌫' || key === 'Backspace') {
      setExpression((prev) => {
        if (!prev) return '';
        // If it ends with spaces (like operations), trim them completely
        if (prev.endsWith(' ')) {
          return prev.slice(0, -3);
        }
        return prev.slice(0, -1);
      });
    } else if (key === '=') {
      if (!expression) return;
      
      const finalVal = safeEvaluate(expression);
      const roundedVal = parseFloat(finalVal.toFixed(5));

      // Save to history
      const newHistoryItem = {
        expression,
        result: roundedVal,
        id: Date.now().toString(),
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 9)]); // limit to last 10 entries

      // Notify parent to update USD value and switch tabs
      onResultEvaluated(roundedVal);
    } else if (key === '%') {
      setExpression((prev) => {
        if (!prev) return '';
        const lastChar = prev.slice(-1);
        if (['+', '-', '×', '÷', ' ', '%'].includes(lastChar)) return prev;
        return prev + '%';
      });
    } else if (['+', '-', '×', '÷', '*', '/'].includes(key)) {
      const displayOp = key === '*' ? '×' : key === '/' ? '÷' : key;
      setExpression((prev) => {
        if (!prev) {
          if (displayOp === '-') return '-'; // allow starting with a negative number
          return '';
        }
        const trimmed = prev.trim();
        const lastChar = trimmed.slice(-1);
        
        // If last char is an operator, replace it
        if (['+', '-', '×', '÷'].includes(lastChar)) {
          return trimmed.slice(0, -1) + ' ' + displayOp + ' ';
        }
        
        return prev + ' ' + displayOp + ' ';
      });
    } else if (key === '.') {
      setExpression((prev) => {
        if (!prev) return '0.';
        
        // Split current expression by operators to check the last active number token
        const tokens = prev.split(/[\+\-\×\÷]/);
        const lastToken = tokens[tokens.length - 1];
        
        if (lastToken.includes('.')) return prev; // already has a decimal
        if (lastToken === '') return prev + '0.';
        return prev + '.';
      });
    } else if (/^\d$/.test(key)) {
      setExpression((prev) => {
        // Prevent starting with multiple zeros
        if (prev === '0') return key;
        if (prev.endsWith(' 0')) return prev.slice(0, -1) + key;
        return prev + key;
      });
    }
  };

  // Keyboard support for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      // Do not capture keys if user is typing in a currency input
      if (activeEl && activeEl.tagName === 'INPUT') return;

      const key = e.key;
      if (key >= '0' && key <= '9') {
        handleKeyPress(key);
      } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        handleKeyPress(key);
      } else if (key === '%' || key === '.') {
        handleKeyPress(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleKeyPress('=');
      } else if (key === 'Backspace') {
        handleKeyPress('⌫');
      } else if (key === 'Escape' || key.toLowerCase() === 'c') {
        handleKeyPress('C');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expression]);

  const buttons = [
    { label: 'C', value: 'C', style: 'bg-rose-950/40 text-rose-400 hover:bg-rose-950/60 border border-rose-800/20 active:scale-95' },
    { label: '⌫', value: '⌫', style: 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/30 active:scale-95' },
    { label: '%', value: '%', style: 'bg-slate-800/60 text-emerald-400 hover:bg-slate-700/60 border border-slate-700/30 active:scale-95 font-medium' },
    { label: '÷', value: '÷', style: 'bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50 border border-emerald-800/20 active:scale-95 font-bold text-lg' },

    { label: '7', value: '7', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '8', value: '8', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '9', value: '9', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '×', value: '×', style: 'bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50 border border-emerald-800/20 active:scale-95 font-bold text-lg' },

    { label: '4', value: '4', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '5', value: '5', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '6', value: '6', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '-', value: '-', style: 'bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50 border border-emerald-800/20 active:scale-95 font-bold text-lg' },

    { label: '1', value: '1', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '2', value: '2', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '3', value: '3', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '+', value: '+', style: 'bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50 border border-emerald-800/20 active:scale-95 font-bold text-lg' },

    { label: '0', value: '0', style: 'col-span-2 bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium text-left px-7' },
    { label: '.', value: '.', style: 'bg-slate-800/30 text-slate-100 hover:bg-slate-700/30 border border-slate-700/20 active:scale-95 font-medium' },
    { label: '=', value: '=', style: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95 font-bold text-xl shadow-lg shadow-emerald-500/20' }
  ];

  const clearHistory = () => {
    setHistory([]);
  };

  const useHistoryItem = (item: { expression: string; result: number }) => {
    setExpression(item.expression);
  };

  return (
    <div id="calculator-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-4xl mx-auto px-1 sm:px-4 py-4">
      {/* Main Calculator Screen and Keypad */}
      <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 p-6 rounded-3xl shadow-2xl flex flex-col justify-between">
        {/* Displays */}
        <div className="mb-6 flex flex-col justify-end items-end bg-slate-950/50 p-5 rounded-2xl border border-slate-800/40 min-h-[140px] text-right font-mono overflow-hidden">
          <div className="text-slate-400 text-sm overflow-x-auto whitespace-nowrap max-w-full pb-1 scrollbar-none h-6">
            {expression || '0'}
          </div>
          <div className="text-3xl font-bold text-slate-50 tracking-tight overflow-x-auto whitespace-nowrap max-w-full py-1 h-12">
            {expression ? formatCurrencyValue(previewResult) : '0'}
          </div>
          <div className="text-xs text-emerald-500 font-sans tracking-wide mt-1 flex items-center gap-1.5 opacity-60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Previsualización en tiempo real
          </div>
        </div>

        {/* Keyboard Instructions (Desktop) */}
        <div className="hidden sm:flex justify-between items-center px-2 py-1 mb-4 text-[10px] text-slate-500 font-mono">
          <span><i className="fa-solid fa-keyboard mr-1"></i> Teclado habilitado</span>
          <span>[Enter] = Enviar a Convertidor</span>
        </div>

        {/* Grid Keypad */}
        <div className="grid grid-cols-4 gap-3">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              id={`calc-btn-${btn.value}`}
              onClick={() => handleKeyPress(btn.value)}
              className={`py-4 rounded-2xl font-sans transition-all duration-150 flex items-center justify-center cursor-pointer select-none ${btn.style}`}
            >
              {btn.label === '⌫' ? (
                <i className="fa-solid fa-delete-left text-lg"></i>
              ) : (
                btn.label
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Calculator History/Tape */}
      <div className="lg:col-span-5 bg-slate-900/20 border border-slate-800/30 p-6 rounded-3xl flex flex-col h-[480px]">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/40">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-2">
            <i className="fa-solid fa-clock-history text-emerald-500"></i> Historial Financiero
          </h3>
          {history.length > 0 && (
            <button
              id="clear-history-btn"
              onClick={clearHistory}
              className="text-xs text-rose-400/80 hover:text-rose-400 cursor-pointer flex items-center gap-1 hover:underline"
            >
              <i className="fa-solid fa-trash-can text-[10px]"></i> Limpiar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
          <AnimatePresence initial={false}>
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 px-4">
                <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-calculator text-lg opacity-40"></i>
                </div>
                <p className="text-xs font-medium">No hay operaciones previas</p>
                <p className="text-[10px] mt-1 text-slate-500">
                  Calcula una expresión y presiona "=" para guardar el registro y convertir.
                </p>
              </div>
            ) : (
              history.map((item) => (
                <motion.div
                  key={item.id}
                  id={`history-item-${item.id}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => useHistoryItem(item)}
                  className="p-3 bg-slate-900/40 border border-slate-800/50 hover:border-emerald-500/30 rounded-xl cursor-pointer hover:bg-slate-800/20 transition-all text-right group"
                >
                  <div className="text-xs text-slate-500 font-mono truncate mb-1 group-hover:text-slate-400">
                    {item.expression}
                  </div>
                  <div className="text-sm font-bold text-slate-200 font-mono flex justify-between items-center">
                    <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      Usar fórmula
                    </span>
                    <span>= {formatCurrencyValue(item.result)}</span>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        
        {/* Pro Tip badge */}
        <div className="mt-4 p-3 bg-slate-800/10 border border-slate-800/20 rounded-xl text-[10px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-400">Consejo Premium:</span> Puedes presionar cualquier registro del historial para recuperar la expresión y recalcularla o editarla.
        </div>
      </div>
    </div>
  );
}
