import { Rates } from './types';

interface Token {
  type: 'NUMBER' | 'PERCENT' | 'OPERATOR';
  value: string;
}

// Tokenize standard arithmetic and percentages
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let match;
  // Match percentages (e.g. 10.5%), regular numbers (e.g. 120.5), and operators (+, -, *, /)
  const regex = /(\d+(?:\.\d+)?%)|(\d+(?:\.\d+)?)|([\+\-\*\/])/g;
  const cleanExpr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');

  while ((match = regex.exec(cleanExpr)) !== null) {
    if (match[1]) {
      tokens.push({ type: 'PERCENT', value: match[1] });
    } else if (match[2]) {
      tokens.push({ type: 'NUMBER', value: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'OPERATOR', value: match[3] });
    }
  }
  return tokens;
}

// Pre-resolve percentages to standard numbers based on mathematical contexts
// Standard calculator behaviors:
// - Added or subtracted: "100 + 10%" becomes "100 + (100 * 0.10) = 110"
// - Multiplied or divided: "50 * 20%" becomes "50 * 0.20 = 10"
// - Solo/Default: "5%" becomes "0.05"
function resolvePercentages(tokens: Token[]): Token[] {
  const resolved: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'PERCENT') {
      const percentVal = parseFloat(token.value.replace('%', '')) / 100;
      
      // If preceded by an operator, try to find the base number
      if (i >= 2 && tokens[i - 1].type === 'OPERATOR') {
        const op = tokens[i - 1].value;
        const prevNumToken = tokens[i - 2];
        if (prevNumToken && prevNumToken.type === 'NUMBER') {
          const baseNum = parseFloat(prevNumToken.value);
          if (op === '+' || op === '-') {
            // For + and -, calculate the percentage relative to the preceding base number
            const calculated = baseNum * percentVal;
            resolved.push({ type: 'NUMBER', value: calculated.toString() });
            continue;
          }
        }
      }
      
      // Standard multiplication/division or standalone percentage
      resolved.push({ type: 'NUMBER', value: percentVal.toString() });
    } else {
      resolved.push(token);
    }
  }
  return resolved;
}

// Evaluate resolved tokens containing only numbers and +, -, *, / operators
function evaluateResolvedTokens(tokens: Token[]): number {
  if (tokens.length === 0) return 0;

  // Pass 1: Handle multiplication and division
  const pass1: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === 'OPERATOR' && (token.value === '*' || token.value === '/')) {
      const prev = pass1.pop();
      const next = tokens[i + 1];
      if (prev && prev.type === 'NUMBER' && next && next.type === 'NUMBER') {
        const num1 = parseFloat(prev.value);
        const num2 = parseFloat(next.value);
        let result = 0;
        if (token.value === '*') {
          result = num1 * num2;
        } else {
          result = num2 !== 0 ? num1 / num2 : 0; // Guard against division by zero
        }
        pass1.push({ type: 'NUMBER', value: result.toString() });
        i += 2;
      } else {
        i++;
      }
    } else {
      pass1.push(token);
      i++;
    }
  }

  // Pass 2: Handle addition and subtraction
  if (pass1.length === 0) return 0;
  let total = parseFloat(pass1[0].value);
  if (isNaN(total)) total = 0;

  let j = 1;
  while (j < pass1.length) {
    const opToken = pass1[j];
    const numToken = pass1[j + 1];
    if (opToken && opToken.type === 'OPERATOR' && numToken && numToken.type === 'NUMBER') {
      const val = parseFloat(numToken.value);
      if (opToken.value === '+') {
        total += val;
      } else if (opToken.value === '-') {
        total -= val;
      }
    }
    j += 2;
  }

  return total;
}

/**
 * Safely evaluates any basic arithmetic formula with percentages
 */
export function safeEvaluate(expression: string): number {
  try {
    const tokens = tokenize(expression);
    const resolvedTokens = resolvePercentages(tokens);
    const result = evaluateResolvedTokens(resolvedTokens);
    return isNaN(result) || !isFinite(result) ? 0 : result;
  } catch (err) {
    console.error('Error evaluating formula:', err);
    return 0;
  }
}

/**
 * Formats a currency number up to 5 decimal places cleanly without trailing zeros.
 */
export function formatCurrencyValue(num: number): string {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) {
    return '0';
  }
  // Round to 5 decimals max
  const fixed = num.toFixed(5);
  const parsed = parseFloat(fixed);
  if (parsed === 0) return '0';
  
  // Strip trailing decimals if they are all zeros
  if (parsed % 1 === 0) {
    return parsed.toString();
  }
  // Trim trailing zeros in the decimal section
  return fixed.replace(/\.?0+$/, '');
}
