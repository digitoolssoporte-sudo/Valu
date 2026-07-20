import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rates, ConnectionStatus } from './types';
import { FALLBACK_RATES } from './data';
import CalculatorTab from './components/CalculatorTab';
import ConverterTab from './components/ConverterTab';
import CurrencyChart from './components/CurrencyChart';

export default function App() {
  const [activeTab, setActiveTab] = useState<'convertidor' | 'calculadora' | 'graficos'>('convertidor');
  const [usdValue, setUsdValue] = useState<number>(1.0);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('fetching');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Setup Dynamic PWA manifest, service worker registration and install triggers
  useEffect(() => {
    // 1. Dynamic Manifest Injector
    const manifest = {
      name: "ValutaX - Convertidor y Calculadora",
      short_name: "ValutaX",
      description: "Convertidor de divisas bidireccional y calculadora financiera premium",
      start_url: window.location.origin + "/",
      display: "standalone",
      background_color: "#0f172a",
      theme_color: "#10b981",
      orientation: "portrait",
      icons: [
        {
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='120' fill='%230f172a'/><path d='M150 150 L256 362 L362 150' stroke='%2310b981' stroke-width='42' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M300 220 L212 290' stroke='%2306b6d4' stroke-width='42' stroke-linecap='round'/></svg>",
          sizes: "512x512",
          type: "image/svg+xml",
          purpose: "any"
        },
        {
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='45' fill='%230f172a'/><path d='M50 50 L96 142 L142 50' stroke='%2310b981' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M115 80 L77 110' stroke='%2306b6d4' stroke-width='16' stroke-linecap='round'/></svg>",
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "any"
        }
      ]
    };

    try {
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      
      let link = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
      }
      link.href = manifestUrl;
    } catch (err) {
      console.error('Error injecting dynamic manifest:', err);
    }

    // 2. Dynamic Service Worker Injector
    const swCode = `
      const CACHE_NAME = 'valutax-cache-v1';
      const ASSETS = [
        '/',
        '/index.html',
        '/src/main.tsx',
        '/src/App.tsx',
        '/src/index.css'
      ];

      self.addEventListener('install', (e) => {
        self.skipWaiting();
        e.waitUntil(
          caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => console.warn('PWA caching skipped in development:', err));
          })
        );
      });

      self.addEventListener('activate', (e) => {
        e.waitUntil(
          caches.keys().then((keys) => {
            return Promise.all(
              keys.map((key) => {
                if (key !== CACHE_NAME) {
                  return caches.delete(key);
                }
              })
            );
          })
        );
      });

      self.addEventListener('fetch', (e) => {
        e.respondWith(
          caches.match(e.request).then((cachedResponse) => {
            return cachedResponse || fetch(e.request).catch(() => {
              return new Response('Offline fallback active', { status: 503 });
            });
          })
        );
      });
    `;

    if ('serviceWorker' in navigator) {
      try {
        const swBlob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(swBlob);
        navigator.serviceWorker.register(swUrl)
          .then((reg) => console.log('Dynamic PWA Service Worker loaded!', reg))
          .catch((err) => console.error('PWA Service Worker registration failed:', err));
      } catch (err) {
        console.error('Failed to parse SW Blob URL:', err);
      }
    }

    // 3. PWA Installation prompts
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Fetch Exchange Rates on Load
  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setConnectionStatus('fetching');
    let openRates: Rates | null = null;
    let sunatRate: number | null = null;

    // A) Fetch open.er-api.com
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          openRates = data.rates;
        }
      }
    } catch (err) {
      console.warn('API Open-ER offline or failed:', err);
    }

    // B) Fetch SUNAT PEN rate via AllOrigins proxy
    try {
      const targetUrl = encodeURIComponent('https://api.apis.net.pe/v1/tipo-cambio-sunat');
      const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const json = await res.json();
        const data = JSON.parse(json.contents);
        if (data && data.venta) {
          const val = parseFloat(data.venta);
          if (!isNaN(val) && val > 0) {
            sunatRate = val;
          }
        }
      }
    } catch (err) {
      console.warn('API SUNAT failed via proxy:', err);
    }

    // Assemble Rates & Status
    const newRates = { ...FALLBACK_RATES };
    let finalStatus: ConnectionStatus = 'offline';

    if (openRates) {
      finalStatus = 'partial';
      Object.keys(newRates).forEach((code) => {
        if (openRates[code] !== undefined) {
          newRates[code] = openRates[code];
        }
      });
    }

    if (sunatRate !== null) {
      newRates['PEN'] = sunatRate;
      finalStatus = openRates ? 'success' : 'partial';
    }

    setRates(newRates);
    setConnectionStatus(finalStatus);

    const now = new Date();
    setLastUpdated(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + now.toLocaleDateString('es-PE'));
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      triggerToast('Para instalar: usa la opción de "Instalar" o "Añadir a pantalla de inicio" del navegador.');
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
        triggerToast('¡Gracias por instalar ValutaX!');
      }
    } catch (err) {
      console.error('Error triggering PWA install prompt:', err);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Receives calculated value from calculator, sets USD value and redirects to Converter
  const handleCalculatorResult = (result: number) => {
    setUsdValue(result);
    setActiveTab('convertidor');
    triggerToast(`¡Operación exitosa! $${result} enviado al convertidor.`);
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 overflow-x-hidden ${
      activeTab === 'convertidor' ? 'bg-slate-50 text-slate-800' : 'bg-slate-950 text-slate-50'
    } flex flex-col justify-between`}>
      
      {/* Premium Header */}
      <header className={`border-b transition-colors duration-500 ${
        activeTab === 'convertidor' ? 'border-slate-200/60 bg-white/70 backdrop-blur-md' : 'border-slate-900 bg-slate-950/80 backdrop-blur-md'
      } sticky top-0 z-40`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div id="app-logo" className="w-10 h-10 select-none">
              <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logo-emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <rect x="5" y="5" width="90" height="90" rx="26" fill="#0f172a" stroke="url(#logo-emerald-grad)" strokeWidth="4" />
                <path d="M28 35 L50 68 L72 35" stroke="url(#logo-emerald-grad)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M62 46 L38 58" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className={`text-lg font-black tracking-tight flex items-center gap-1.5 leading-none ${
                activeTab === 'convertidor' ? 'text-slate-900' : 'text-slate-50'
              }`}>
                ValutaX
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">PWA</span>
              </h1>
              <p className="text-[10px] text-slate-500 mt-1 font-medium tracking-wide">MULTIDIVISA & CALCULADORA PREMIUM</p>
            </div>
          </div>

          {/* Installation Badge / Button */}
          <div>
            {isInstalled ? (
              <span className="text-xs bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check"></i>
                App Instalada
              </span>
            ) : (
              <button
                id="install-pwa-btn"
                onClick={handleInstallApp}
                className="text-xs font-bold px-3.5 py-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all rounded-xl shadow-md shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-cloud-arrow-down"></i>
                Instalar App
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        
        {/* Navigation Selector Tabs */}
        <div className="flex justify-center mb-8">
          <div className={`p-1.5 rounded-2xl flex items-center shadow-sm border transition-colors duration-500 ${
            activeTab === 'convertidor' ? 'bg-slate-100/80 border-slate-200/50' : 'bg-slate-900/60 border-slate-800'
          }`}>
            {/* Convertidor Tab button */}
            <button
              id="tab-btn-convertidor"
              onClick={() => setActiveTab('convertidor')}
              className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer select-none ${
                activeTab === 'convertidor'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : activeTab === 'graficos'
                    ? 'text-slate-400 hover:text-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-money-bill-transfer"></i>
              Convertidor
            </button>

            {/* Calculadora Tab button */}
            <button
              id="tab-btn-calculadora"
              onClick={() => setActiveTab('calculadora')}
              className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer select-none ${
                activeTab === 'calculadora'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/30'
                  : activeTab === 'graficos'
                    ? 'text-slate-400 hover:text-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-calculator"></i>
              Calculadora
            </button>

            {/* Gráficos Tab button */}
            <button
              id="tab-btn-graficos"
              onClick={() => setActiveTab('graficos')}
              className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer select-none ${
                activeTab === 'graficos'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/30'
                  : activeTab === 'convertidor'
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <i className="fa-solid fa-chart-line"></i>
              Gráficos
            </button>
          </div>
        </div>

        {/* Dynamic Tab Views container */}
        <div className="relative min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === 'convertidor' ? (
              <motion.div
                key="convertidor-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ConverterTab
                  usdValue={usdValue}
                  onUsdValueChange={setUsdValue}
                  rates={rates}
                  connectionStatus={connectionStatus}
                  onRefreshRates={fetchRates}
                  lastUpdated={lastUpdated}
                />
              </motion.div>
            ) : activeTab === 'calculadora' ? (
              <motion.div
                key="calculadora-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <CalculatorTab onResultEvaluated={handleCalculatorResult} />
              </motion.div>
            ) : (
              <motion.div
                key="graficos-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="max-w-4xl mx-auto"
              >
                <CurrencyChart rates={rates} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Floating toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            id="app-toast-notification"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 text-xs font-semibold tracking-wide w-[90%] max-w-md"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-bell"></i>
            </div>
            <p className="flex-1 text-slate-200">{toastMessage}</p>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-100 pl-2 shrink-0 cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant Footer */}
      <footer className={`py-6 border-t transition-colors duration-500 text-center ${
        activeTab === 'convertidor'
          ? 'border-slate-200/60 text-slate-500 bg-slate-100/40'
          : 'border-slate-900 text-slate-600 bg-slate-950/20'
      }`}>
        <p className="text-[10px] font-semibold tracking-wider uppercase">ValutaX v1.0 • Seguro • Sin publicidad • Sin cookies de rastreo</p>
        <p className="text-[10px] opacity-70 mt-1">
          Diseñado con estándares premium de UI/UX. Todos los cálculos se realizan localmente de manera segura.
        </p>
      </footer>

    </div>
  );
}
