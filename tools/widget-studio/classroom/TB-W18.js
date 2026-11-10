  var CLS = IAI.CLS;
  var timer = null;
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', teams: 3, namesText: 'Lions\nZebras\nGiraffes', increment: '5', scoresText: '25 10 15', movesText: '5' }; }
  function ints(t) { return String(t || '').split(/[\s,;]+/).filter(Boolean).map(Number); }
  function nm(t, n) { var a = String(t || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), o = []; for (var k = 0; k < n; k++) o.push(a[k] || 'Team ' + (k + 1)); return o; }
  function bad(i) {
    var e = []; if (!i.teams || i.teams < 2 || i.teams > 6 || i.teams % 1) e.push('Teams or players must be a whole number from 2 to 6.');
    var inc = +i.increment; if (!inc || inc < 1 || inc > 1000 || inc % 1) e.push('The score step must be a whole number from 1 to 1000.');
    var s = ints(i.scoresText); if (i.teams && s.length !== i.teams) e.push('There are ' + s.length + ' score(s) for ' + i.teams + ' team(s).'); else if (s.some(function (x) { return isNaN(x) || x % 1; })) e.push('Scores must be whole numbers.');
    var m = i.movesText === '' ? 0 : +i.movesText; if (isNaN(m) || m < 0 || m % 1) e.push('The number of changes must be a whole number.');
    return e;
  }
  var cfg = {
    title: 'Keep score for up to six teams, <span class="arc">up or down, by any step.</span>',
    lead: 'Name the teams in any language, choose the step (1, 2, 5, 10 or your own), and use the plus and minus buttons on the board. An optional timer runs beside the scores. The summary lists the final scores by team name.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'teams', 'increment'], piiTarget: 'namesText', changeTarget: { path: 'cls', value: 'Gr2B' },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<div class="grid2"><div><label for="tc">Number of teams (2 to 6)</label><input id="tc" type="number" min="2" max="6" style="width:100%"></div><div><label for="ic">Score step</label><select id="ic" style="width:100%"><option>1</option><option>2</option><option>5</option><option>10</option><option>25</option><option>100</option></select></div></div>' +
        '<label for="tn">Team names, one per line (any language). Use team names, not learner names.</label><textarea id="tn" style="min-height:90px"></textarea>' +
        '<div class="grid2"><div><label for="sc">Scores (filled in by the board)</label><input id="sc" style="width:100%"></div><div><label for="mv">Changes made</label><input id="mv" style="width:100%" value="0"></div></div>' +
        '<div id="board" class="cls-board" aria-label="Score board">' + CLS.chrome() + '<div id="tm"></div><div id="teams" class="cls-score"></div></div>';
      CLS.bindChrome($('#board')); timer = CLS.timer($('#tm'), 'buzzer'); ['tc', 'tn', 'sc'].forEach(function (i) { $('#' + i).oninput = draw; }); $('#tc').onchange = function () { fit(); draw(); }; draw();
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#tc').value = s.teams; $('#tn').value = s.namesText; $('#ic').value = s.increment; $('#sc').value = s.scoresText; $('#mv').value = s.movesText; draw(); },
    reset: function () { ['#cl', '#dt', '#tc', '#tn', '#sc'].forEach(function (i) { $(i).value = ''; }); $('#mv').value = '0'; draw(); },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, teams: +$('#tc').value || null, namesText: $('#tn').value, increment: $('#ic').value, scoresText: $('#sc').value, movesText: $('#mv').value }; },
    validateInput: function (i) { var e = bad(i); if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.'); return e; },
    run: function (input) {
      var n = nm(input.namesText, input.teams), s = ints(input.scoresText), flags = [], t = n.map(function (x, k) { return { name: x, score: s[k] }; });
      var top = Math.max.apply(null, s), lead = t.filter(function (x) { return x.score === top; }); if (lead.length > 1) flags.push({ type: 'tie', text: lead.length + ' teams are level at the top.' });
      return { event: 'tb.scores.recorded', payload: { class: input.cls, date: input.date, teams: t, scoreStep: +input.increment, changesMade: +input.movesText || 0, topScore: top, rules: 'Scores belong to the teams named on the board. No individual learner is scored or ranked here.', flags: flags } };
    },
    renderPreview: function (env, el) {
      var p = env.payload; el.innerHTML = '<h3>Class ' + esc(p.class) + ' · ' + esc(p.date) + ' · step ' + p.scoreStep + '</h3>' + CE.table([{ key: 'n', label: 'Team' }, { key: 's', label: 'Score' }], p.teams.map(function (x) { return { n: x.name, s: x.score }; })) + '<p class="cap">' + p.changesMade + ' change(s) made.</p>' + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>Scores for ' + e.payload.teams.length + ' team(s). Approving releases <code>tb.scores.recorded</code>.</p>'; }
  };
  function fit() { var n = +$('#tc').value, s = ints($('#sc').value); if (!n) return; while (s.length < n) s.push(0); $('#sc').value = s.slice(0, n).join(' '); }
  function draw() {
    var i = cfg.collectInput(), box = $('#teams'); box.innerHTML = ''; if (!i.teams || i.teams < 2 || i.teams > 6) return; var n = nm(i.namesText, i.teams), s = ints(i.scoresText); if (s.length !== i.teams) { fit(); s = ints($('#sc').value); }
    n.forEach(function (name, k) {
      var d = document.createElement('div'); d.className = 'cls-team'; d.style.setProperty('--tc', CLS.COLORS[k % CLS.COLORS.length]);
      d.innerHTML = '<div class="n" aria-live="polite">' + (isNaN(s[k]) ? 0 : s[k]) + '</div><div><button type="button" data-d="-1" aria-label="Take points from ' + esc(name) + '">&minus;</button> <button type="button" data-d="1" aria-label="Give points to ' + esc(name) + '">+</button></div><strong>' + esc(name) + '</strong>';
      [].slice.call(d.querySelectorAll('button')).forEach(function (b) { b.onclick = function () { var v = ints($('#sc').value); v[k] = (v[k] || 0) + (+b.dataset.d) * (+$('#ic').value || 1); $('#sc').value = v.join(' '); $('#mv').value = String((+$('#mv').value || 0) + 1); draw(); }; });
      box.appendChild(d);
    });
  }
