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
function operationNodes(node, list = [], seen = new Set()) {
  if (node.child) operationNodes(node.child, list, seen);
  if (node.left) operationNodes(node.left, list, seen);
  if (node.right) operationNodes(node.right, list, seen);
  if (node.type !== 'var') {
    const label = source(node);
    if (!seen.has(label)) { seen.add(label); list.push(node); }
  }
  return list;
}
function evaluate(node, values, steps) {
  if (node.type === 'var') return values[node.name];
  if (node.type === 'not') {
    const child = evaluate(node.child, values, steps), value = !child;
    if (steps) steps.push({ operation: `¬${truth(child)} = ${truth(value)}`, explanation: `La negación cambia el valor de verdad: ¬${truth(child)} da ${truth(value)}.` });
    return value;
  }
  const left = evaluate(node.left, values, steps), right = evaluate(node.right, values, steps);
  const value = node.op === '∧' ? left && right : node.op === '∨' ? left || right : node.op === '⊕' ? left !== right : node.op === '→' ? !left || right : left === right;
  if (steps) {
    const explanations = {
      '∧': value ? 'La conjunción es verdadera porque ambas proposiciones son verdaderas.' : 'La conjunción es falsa porque no ambas proposiciones son verdaderas.',
      '∨': value ? 'La disyunción es verdadera porque al menos una proposición es verdadera.' : 'La disyunción es falsa porque ambas proposiciones son falsas.',
      '⊕': value ? 'La disyunción fuerte es verdadera porque exactamente una proposición es verdadera.' : 'La disyunción fuerte es falsa porque ambas proposiciones tienen el mismo valor.',
      '→': value ? (left ? 'La implicación es verdadera porque se cumplen la condición y la consecuencia.' : 'La implicación es verdadera porque la condición inicial es falsa.') : 'La implicación es falsa porque la condición es verdadera y la consecuencia es falsa.',
      '↔': value ? 'La equivalencia es verdadera porque ambas proposiciones tienen el mismo valor.' : 'La equivalencia es falsa porque las proposiciones tienen valores distintos.'
    };
    steps.push({ operation: `${truth(left)} ${node.op} ${truth(right)} = ${truth(value)}`, explanation: explanations[node.op] });
  }
  return value;
}
function display(node, values) { if (node.type === 'var') return truth(values[node.name]); if (node.type === 'not') return `¬${node.child.type === 'var' ? display(node.child, values) : `(${display(node.child, values)})`}`; return `(${display(node.left, values)} ${node.op} ${display(node.right, values)})`; }

