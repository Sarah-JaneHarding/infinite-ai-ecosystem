  var CLS = IAI.CLS;
  var timer = null;
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', question: 'Which animal do you like best?', choicesText: 'Lion\nZebra\nGiraffe\nMeerkat', countsText: '4 2 3 3', graph: 'yes' }; }
  function ch(t) { return String(t || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function cnt(t) { return String(t || '').split(/[\s,;]+/).filter(Boolean).map(Number); }
  var cfg = {
    title: 'Ask the class one question, <span class="arc">tally, and show the graph.</span>',
    lead: 'Type a question and two to four choices in any language. Tap a choice each time a hand goes up (the minus button corrects a mistake). Show or hide the bar graph. The summary holds the question, the counts and the total. No individual answer is recorded.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'question', 'choicesText'], piiTarget: 'question', changeTarget: { path: 'question', value: 'Which animal do you like least?' },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<label for="qq">Question (any language)</label><input id="qq" style="width:100%" maxlength="120"><label for="cc">Choices, one per line (2 to 4)</label><textarea id="cc" style="min-height:80px"></textarea>' +
        '<div class="grid2"><div><label for="ct">Counts (filled in by the board)</label><input id="ct" style="width:100%"></div><div><label for="gs">Graph</label><select id="gs" style="width:100%"><option value="yes">Show</option><option value="no">Hide</option></select></div></div>' +
        '<div id="board" class="cls-board" aria-label="Survey board">' + CLS.chrome() + '<div id="tm"></div><div class="cls-big" id="bq" style="font-size:2rem"></div><div id="bc" class="cls-score"></div><div id="bg" class="cls-bars" aria-label="Graph"></div></div>';
      CLS.bindChrome($('#board')); timer = CLS.timer($('#tm'), 'chime'); ['qq', 'cc', 'ct'].forEach(function (i) { $('#' + i).oninput = draw; }); $('#gs').onchange = draw; draw();
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#qq').value = s.question; $('#cc').value = s.choicesText; $('#ct').value = s.countsText; $('#gs').value = s.graph; draw(); },
    reset: function () { ['#cl', '#dt', '#qq', '#cc', '#ct'].forEach(function (i) { $(i).value = ''; }); draw(); },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, question: $('#qq').value.trim(), choicesText: $('#cc').value, countsText: $('#ct').value, graph: $('#gs').value }; },
    validateInput: function (i) {
      var e = []; if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.'); if (!i.question) e.push('Enter the question.');
      var c = ch(i.choicesText); if (c.length < 2 || c.length > 4) e.push('Give from 2 to 4 choices.'); else { var n = cnt(i.countsText); if (i.countsText.trim() && n.length !== c.length) e.push('There are ' + n.length + ' count(s) for ' + c.length + ' choice(s).'); else if (n.some(function (x) { return isNaN(x) || x < 0 || x % 1; })) e.push('Counts must be whole numbers, zero or more.'); }
      return e;
    },
    run: function (input) {
      var c = ch(input.choicesText), n = cnt(input.countsText); if (!n.length) n = c.map(function () { return 0; }); var tot = n.reduce(function (s, x) { return s + x; }, 0), flags = [];
      if (!tot) flags.push({ type: 'no_votes', text: 'No votes were counted.' });
      var top = Math.max.apply(null, n); if (tot && n.filter(function (x) { return x === top; }).length > 1) flags.push({ type: 'tie', text: 'Two or more choices are level at the top.' });
      return { event: 'tb.survey.tallied', payload: { class: input.cls, date: input.date, question: input.question, choices: c.map(function (x, k) { return { text: x, count: n[k] }; }), total: tot, graphShown: input.graph === 'yes', rules: 'Counts only. Who chose what is not recorded.', flags: flags } };
    },
    renderPreview: function (env, el) {
      var p = env.payload, mx = Math.max.apply(null, p.choices.map(function (x) { return x.count; })) || 1;
      el.innerHTML = '<h3>' + esc(p.question) + '</h3><p class="cap">Class ' + esc(p.class) + ' · ' + esc(p.date) + ' · ' + p.total + ' vote(s)</p>' + CE.table([{ key: 'c', label: 'Choice' }, { key: 'n', label: 'Count' }], p.choices.map(function (x) { return { c: x.text, n: x.count }; })) + (p.graphShown ? '<div class="cls-bars" aria-hidden="true">' + p.choices.map(function (x, k) { return '<div style="width:' + Math.max(4, Math.round(x.count / mx * 100)) + '%;--bc:' + CLS.COLORS[(k * 3 + 3) % 10] + '">' + esc(x.text) + ' ' + x.count + '</div>'; }).join('') + '</div>' : '') + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>' + e.payload.total + ' vote(s) on ' + e.payload.choices.length + ' choices. Approving releases <code>tb.survey.tallied</code>.</p>'; }
  };
  function draw() {
    var c = ch($('#cc').value).slice(0, 4), n = cnt($('#ct').value); while (n.length < c.length) n.push(0); n = n.slice(0, c.length).map(function (x) { return isNaN(x) ? 0 : x; });
    $('#bq').textContent = $('#qq').value; var box = $('#bc'); box.innerHTML = ''; var mx = Math.max.apply(null, n.concat([1]));
    c.forEach(function (x, k) {
      var d = document.createElement('div'); d.className = 'cls-team'; d.style.setProperty('--tc', CLS.COLORS[(k * 3 + 3) % 10]);
      d.innerHTML = '<strong>' + esc(x) + '</strong><div class="n" aria-live="polite">' + n[k] + '</div><div><button type="button" data-d="-1" aria-label="Take one from ' + esc(x) + '">&minus;</button> <button type="button" data-d="1" aria-label="Add one to ' + esc(x) + '">+</button></div>';
      [].slice.call(d.querySelectorAll('button')).forEach(function (b) { b.onclick = function () { var v = cnt($('#ct').value); while (v.length < c.length) v.push(0); v[k] = Math.max(0, (v[k] || 0) + (+b.dataset.d)); $('#ct').value = v.slice(0, c.length).join(' '); draw(); }; }); box.appendChild(d);
    });
    $('#bg').innerHTML = $('#gs').value === 'yes' ? c.map(function (x, k) { return '<div style="width:' + Math.max(4, Math.round(n[k] / mx * 100)) + '%;--bc:' + CLS.COLORS[(k * 3 + 3) % 10] + '">' + esc(x) + ' ' + n[k] + '</div>'; }).join('') : '';
  }
