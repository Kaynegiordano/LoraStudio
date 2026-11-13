// Petits composants façon Forge, repris du Studio IA de KaneApp (studio.js) : mêmes classes CSS fx-*.
'use strict';
(() => {
  const h = KS.h, U = KS.util;
  const save = () => {};          // le Studio enregistrait ici ses réglages ; chaque atelier enregistre les siens
  /* ---------------------------------------------------------------- petits composants façon Forge */
  const field = (label, ctl, tip) => h('div.fx-field', { title: tip || '' }, label ? h('label.fx-lbl', { text: label }) : null, ctl);
  const row2 = (...a) => h('div.fx-row2', ...a);
  const row3 = (...a) => h('div.fx-row3', ...a);
  const ebtn = (emoji, tip, fn, cls = '') => { const b = h('button.fx-ebtn' + cls, { text: emoji, title: tip }); b.addEventListener('click', fn); return b; };
  const tbtn = (label, fn, cls = '', tip = '') => { const b = h('button.fx-btn2' + cls, { text: label, title: tip }); b.addEventListener('click', fn); return b; };
  // bouton à icône (Studio 2) : le libellé est dans l'info-bulle et pour les lecteurs d'écran
  const ibtn = (icon, tip, fn, cls = '') => { const b = h('button.fx-ibtn' + cls, { title: tip, 'aria-label': tip, type: 'button' }); b.innerHTML = KS.icon(icon); b.addEventListener('click', fn); return b; };
  // section du volet de réglages : un titre discret, pas de cadre
  const sect = (title, ...kids) => h('section.fx-sect', h('div.fx-sect-h', { text: title }), ...kids.flat().filter(Boolean));
  function slider(label, obj, key, min, max, step, tip, onChange) {
    const num = h('input.fx-num', { type: 'number', min, max, step, value: obj[key] });
    const rng = h('input.fx-rng', { type: 'range', min, max, step, value: obj[key] });
    const fill = () => rng.style.setProperty('--p', ((U.clamp(+obj[key], min, max) - min) / (max - min) * 100) + '%');
    const set = (v, from) => {
      v = +v; if (isNaN(v)) { num.value = obj[key]; return; }
      obj[key] = v; if (from !== num) num.value = v; if (from !== rng) rng.value = v;
      fill(); save(); onChange && onChange(v);
    };
    num.addEventListener('change', () => set(num.value, num));
    rng.addEventListener('input', () => set(rng.value, rng));
    fill();
    const el = h('div.fx-field.fx-slider', { title: tip || '' }, h('div.fx-sh', h('label.fx-lbl', { text: label }), num), rng);
    el.set = v => set(v);
    return el;
  }
  function select(label, options, obj, key, tip, onChange) {
    const s = h('select.fx-sel');
    for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; s.appendChild(h('option', { value: v, text: l })); }
    const cur = obj[key] == null ? '' : String(obj[key]);
    if (cur && ![...s.options].some(o => o.value === cur)) s.appendChild(h('option', { value: cur, text: cur }));
    s.value = cur;
    s.addEventListener('change', () => { obj[key] = s.value; save(); onChange && onChange(s.value); });
    return label ? field(label, s, tip) : s;
  }
  function radio(label, options, obj, key, tip, onChange) {
    const box = h('div.fx-radio');
    for (const [v, l] of options) {
      const b = h('label.fx-ropt' + (obj[key] === v ? '.on' : ''), h('input', { type: 'radio', checked: obj[key] === v, tabIndex: -1 }), h('span', { text: l }));
      b.addEventListener('click', e => {
        e.preventDefault(); obj[key] = v; save();
        box.querySelectorAll('.fx-ropt').forEach(x => { x.classList.toggle('on', x === b); x.querySelector('input').checked = x === b; });
        onChange && onChange(v);
      });
      box.appendChild(b);
    }
    return field(label, box, tip);
  }
  function check(label, obj, key, tip, onChange) {
    const i = h('input', { type: 'checkbox', checked: !!obj[key] });
    i.addEventListener('change', () => { obj[key] = i.checked; save(); onChange && onChange(i.checked); });
    return h('label.fx-check', { title: tip || '' }, i, h('span', { text: label }));
  }
  function text(label, obj, key, { rows = 2, placeholder = '', tip, onInput } = {}) {
    const t = h(rows > 1 ? 'textarea.fx-ta.fx-small' : 'input.fx-in', { rows, placeholder, spellcheck: false });
    t.value = obj[key] == null ? '' : obj[key];
    t.addEventListener('input', () => { obj[key] = t.value; save(); onInput && onInput(t.value); });
    return label ? field(label, t, tip) : t;
  }
  function tabs(list, cur, onChange, cls = '') {
    const bar = h('div.fx-tabs' + cls);
    for (const [v, l] of list) { const b = h('button' + (v === cur ? '.on' : ''), { text: l }); b.addEventListener('click', () => onChange(v)); bar.appendChild(b); }
    return bar;
  }
  // Accordéon de Forge (InputAccordion : case à cocher dans l'en-tête quand `on` est donné)
  function acc(title, st, key, body, { on, tip, active } = {}) {
    const open = !!st.open[key];
    const head = h('div.fx-acc-h', { title: tip || '' });
    const el = h('div.fx-acc' + (open ? '.open' : '') + ((on ? on[0][on[1]] : active) ? '.active' : ''), head);
    if (on) {
      const i = h('input', { type: 'checkbox', checked: !!on[0][on[1]] });
      i.addEventListener('click', e => e.stopPropagation());
      i.addEventListener('change', () => { on[0][on[1]] = i.checked; save(); el.classList.toggle('active', i.checked); });
      head.append(i);
    }
    head.append(h('span.fx-acc-t', { text: title }), h('span.fx-acc-a', { html: KS.icon(open ? 'chevron-down' : 'chevron-right') }));
    head.addEventListener('click', () => { st.open[key] = !open; save(); renderParams(); });
    if (open) el.appendChild(h('div.fx-acc-b', ...[].concat(typeof body === 'function' ? body() : body)));
    return el;
  }
  const md = t => String(t || '').replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  const tokens = t => (String(t || '').replace(/<[^>]+>/g, ' ').match(/[A-Za-zÀ-ÿ]+|\d|[^\sA-Za-zÀ-ÿ\d]/g) || []).length;
  KS.fxui = { field, row2, row3, ebtn, tbtn, slider, select, radio, check, text, tabs, md };
})();
