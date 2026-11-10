  var CLS = IAI.CLS;
  var timer = null, t0 = Date.now();
  var DEF = 'No talking\nWhisper voices\nPartner voices\nGroup voices\nPresenting voice';
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', levelsText: DEF, current: '1', sound: 'bell', logText: '0 | 0\n1 | 140\n2 | 900\n1 | 1500', attention: '2' }; }
  function lv(t) { return String(t || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function log(t, n) {
    var out = [], e = []; String(t || '').split(/\r?\n/).forEach(function (ln, i) { var s = ln.trim(); if (!s) return; var p = s.split('|').map(function (x) { return x.trim(); }), l = +p[0], sec = +p[1]; if (p.length !== 2 || isNaN(l) || l % 1 || l < 0 || l >= n || isNaN(sec) || sec < 0) { e.push('Change line ' + (i + 1) + ': give level number | seconds, with the level on the board.'); return; } out.push({ level: l, atSecond: sec }); });
    return { list: out, errors: e };
  }
  var cfg = {
    title: 'Show the voice level the class needs, <span class="arc">with one touch.</span>',
    lead: 'Set up to five levels and write them in any language. Touch a level to make it active. The Attention button plays your chosen sound. The summary records which levels were used and when, in seconds. No microphone is used and nothing is recorded.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'levelsText'], piiTarget: 'levelsText', changeTarget: { path: 'current', value: '3' },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<label for="lt">Levels, one per line, up to five (any language). The first line is level 0.</label><textarea id="lt" style="min-height:100px"></textarea>' +
        '<div class="grid2"><div><label for="sd">Attention sound <button type="button" id="try">Hear it</button></label><select id="sd" style="width:100%">' + CLS.soundOptions('bell') + '</select></div><div><label for="cu">Active level number</label><input id="cu" style="width:100%"></div></div>' +
        '<div class="grid2"><div><label for="at">Attention sounds played</label><input id="at" style="width:100%" value="0"></div><div><label for="lg">Level changes: level | seconds since you started (filled in by the board)</label><textarea id="lg" style="min-height:60px"></textarea></div></div>' +
        '<div id="board" class="cls-board" aria-label="Noise levels board">' + CLS.chrome() + '<div id="tm"></div><div id="lvls" role="group" aria-label="Voice levels"></div><div class="cls-bar"><button type="button" id="att">Attention! (play sound)</button></div></div>';
      CLS.bindChrome($('#board')); timer = CLS.timer($('#tm'), 'chime'); t0 = Date.now(); $('#lt').value = DEF; $('#try').onclick = function () { CLS.play($('#sd').value); };
      $('#att').onclick = function () { CLS.play($('#sd').value); $('#at').value = String((+$('#at').value || 0) + 1); };
      ['lt', 'cu'].forEach(function (i) { $('#' + i).oninput = draw; }); draw();
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#lt').value = s.levelsText; $('#cu').value = s.current; $('#sd').value = s.sound; $('#lg').value = s.logText; $('#at').value = s.attention; draw(); },
    reset: function () { ['#cl', '#dt', '#lg', '#cu'].forEach(function (i) { $(i).value = ''; }); $('#lt').value = DEF; $('#at').value = '0'; draw(); },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, levelsText: $('#lt').value, current: $('#cu').value, sound: $('#sd').value, logText: $('#lg').value, attention: $('#at').value }; },
    validateInput: function (i) {
      var e = [], L = lv(i.levelsText); if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.');
      if (L.length < 2 || L.length > 5) e.push('Give from 2 to 5 noise levels.'); else {
        if (i.current !== '' && (isNaN(+i.current) || +i.current % 1 || +i.current < 0 || +i.current >= L.length)) e.push('The active level must be a level on the board.');
        e = e.concat(log(i.logText, L.length).errors); var a = i.attention === '' ? 0 : +i.attention; if (isNaN(a) || a < 0 || a % 1) e.push('Attention sounds played must be a whole number.');
      }
      if (CLS.SOUNDS.map(function (s) { return s.id; }).indexOf(i.sound) < 0) e.push('Choose one of the seven attention sounds.');
      return e;
    },
    run: function (input) {
      var L = lv(input.levelsText), g = log(input.logText, L.length).list, used = {}, flags = []; g.forEach(function (x) { used[x.level] = 1; });
      for (var k = 1; k < g.length; k++) if (g[k].atSecond < g[k - 1].atSecond) { flags.push({ type: 'order', text: 'The level changes are not in time order.' }); break; }
      if (!g.length) flags.push({ type: 'no_changes', text: 'No level changes were recorded.' });
      return { event: 'tb.noise.session', payload: { class: input.cls, date: input.date, levels: L.map(function (x, k) { return { level: k, label: x }; }), activeLevel: input.current === '' ? null : +input.current, changes: g, levelsUsed: Object.keys(used).map(Number), attentionSounds: +input.attention || 0, sound: input.sound, rules: 'No microphone is used. Levels are chosen by the teacher and nothing is recorded about any learner.', flags: flags } };
    },
    renderPreview: function (env, el) {
      var p = env.payload; el.innerHTML = '<h3>Class ' + esc(p.class) + ' · ' + esc(p.date) + '</h3>' + CE.table([{ key: 'l', label: 'Level' }, { key: 'n', label: 'Words' }], p.levels.map(function (x) { return { l: x.level, n: x.label }; })) + '<h4>Changes</h4>' + (p.changes.length ? CE.table([{ key: 's', label: 'Seconds' }, { key: 'l', label: 'Level' }], p.changes.map(function (x) { return { s: x.atSecond, l: x.level }; })) : '<p class="cap">None.</p>') + '<p class="cap">' + p.attentionSounds + ' attention sound(s) played.</p>' + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>' + e.payload.changes.length + ' level change(s). Approving releases <code>tb.noise.session</code>.</p>'; }
  };
  function draw() {
    var L = lv($('#lt').value).slice(0, 5), cur = $('#cu').value, box = $('#lvls'); box.innerHTML = '';
    L.forEach(function (x, k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cls-level'; b.dataset.level = k; b.setAttribute('aria-pressed', String(cur !== '' && +cur === k)); b.innerHTML = '<b>' + k + '</b><span>' + esc(x) + '</span>';
      b.onclick = function () { $('#cu').value = String(k); var s = Math.round((Date.now() - t0) / 1000); $('#lg').value = ($('#lg').value.trim() ? $('#lg').value.trim() + '\n' : '') + k + ' | ' + s; draw(); }; box.appendChild(b);
    });
  }
