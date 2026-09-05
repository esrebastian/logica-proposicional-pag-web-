const $ = (selector) => document.querySelector(selector);
const truth = value => value ? 'V' : 'F';

document.querySelectorAll('[data-practice]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-practice]').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  const feedback = $('.practice-feedback');
  const correct = button.dataset.practice === 'F';
  feedback.className = `practice-feedback ${correct ? 'good' : 'bad'}`;
  feedback.textContent = correct ? '✓ ¡Correcto! Una conjunción solo es verdadera si ambas proposiciones son verdaderas.' : '× Como q es F, p ∧ q = F. Ambas proposiciones deben ser verdaderas.';
}));

// Analizador recursivo: ¬ tiene prioridad, luego ∧, ∨/⊕, → y ↔.
function tokenize(text) {
  const allowed = /^[pqrst¬∧∨⊕→↔()\s]*$/i;
  if (!allowed.test(text)) throw new Error('Solo se permiten p, q, r, s, t, paréntesis y conectores lógicos.');
  const raw = text.replace(/\s/g, '').match(/[pqrst]|¬|∧|∨|⊕|→|↔|[()]/gi) || [];
  // La yuxtaposición se interpreta como conjunción: p ¬q equivale a p ∧ ¬q.
  const isEnd = token => /^[pqrst]$/i.test(token) || token === ')';
  const isStart = token => /^[pqrst]$/i.test(token) || token === '¬' || token === '(';
  return raw.reduce((tokens, token) => {
    if (tokens.length && isEnd(tokens[tokens.length - 1]) && isStart(token)) tokens.push('∧');
    tokens.push(token);
    return tokens;
  }, []);
}
function parse(text) {
  const tokens = tokenize(text); let position = 0;
  if (!tokens.length) throw new Error('Construye una expresión antes de resolver.');
  const peek = () => tokens[position]; const eat = token => peek() === token && (position++, true);
  const primary = () => {
    if (/^[pqrst]$/i.test(peek() || '')) return { type: 'var', name: tokens[position++].toLowerCase() };
    if (eat('(')) {
      const inside = equivalence();
      if (!eat(')')) {
        if (/^[pqrst¬(]$/i.test(peek() || '')) throw new Error('Falta un conector lógico entre las proposiciones. Por ejemplo: p ∧ ¬q.');
        throw new Error('Falta cerrar un paréntesis.');
      }
      return inside;
    }
    throw new Error('La expresión está incompleta o tiene un operador en una posición no válida.');
  };
  const negation = () => eat('¬') ? { type: 'not', child: negation() } : primary();
  const and = () => { let node = negation(); while (eat('∧')) node = { type: 'op', op: '∧', left: node, right: negation() }; return node; };
  const or = () => { let node = and(); while (peek() === '∨' || peek() === '⊕') { const op = tokens[position++]; node = { type: 'op', op, left: node, right: and() }; } return node; };
  const implication = () => { const left = or(); return eat('→') ? { type: 'op', op: '→', left, right: implication() } : left; };
  const equivalence = () => { let node = implication(); while (eat('↔')) node = { type: 'op', op: '↔', left: node, right: implication() }; return node; };
  const tree = equivalence();
  if (position !== tokens.length) {
    if (/^[pqrst¬(]$/i.test(peek() || '')) throw new Error('Falta un conector lógico entre las proposiciones. Por ejemplo: p ∧ ¬q.');
    throw new Error('Revisa el orden de los conectores y paréntesis.');
  }
  return tree;
}
function variables(node, set = new Set()) { if (node.type === 'var') set.add(node.name); if (node.child) variables(node.child, set); if (node.left) variables(node.left, set); if (node.right) variables(node.right, set); return [...set].sort(); }
function source(node) { if (node.type === 'var') return node.name; if (node.type === 'not') return `¬${node.child.type === 'var' ? source(node.child) : `(${source(node.child)})`}`; return `(${source(node.left)} ${node.op} ${source(node.right)})`; }
function evaluate(node, values, steps) {
  if (node.type === 'var') return values[node.name];
  if (node.type === 'not') { const value = !evaluate(node.child, values, steps); if (steps) steps.push(`${display(node.child, values)}  →  ${truth(value)}`); return value; }
  const left = evaluate(node.left, values, steps), right = evaluate(node.right, values, steps);
  const value = node.op === '∧' ? left && right : node.op === '∨' ? left || right : node.op === '⊕' ? left !== right : node.op === '→' ? !left || right : left === right;
  if (steps) steps.push(`${display(node.left, values)} ${node.op} ${display(node.right, values)}  →  ${truth(value)}`);
  return value;
}
function display(node, values) { if (node.type === 'var') return truth(values[node.name]); if (node.type === 'not') return `¬${node.child.type === 'var' ? display(node.child, values) : `(${display(node.child, values)})`}`; return `(${display(node.left, values)} ${node.op} ${display(node.right, values)})`; }

function renderSolution() {
  const field = $('#expression'), error = $('.calc-error'), solution = $('#solution');
  try {
    const tree = parse(field.value), vars = variables(tree);
    const rows = Array.from({ length: 2 ** vars.length }, (_, index) => Object.fromEntries(vars.map((name, n) => [name, !(index & (1 << (vars.length - n - 1)))])));
    const selected = rows[0], steps = [], result = evaluate(tree, selected, steps);
    $('#resultValue').textContent = truth(result);
    $('#valuesBar').innerHTML = vars.map(name => `<span><b>${name}</b> = ${truth(selected[name])}</span>`).join('');
    $('#procedure').innerHTML = [`<div class="step expression-step"><span>Expresión</span><b>${display(tree, selected)}</b></div>`, ...steps.map((step, index) => `<div class="step"><span>${index + 1}</span><b>${step}</b></div>`), `<div class="step final-step"><span>Final</span><b>${source(tree)} = ${truth(result)}</b></div>`].join('');
    $('#tableDescription').textContent = `Se evalúan las ${2 ** vars.length} combinaciones posibles de ${vars.join(', ')}.`;
    $('#rowCount').textContent = `${2 ** vars.length} filas`;
    $('#truthTable').innerHTML = `<table class="truth-table"><thead><tr>${vars.map(name => `<th>${name}</th>`).join('')}<th>${source(tree)}</th></tr></thead><tbody>${rows.map(values => `<tr>${vars.map(name => `<td>${truth(values[name])}</td>`).join('')}<td>${truth(evaluate(tree, values))}</td></tr>`).join('')}</tbody></table>`;
    error.textContent = ''; solution.hidden = false; solution.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (exception) { error.textContent = exception.message; solution.hidden = true; }
}
if ($('#expression')) {
  const field = $('#expression');
  const allowedCharacters = /^[pqrst¬∧∨⊕→↔()\s]*$/i;
  const normalizeSymbols = value => value
    .replaceAll('<->', '↔')
    .replaceAll('->', '→')
    .replaceAll('!', '¬')
    .replaceAll('&', '∧')
    .replaceAll('|', '∨')
    .replaceAll('^', '⊕');
  const insertAtCursor = text => {
    const start = field.selectionStart, end = field.selectionEnd;
    field.setRangeText(text, start, end, 'end');
    field.focus();
  };
  document.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => { insertAtCursor(button.dataset.key); $('.calc-error').textContent = ''; }));
  field.addEventListener('input', () => {
    const normalized = normalizeSymbols(field.value);
    if (field.value !== normalized || !allowedCharacters.test(normalized)) {
      const cursor = field.selectionStart;
      field.value = [...normalized].filter(character => /[pqrst¬∧∨⊕→↔()\s]/i.test(character)).join('');
      field.setSelectionRange(Math.min(cursor, field.value.length), Math.min(cursor, field.value.length));
    }
    // La edición es silenciosa: los avisos de cálculo aparecen solo al resolver.
    $('.calc-error').textContent = '';
  });
  $('#backspace').addEventListener('click', () => {
    const start = field.selectionStart, end = field.selectionEnd;
    if (start !== end) field.setRangeText('', start, end, 'start');
    else if (start > 0) field.setRangeText('', start - 1, start, 'start');
    field.focus();
  });
  $('#clear').addEventListener('click', () => { field.value = ''; $('#solution').hidden = true; $('.calc-error').textContent = ''; });
  $('#solve').addEventListener('click', renderSolution);
}
