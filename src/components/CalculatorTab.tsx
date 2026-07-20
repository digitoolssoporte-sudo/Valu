import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { safeEvaluate, formatCurrencyValue } from '../utils';

interface CalculatorTabProps {
  onResultEvaluated: (result: number) => void;
}

export default function CalculatorTab({ onResultEvaluated }: CalculatorTabProps) {
  const [expression, setExpression] = useState<string>('');
  const [isEvaluated, setIsEvaluated] = useState<boolean>(false);
  const [evaluatedResult, setEvaluatedResult] = useState<number>(0);
  const [lastFormula, setLastFormula] = useState<string>('');
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

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setExpression('');
      setIsEvaluated(false);
      setEvaluatedResult(0);
      setLastFormula('');
    } else if (key === '⌫' || key === 'Backspace') {
      if (isEvaluated) {
        setIsEvaluated(false);
        return;
      }
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

      setLastFormula(expression);
      setEvaluatedResult(roundedVal);
      setIsEvaluated(true);
    } else if (key === '%') {
      if (isEvaluated) {
        setExpression(evaluatedResult.toString() + '%');
        setIsEvaluated(false);
      } else {
        setExpression((prev) => {
          if (!prev) return '';
          const lastChar = prev.slice(-1);
          if (['+', '-', '×', '÷', ' ', '%'].includes(lastChar)) return prev;
          return prev + '%';
        });
      }
    } else if (['+', '-', '×', '÷', '*', '/'].includes(key)) {
      const displayOp = key === '*' ? '×' : key === '/' ? '÷' : key;
      if (isEvaluated) {
        setExpression(evaluatedResult.toString() + ' ' + displayOp + ' ');
        setIsEvaluated(false);
      } else {
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
      }
    } else if (key === '.') {
      if (isEvaluated) {
        setExpression('0.');
        setIsEvaluated(false);
      } else {
        setExpression((prev) => {
          if (!prev) return '0.';
          
          // Split current expression by operators to check the last active number token
          const tokens = prev.split(/[\+\-\×\÷]/);
          const lastToken = tokens[tokens.length - 1];
          
          if (lastToken.includes('.')) return prev; // already has a decimal
          if (lastToken === '') return prev + '0.';
          return prev + '.';
        });
      }
    } else if (/^\d$/.test(key)) {
      if (isEvaluated) {
        setExpression(key);
        setIsEvaluated(false);
      } else {
        setExpression((prev) => {
          // Prevent starting with multiple zeros
          if (prev === '0') return key;
          if (prev.endsWith(' 0')) return prev.slice(0, -1) + key;
          return prev + key;
        });
      }
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
  }, [expression, isEvaluated, evaluatedResult]);

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
    setIsEvaluated(false);
    setEvaluatedResult(0);
  };

  // Check if expression contains any mathematical operator
  const hasOperators = /[\+\-\×\÷%]/.test(expression);
  // We can convert if the result has been evaluated, OR if the expression is just a plain, valid non-zero number
  const isPlainNumber = !!expression && !hasOperators && !isNaN(Number(expression)) && Number(expression) !== 0;

  const currentValue = isEvaluated ? evaluatedResult : (isPlainNumber ? Number(expression) : 0);
  const isConvertDisabled = currentValue === 0;
  const [showHistoryMobile, setShowHistoryMobile] = useState<boolean>(false);

  return (
    <div id="calculator-section" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 w-full max-w-4xl mx-auto px-1 sm:px-4 py-1 sm:py-4">
      {/* Main Calculator Screen and Keypad */}
      <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 p-3 sm:p-6 rounded-3xl shadow-2xl flex flex-col justify-between">
        {/* Displays */}
        <div className="mb-3 sm:mb-5 flex flex-col justify-end items-end bg-slate-950/50 p-3.5 sm:p-5 rounded-2xl border border-slate-800/40 min-h-[90px] sm:min-h-[140px] text-right font-mono overflow-hidden">
          <div className="text-slate-400 text-xs sm:text-sm overflow-x-auto whitespace-nowrap max-w-full pb-1 scrollbar-none h-6 w-full text-right">
            {isEvaluated ? (
              <span className="text-slate-500">{lastFormula} =</span>
            ) : (
              <span className="text-slate-500/70">Calculadora de Divisas</span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight overflow-x-auto whitespace-nowrap max-w-full py-1 h-10 sm:h-12 w-full text-right">
            {isEvaluated ? (
              formatCurrencyValue(evaluatedResult)
            ) : (
              expression || '0'
            )}
          </div>
          <div className="text-[10px] sm:text-xs text-emerald-500 font-sans tracking-wide mt-1 flex items-center gap-1.5 opacity-60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {isEvaluated ? 'Resultado calculado' : 'Ingresa una operación y presiona "="'}
          </div>
        </div>
 
        {/* Dedicated Convert Button */}
        <button
          id="send-to-converter-btn"
          onClick={() => onResultEvaluated(currentValue)}
          disabled={isConvertDisabled}
          className={`w-full py-2.5 sm:py-3.5 px-4 sm:px-5 mb-3 sm:mb-4 rounded-2xl font-bold text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-2 sm:gap-2.5 shadow-lg select-none cursor-pointer ${
            isConvertDisabled
              ? 'bg-slate-800/40 text-slate-600 border border-slate-800/50 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 shadow-emerald-950/20 active:scale-[0.98]'
          }`}
        >
          <i className="fa-solid fa-money-bill-transfer text-sm sm:text-base"></i>
          <span>
            {isConvertDisabled
              ? 'Ingresa o calcula un monto'
              : 'Convertir monto'}
          </span>
        </button>
 
        {/* Keyboard Instructions (Desktop) */}
        <div className="hidden sm:flex justify-between items-center px-2 py-1 mb-3 text-[10px] text-slate-500 font-mono">
          <span><i className="fa-solid fa-keyboard mr-1"></i> Teclado habilitado</span>
          <span>[Enter] = Calcular resultado</span>
        </div>
 
        {/* Grid Keypad */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              id={`calc-btn-${btn.value}`}
              onClick={() => handleKeyPress(btn.value)}
              className={`py-2.5 sm:py-4 rounded-2xl font-sans transition-all duration-150 flex items-center justify-center cursor-pointer select-none text-sm sm:text-base ${btn.style}`}
            >
              {btn.label === '⌫' ? (
                <i className="fa-solid fa-delete-left text-base sm:text-lg"></i>
              ) : (
                btn.label
              )}
            </button>
          ))}
        </div>

        {/* Mobile History Toggle Button */}
        <button
          id="toggle-history-mobile-btn"
          onClick={() => setShowHistoryMobile(!showHistoryMobile)}
          className="flex lg:hidden w-full mt-3 py-2 px-4 bg-slate-950/30 border border-slate-800/50 rounded-xl items-center justify-center gap-2 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-clock-history text-emerald-500 text-xs"></i>
          <span>{showHistoryMobile ? 'Ocultar Historial Financiero' : 'Ver Historial Financiero'}</span>
          <i className={`fa-solid ${showHistoryMobile ? 'fa-chevron-up' : 'fa-chevron-down'} text-[9px] opacity-75`}></i>
        </button>
      </div>
 
      {/* Calculator History/Tape */}
      <div className={`lg:col-span-5 bg-slate-900/20 border border-slate-800/30 p-4 sm:p-6 rounded-3xl flex flex-col h-[320px] lg:h-[540px] ${
        showHistoryMobile ? 'flex' : 'hidden lg:flex'
      }`}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/40">
          <h3 className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-2">
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
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-slate-800 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-calculator text-base sm:text-lg opacity-40"></i>
                </div>
                <p className="text-xs font-medium">No hay operaciones previas</p>
                <p className="text-[10px] mt-1 text-slate-500">
                  Calcula una expresión y presiona "=" para guardar el registro.
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
                  <div className="text-[11px] sm:text-xs text-slate-500 font-mono truncate mb-1 group-hover:text-slate-400">
                    {item.expression}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-200 font-mono flex justify-between items-center">
                    <span className="text-[9px] sm:text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
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
        <div className="mt-4 p-2.5 sm:p-3 bg-slate-800/10 border border-slate-800/20 rounded-xl text-[9px] sm:text-[10px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-400">Consejo Premium:</span> Puedes presionar cualquier registro del historial para recuperar la expresión y recalcularla o editarla.
        </div>
      </div>
    </div>
  );
}
