const $ = (selector) => document.querySelector(selector);

document.querySelectorAll('.answers button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.answers button').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
    $('.quick-feedback').textContent = button.dataset.answer === 'false'
      ? '¡Correcto! Una conjunción con F es falsa.'
      : 'Casi: p ∧ q solo es V cuando p y q son V.';
  });
});

document.querySelectorAll('[data-practice]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-practice]').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
    const feedback = $('.practice-feedback');
    if (button.dataset.practice === 'F') {
      feedback.className = 'practice-feedback good';
      feedback.textContent = '✓ ¡Correcto! Una conjunción solo es verdadera si ambas proposiciones son verdaderas.';
    } else {
      feedback.className = 'practice-feedback bad';
      feedback.textContent = '× Aún no. Como q es F, p ∧ q = F. Ambas deben ser verdaderas.';
    }
  });
});

function normalize(expression) {
  return expression.replace(/\s/g, '').replaceAll('¬', '!').replaceAll('∧', '&').replaceAll('∨', '|').replaceAll('⊕', '^').replaceAll('→', '>').replaceAll('↔', '=');
}
function getVariables(expression) {
  return [...new Set((expression.match(/[a-z]/gi) || []).map(x => x.toLowerCase()))].sort();
}
function evaluate(expression, values) {
  let e = normalize(expression);
  e = e.replace(/[a-z]/gi, x => values[x.toLowerCase()] ? 'true' : 'false');
  // Repeatedly reduce innermost parentheses and unary/binary operations.
  const reduce = (part) => {
    part = part.replace(/!true/g, 'false').replace(/!false/g, 'true');
    const binary = /(true|false)([&|^>=])(true|false)/;
    while (binary.test(part)) part = part.replace(binary, (_, a, op, b) => {
      const A = a === 'true', B = b === 'true';
      const value = op === '&' ? A && B : op === '|' ? A || B : op === '^' ? A !== B : op === '>' ? !A || B : A === B;
      return String(value);
    });
    return part;
  };
  let previous;
  do { previous = e; e = e.replace(/\([^()]*\)/g, m => reduce(m.slice(1, -1))); e = reduce(e); } while (e !== previous);
  if (e !== 'true' && e !== 'false') throw new Error('Revisa los paréntesis y conectores de la expresión.');
  return e === 'true';
}
function displayResult() {
  const expression = $('#expression').value;
  const error = $('.calc-error');
  try {
    const vars = getVariables(expression);
    if (!vars.length) throw new Error('Usa al menos una proposición, por ejemplo p o q.');
    const values = Object.fromEntries(vars.map((v, i) => [v, i === 0]));
    const result = evaluate(expression, values);
    $('#resultValue').textContent = result ? 'V' : 'F';
    const substituted = expression.replace(/[a-z]/gi, x => values[x.toLowerCase()] ? 'V' : 'F');
    $('#procedure').textContent = `${substituted}  →  ${result ? 'V' : 'F'}`;
    error.textContent = '';
    return true;
  } catch (err) { error.textContent = err.message; return false; }
}
function generateTable() {
  const expression = $('#expression').value;
  const holder = $('#truthTable');
  try {
    const variables = getVariables(expression);
    if (!variables.length) throw new Error('Usa al menos una proposición.');
    const rows = Array.from({ length: 2 ** variables.length }, (_, index) => {
      const values = Object.fromEntries(variables.map((variable, n) => [variable, !(index & (1 << (variables.length - n - 1)))]));
      return `<tr>${variables.map(v => `<td>${values[v] ? 'V' : 'F'}</td>`).join('')}<td>${evaluate(expression, values) ? 'V' : 'F'}</td></tr>`;
    }).join('');
    holder.innerHTML = `<table class="truth-table"><thead><tr>${variables.map(v => `<th>${v}</th>`).join('')}<th>${expression}</th></tr></thead><tbody>${rows}</tbody></table>`;
    holder.hidden = false;
    $('.calc-error').textContent = '';
  } catch (err) { $('.calc-error').textContent = err.message; }
}
if ($('#solve')) $('#solve').addEventListener('click', displayResult);
if ($('#generateTable')) $('#generateTable').addEventListener('click', () => { if (displayResult()) generateTable(); });
