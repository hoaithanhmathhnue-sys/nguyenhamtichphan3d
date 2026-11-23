/**
 * Trình phân tích biểu thức toán học an toàn (Recursive Descent Parser)
 * Không dùng eval / new Function -> an toàn tuyệt đối với CSP trên Vercel và đầu ra AI.
 * Hỗ trợ: +, -, *, /, ^, (), nhân ngầm (2x, 3(x+1), 2pi), pi, e, sin, cos, tan, sqrt, abs, ln, log, exp
 */

type TokenType = 'NUM' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

const preprocessExpr = (raw: string): string => {
  return raw
    .trim()
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/·/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/(\d),(\d)/g, '$1.$2');
};

const tokenize = (input: string): Token[] => {
  const s = preprocessExpr(input);
  const rawTokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i++];
      }
      rawTokens.push({ type: 'NUM', value: num });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        id += s[i++];
      }
      rawTokens.push({ type: 'IDENT', value: id.toLowerCase() });
      continue;
    }
    if ('+-*/^'.includes(ch)) {
      rawTokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      rawTokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      rawTokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      rawTokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }
    throw new Error(`Ký tự không hỗ trợ trong biểu thức: "${ch}"`);
  }

  // Chèn phép nhân ngầm: 2x -> 2*x, 2(x+1) -> 2*(x+1), (x+1)(x-1) -> (x+1)*(x-1), x pi -> x*pi
  const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'sqrt', 'abs', 'ln', 'log', 'exp', 'pow', 'max', 'min']);
  const tokens: Token[] = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const cur = rawTokens[k];
    tokens.push(cur);
    if (k + 1 < rawTokens.length) {
      const next = rawTokens[k + 1];
      const curIsVal =
        cur.type === 'NUM' ||
        cur.type === 'RPAREN' ||
        (cur.type === 'IDENT' && !FUNC_NAMES.has(cur.value));
      const nextStartsVal =
        next.type === 'LPAREN' ||
        next.type === 'IDENT' ||
        next.type === 'NUM';
      if (curIsVal && nextStartsVal) {
        tokens.push({ type: 'OP', value: '*' });
      }
    }
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
};

type AstNode = (x: number) => number;

export interface CompiledMathExpr {
  ok: boolean;
  fn: (x: number) => number;
  error?: string;
}

export const compileMathExpr = (rawExpr: string): CompiledMathExpr => {
  try {
    const tokens = tokenize(rawExpr);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const parseExpr = (): AstNode => {
      let left = parseTerm();
      while (peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseTerm();
        const l = left;
        const r = right;
        left = op === '+' ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
      }
      return left;
    };

    const parseTerm = (): AstNode => {
      let left = parseUnary();
      while (peek().type === 'OP' && (peek().value === '*' || peek().value === '/')) {
        const op = consume().value;
        const right = parseUnary();
        const l = left;
        const r = right;
        left = op === '*' ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
      }
      return left;
    };

    const parseUnary = (): AstNode => {
      if (peek().type === 'OP' && peek().value === '+') {
        consume();
        return parseUnary();
      }
      if (peek().type === 'OP' && peek().value === '-') {
        consume();
        const inner = parseUnary();
        return (x) => -inner(x);
      }
      return parsePower();
    };

    const parsePower = (): AstNode => {
      const base = parsePrimary();
      if (peek().type === 'OP' && peek().value === '^') {
        consume();
        const exp = parseUnary();
        return (x) => Math.pow(base(x), exp(x));
      }
      return base;
    };

    const parsePrimary = (): AstNode => {
      const tok = peek();
      if (tok.type === 'NUM') {
        consume();
        const val = Number(tok.value);
        if (!Number.isFinite(val)) throw new Error(`Số không hợp lệ: ${tok.value}`);
        return () => val;
      }
      if (tok.type === 'LPAREN') {
        consume();
        const inner = parseExpr();
        if (peek().type !== 'RPAREN') throw new Error('Thiếu dấu ngoặc đóng ")"');
        consume();
        return inner;
      }
      if (tok.type === 'IDENT') {
        consume();
        const name = tok.value;
        if (name === 'x' || name === 't' || name === 'y') return (x) => x;
        if (name === 'pi') return () => Math.PI;
        if (name === 'e') return () => Math.E;

        if (peek().type === 'LPAREN') {
          consume();
          const args: AstNode[] = [];
          if (peek().type !== 'RPAREN') {
            args.push(parseExpr());
            while (peek().type === 'COMMA') {
              consume();
              args.push(parseExpr());
            }
          }
          if (peek().type !== 'RPAREN') throw new Error(`Thiếu ")" sau hàm ${name}`);
          consume();

          const a0 = args[0] ?? (() => 0);
          const a1 = args[1] ?? (() => 0);
          switch (name) {
            case 'sin':
              return (x) => Math.sin(a0(x));
            case 'cos':
              return (x) => Math.cos(a0(x));
            case 'tan':
              return (x) => Math.tan(a0(x));
            case 'sqrt':
              return (x) => Math.sqrt(Math.max(0, a0(x)));
            case 'abs':
              return (x) => Math.abs(a0(x));
            case 'ln':
              return (x) => Math.log(Math.max(1e-9, a0(x)));
            case 'log':
              return (x) => Math.log10(Math.max(1e-9, a0(x)));
            case 'exp':
              return (x) => Math.exp(a0(x));
            case 'pow':
              return (x) => Math.pow(a0(x), a1(x));
            case 'max':
              return (x) => Math.max(a0(x), a1(x));
            case 'min':
              return (x) => Math.min(a0(x), a1(x));
            default:
              throw new Error(`Hàm toán học chưa hỗ trợ: ${name}`);
          }
        }
        throw new Error(`Biến chưa xác định: "${name}" (chỉ dùng biến x)`);
      }
      throw new Error(`Cú pháp biểu thức chưa hợp lệ gần "${tok.value}"`);
    };

    const ast = parseExpr();
    if (peek().type !== 'EOF') {
      throw new Error(`Ký tự dư thừa ở cuối biểu thức: "${peek().value}"`);
    }

    const safeFn = (x: number): number => {
      try {
        const v = ast(x);
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    };
    return { ok: true, fn: safeFn };
  } catch (err) {
    return {
      ok: false,
      fn: () => 0,
      error: err instanceof Error ? err.message : 'Lỗi phân tích biểu thức toán học',
    };
  }
};