function renderSolution() {
  const field = $('#expression'), error = $('.calc-error'), solution = $('#solution');
  try {
    const tree = parse(field.value), vars = variables(tree), operations = operationNodes(tree);
    const rows = Array.from({ length: 2 ** vars.length }, (_, index) => Object.fromEntries(vars.map((name, n) => [name, !(index & (1 << (vars.length - n - 1)))])));
    const selected = rows[0], steps = [], result = evaluate(tree, selected, steps);
    $('#resultValue').textContent = truth(result);
    $('#valuesBar').innerHTML = vars.map(name => `<span><b>${name}</b> = ${truth(selected[name])}</span>`).join('');
    $('#procedure').innerHTML = [`<div class="step expression-step"><span>Sustitución</span><div><b>${display(tree, selected)}</b><small>Reemplazamos cada proposición por su valor de verdad.</small></div></div>`, ...steps.map((step, index) => `<div class="step"><span>Paso ${index + 1}</span><div><b>${step.operation}</b><small>${step.explanation}</small></div></div>`), `<div class="step final-step"><span>Resultado</span><div><b>${source(tree)} = ${truth(result)}</b><small>El valor final de la expresión es ${truth(result)} (${result ? 'verdadero' : 'falso'}).</small></div></div>`].join('');
    $('#tableDescription').textContent = `Se evalúan las ${2 ** vars.length} combinaciones posibles de ${vars.join(', ')} y cada operación intermedia.`;
    $('#rowCount').textContent = `${2 ** vars.length} filas`;
    $('#truthTable').innerHTML = `<table class="truth-table detailed-table"><thead><tr>${vars.map(name => `<th>${name}</th>`).join('')}${operations.map(node => `<th>${source(node)}</th>`).join('')}</tr></thead><tbody>${rows.map(values => `<tr>${vars.map(name => `<td>${truth(values[name])}</td>`).join('')}${operations.map(node => `<td>${truth(evaluate(node, values))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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

function setupRandomPractice() {
  if (!$('#newRandom')) return;
  const rules = {
    '∧': [ (p, q) => p && q, value => value ? 'La conjunción es verdadera porque p y q son verdaderas.' : 'La conjunción es falsa porque al menos una de las proposiciones es falsa.' ],
    '∨': [ (p, q) => p || q, value => value ? 'La disyunción es verdadera porque al menos una proposición es verdadera.' : 'La disyunción es falsa porque ambas proposiciones son falsas.' ],
    '⊕': [ (p, q) => p !== q, value => value ? 'La disyunción fuerte es verdadera porque exactamente una proposición es verdadera.' : 'La disyunción fuerte es falsa porque p y q tienen el mismo valor.' ],
    '→': [ (p, q) => !p || q, value => value ? 'La implicación es verdadera; solo sería falsa si p fuera V y q fuera F.' : 'La implicación es falsa porque p es V y q es F.' ],
    '↔': [ (p, q) => p === q, value => value ? 'La equivalencia es verdadera porque p y q tienen el mismo valor.' : 'La equivalencia es falsa porque p y q tienen valores diferentes.' ]
  };
  const symbols = Object.keys(rules); let random, complete;
  const create = () => { const symbol = symbols[Math.floor(Math.random() * symbols.length)], p = Math.random() < .5, q = Math.random() < .5, rule = rules[symbol]; return { symbol, p, q, result: rule[0](p, q), explain: rule[1] }; };
  const message = item => `<b>p ${item.symbol} q = ${truth(item.p)} ${item.symbol} ${truth(item.q)} = ${truth(item.result)}</b><br>${item.explain(item.result)}`;
  const renderRandom = () => {
    random = create(); $('#randomFeedback').className = 'practice-feedback'; $('#randomFeedback').innerHTML = '';
    $('#randomQuestion').innerHTML = `<p>Si <b>p = ${truth(random.p)}</b> y <b>q = ${truth(random.q)}</b>, ¿cuál es el valor de:</p><strong>p ${random.symbol} q</strong>`;
    $('#randomOptions').innerHTML = '<button data-value="V">V &nbsp; Verdadero</button><button data-value="F">F &nbsp; Falso</button>';
    $('#randomOptions').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const correct = button.dataset.value === truth(random.result); $('#randomOptions').querySelectorAll('button').forEach(item => item.disabled = true);
      button.classList.add(correct ? 'correct' : 'incorrect'); $('#randomOptions').querySelector(`[data-value="${truth(random.result)}"]`).classList.add('correct');
      $('#randomFeedback').className = `practice-feedback ${correct ? 'good' : 'bad'}`; $('#randomFeedback').innerHTML = `<span>${correct ? '✓ ¡Correcto!' : '× Aún no.'}</span>${message(random)}`;
    }));
  };
  const renderComplete = () => { complete = create(); $('#completeAnswer').value = ''; $('#completeFeedback').className = 'practice-feedback'; $('#completeFeedback').innerHTML = ''; $('#completeQuestion').innerHTML = `<p>Si <b>p = ${truth(complete.p)}</b> y <b>q = ${truth(complete.q)}</b>, completa:</p><strong>${truth(complete.p)} ${complete.symbol} ${truth(complete.q)} = ?</strong>`; };
  $('#newRandom').addEventListener('click', renderRandom); $('#newComplete').addEventListener('click', renderComplete);
  $('#checkComplete').addEventListener('click', () => { const response = $('#completeAnswer').value.trim().toUpperCase(), correct = response === truth(complete.result), feedback = $('#completeFeedback'); if (!['V', 'F'].includes(response)) { feedback.className = 'practice-feedback bad'; feedback.innerHTML = '<span>×</span> Escribe únicamente V o F.'; return; } feedback.className = `practice-feedback ${correct ? 'good' : 'bad'}`; feedback.innerHTML = `<span>${correct ? '✓ ¡Correcto!' : '× Aún no.'}</span>${message(complete)}`; });
  $('#completeAnswer').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^VF]/g, ''); });
  renderRandom(); renderComplete();
}
setupRandomPractice();

function setupGuidedPractice() {
  const card = document.querySelector('.practice-page .practice-card');
  if (!card) return;
  const exercises = [
    { title: 'CONJUNCIÓN', p: true, q: false, operator: '∧', answer: false, why: 'Una conjunción solo es verdadera cuando p y q son verdaderas. Como q es F, V ∧ F = F.' },
    { title: 'DISYUNCIÓN', p: false, q: true, operator: '∨', answer: true, why: 'Una disyunción es verdadera si al menos una proposición es verdadera. Aquí q es V, por eso F ∨ V = V.' },
    { title: 'DISYUNCIÓN FUERTE', p: true, q: true, operator: '⊕', answer: false, why: 'La disyunción fuerte solo es verdadera cuando exactamente una proposición es verdadera. Como ambas son V, V ⊕ V = F.' },
    { title: 'IMPLICACIÓN', p: true, q: false, operator: '→', answer: false, why: 'Una implicación solo es falsa cuando la condición es V y la consecuencia es F. Por eso V → F = F.' },
    { title: 'EQUIVALENCIA', p: false, q: false, operator: '↔', answer: true, why: 'La equivalencia es verdadera cuando ambas proposiciones tienen el mismo valor. Como ambas son F, F ↔ F = V.' }
  ];
  let current = 0;
  const answered = Array(exercises.length).fill(false);
  const progressNumber = document.querySelector('.practice-page .progress b');
  const progressFill = document.querySelector('.practice-page .progress i i');
  const render = () => {
    const item = exercises[current], result = truth(item.answer);
    if (progressNumber) progressNumber.textContent = `${current + 1} de ${exercises.length}`;
    if (progressFill) progressFill.style.width = `${((current + 1) / exercises.length) * 100}%`;
    card.innerHTML = `<div class="exercise-top"><span class="practice-label">EJERCICIO ${current + 1} · ${item.title}</span><span class="exercise-count">${current + 1}/${exercises.length}</span></div><h3>Si p = ${truth(item.p)} y q = ${truth(item.q)},<br>¿p ${item.operator} q es…?</h3><div class="option-list guided-options"><button data-guided="V">V &nbsp; Verdadero</button><button data-guided="F">F &nbsp; Falso</button></div><div class="practice-feedback" aria-live="polite"></div><div class="exercise-navigation"><button id="previousExercise" ${current === 0 ? 'disabled' : ''}>← Anterior</button><button id="nextExercise" ${answered[current] ? '' : 'disabled'}>${current === exercises.length - 1 ? 'Volver al inicio' : 'Siguiente'} →</button></div>`;
    card.querySelectorAll('[data-guided]').forEach(button => button.addEventListener('click', () => {
      const correct = button.dataset.guided === result, feedback = card.querySelector('.practice-feedback');
      card.querySelectorAll('[data-guided]').forEach(itemButton => itemButton.disabled = true);
      answered[current] = true; card.querySelector('#nextExercise').disabled = false;
      button.classList.add(correct ? 'correct' : 'incorrect'); card.querySelector(`[data-guided="${result}"]`).classList.add('correct');
      feedback.className = `practice-feedback ${correct ? 'good' : 'bad'}`; feedback.innerHTML = `<span>${correct ? '✓ ¡Correcto!' : '× Aún no.'}</span><b>p ${item.operator} q = ${truth(item.p)} ${item.operator} ${truth(item.q)} = ${result}</b><br>${item.why}`;
    }));
    card.querySelector('#previousExercise').addEventListener('click', () => { if (current) { current--; render(); } });
    card.querySelector('#nextExercise').addEventListener('click', () => { current = current === exercises.length - 1 ? 0 : current + 1; render(); });
  };
  render();
}
setupGuidedPractice();
