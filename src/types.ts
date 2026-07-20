export interface Currency {
  code: string;
  name: string;
  flag: string;
  symbol: string;
}

export interface Rates {
  [code: string]: number;
}

export type ConnectionStatus = 'fetching' | 'success' | 'partial' | 'offline';

export interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
}
