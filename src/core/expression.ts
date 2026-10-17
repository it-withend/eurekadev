/**
 * A small, safe formula language for student-made experiments.
 * Recursive-descent parser — never `eval`, so a shared experiment file
 * cannot run code. Supports + − × ÷ ^, parentheses, unary minus,
 * functions, constants (pi, e) and student-friendly symbols (π, ², ·, ×, √).
 *
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/' | <implicit>) unary)*   — "4πm" multiplies
 *   unary   := ('+' | '-') unary | power
 *   power   := primary ('^' unary)?          (right-associative; -x^2 = -(x^2))
 *   primary := number | name | name '(' expr (',' expr)* ')' | '(' expr ')'
 */

export class ExpressionError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

export type Node =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string; pos: number }
  | { type: 'neg'; arg: Node }
  | { type: 'bin'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[]; pos: number };

const FUNCTIONS: Record<string, { arity: number; fn: (...a: number[]) => number }> = {
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  asin: { arity: 1, fn: Math.asin },
  acos: { arity: 1, fn: Math.acos },
  atan: { arity: 1, fn: Math.atan },
  exp: { arity: 1, fn: Math.exp },
  ln: { arity: 1, fn: Math.log },
  log: { arity: 1, fn: Math.log10 },
  min: { arity: 2, fn: Math.min },
  max: { arity: 2, fn: Math.max },
};

export const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

/** Rewrites typographic symbols students copy from textbooks into plain syntax. */
function normalise(src: string): string {
  return src
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[·×∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/√/g, 'sqrt');
}

type Token =
  | { kind: 'num'; value: number; pos: number }
  | { kind: 'name'; value: string; pos: number }
  | { kind: 'op'; value: string; pos: number }
  | { kind: 'end'; pos: number };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExpressionError(`Unexpected "${c}"`, i);
      tokens.push({ kind: 'num', value: Number(m[0]), pos: i });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ kind: 'name', value: m[0], pos: i });
      i += m[0].length;
    } else if ('+-*/^(),'.includes(c)) {
      tokens.push({ kind: 'op', value: c, pos: i });
      i++;
    } else {
      throw new ExpressionError(`Unexpected "${c}"`, i);
    }
  }
  tokens.push({ kind: 'end', pos: src.length });
  return tokens;
}

export function parseExpression(source: string): Node {
  const src = normalise(source);
  if (!src.trim()) throw new ExpressionError('The formula is empty', 0);
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => {
    const t = peek();
    return t.kind === 'op' && t.value === v;
  };
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExpressionError(`Expected "${v}"`, peek().pos);
    p++;
  };

  const expr = (): Node => {
    let node = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[p++] as { value: '+' | '-' }).value;
      node = { type: 'bin', op, left: node, right: term() };
    }
    return node;
  };
  const term = (): Node => {
    let node = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (tokens[p++] as { value: '*' | '/' }).value;
        node = { type: 'bin', op, left: node, right: unary() };
      } else if (peek().kind === 'name' || isOp('(')) {
        // Implicit multiplication, as written in textbooks: 4π²m → 4·π²·m, 2(x+1) → 2·(x+1).
        // It binds like '*', so π²m is (π²)·m, never π^(2m).
        node = { type: 'bin', op: '*', left: node, right: unary() };
      } else if (peek().kind === 'num') {
        // Two numbers in a row ("2 3") is a typo, not a product.
        throw new ExpressionError('Missing operator (use * to multiply)', peek().pos);
      } else {
        return node;
      }
    }
  };
  const unary = (): Node => {
    if (isOp('-')) {
      p++;
      return { type: 'neg', arg: unary() };
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  };
  const power = (): Node => {
    const base = primary();
    if (isOp('^')) {
      p++;
      return { type: 'bin', op: '^', left: base, right: unary() };
    }
    return base;
  };
  const primary = (): Node => {
    const t = peek();
    if (t.kind === 'num') {
      p++;
      return { type: 'num', value: t.value };
    }
    if (t.kind === 'name') {
      p++;
      if (isOp('(')) {
        const fn = FUNCTIONS[t.value];
        if (!fn) throw new ExpressionError(`Unknown function "${t.value}"`, t.pos);
        p++;
        const args = [expr()];
        while (isOp(',')) {
          p++;
          args.push(expr());
        }
        expect(')');
        if (args.length !== fn.arity) {
          throw new ExpressionError(`${t.value}() takes ${fn.arity} value${fn.arity > 1 ? 's' : ''}`, t.pos);
        }
        return { type: 'call', name: t.value, args, pos: t.pos };
      }
      return { type: 'var', name: t.value, pos: t.pos };
    }
    if (isOp('(')) {
      p++;
      const inner = expr();
      expect(')');
      return inner;
    }
    throw new ExpressionError(t.kind === 'end' ? 'The formula ends too early' : `Unexpected "${(t as { value: string }).value}"`, t.pos);
  };

  const root = expr();
  if (peek().kind !== 'end') {
    const t = peek() as { value?: string; pos: number };
    throw new ExpressionError(t.value === ')' ? 'Unmatched ")"' : `Unexpected "${t.value}"`, t.pos);
  }
  return root;
}

/** Variable names used by a formula (constants excluded). */
export function variablesOf(node: Node, into = new Set<string>()): Set<string> {
  switch (node.type) {
    case 'var':
      if (!(node.name in CONSTANTS)) into.add(node.name);
      break;
    case 'neg':
      variablesOf(node.arg, into);
      break;
    case 'bin':
      variablesOf(node.left, into);
      variablesOf(node.right, into);
      break;
    case 'call':
      node.args.forEach((a) => variablesOf(a, into));
      break;
  }
  return into;
}

export function evaluate(node: Node, vars: Record<string, number>): number {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'var': {
      if (node.name in vars) return vars[node.name];
      if (node.name in CONSTANTS) return CONSTANTS[node.name];
      throw new ExpressionError(`Unknown variable "${node.name}"`, node.pos);
    }
    case 'neg':
      return -evaluate(node.arg, vars);
    case 'call':
      return FUNCTIONS[node.name].fn(...node.args.map((a) => evaluate(a, vars)));
    case 'bin': {
      const a = evaluate(node.left, vars);
      const b = evaluate(node.right, vars);
      switch (node.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return a ** b;
      }
    }
  }
}

/** Parses and checks that every variable is known. Returns the AST or a student-readable error. */
export function compileFormula(
  source: string,
  known: readonly string[],
): { ok: true; node: Node; uses: string[] } | { ok: false; error: string; position: number } {
  try {
    const node = parseExpression(source);
    const uses = [...variablesOf(node)];
    const unknown = uses.find((v) => !known.includes(v));
    if (unknown) {
      return { ok: false, error: `"${unknown}" is not defined — add it as a variable or check the spelling`, position: source.indexOf(unknown) };
    }
    return { ok: true, node, uses };
  } catch (e) {
    if (e instanceof ExpressionError) return { ok: false, error: e.message, position: e.position };
    throw e;
  }
}
