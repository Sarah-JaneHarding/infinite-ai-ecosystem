  var CLS = IAI.CLS;
  var LIST = 'L01 | Lion\nL02 | Zebra\nL03 | Giraffe\nL04 | Rhino\nL05 | Hippo\nL06 | Leopard\nL07 | Meerkat\nL08 | Springbok\nL09 | Cheetah\nL10 | Eland\nL11 | Kudu\nL12 | Impala';
  var timer = null;
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', listText: LIST, historyText: 'L05 L02 L09', removedText: 'L07', motd: '' }; }
  function state(i) {
    var L = CLS.parseList(i.listText), known = CLS.byCode(L.list), h = CLS.codes(i.historyText, 'Turns so far', known), r = CLS.codes(i.removedText, 'Taken out', known);
    return { L: L, h: h, r: r, errors: L.errors.concat(h.errors, r.errors) };
  }
  var cfg = {
    title: 'A fair turn for every learner, <span class="arc">and it remembers who has had one.</span>',
    lead: 'Type the class list as codes. Press Pick. Each learner who has not yet had a turn has the same chance. The tool remembers the turns until you start a new round. Take a learner out (away today) and add them back at any time. Only codes leave this page.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'listText'], piiTarget: 'motd', changeTarget: { path: 'date', value: '2027-02-17' },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<label for="ls">Class list: one code per line, then an optional label after a bar</label><textarea id="ls" spellcheck="false" style="min-height:110px"></textarea>' +
        '<div class="grid2"><div><label for="hs">Turns so far (codes, in order)</label><input id="hs" style="width:100%"></div><div><label for="rm">Taken out (codes)</label><input id="rm" style="width:100%"></div></div>' +
        '<label for="md">Note for the board (not sent on)</label><input id="md" style="width:100%" maxlength="100">' +
        '<div id="board" class="cls-board" aria-label="Picker board">' + CLS.chrome() + '<div id="tm"></div><div class="cls-big" id="stage" role="status" aria-live="polite">Press Pick</div><p class="cls-bar" id="cnt"></p>' +
        '<div class="cls-bar"><button type="button" id="pick">Pick a learner</button><button type="button" id="out">Take this learner out</button><button type="button" id="newr">Start a new round</button></div><div id="chips" aria-label="Taken out"></div></div>';
      CLS.bindChrome($('#board')); timer = CLS.timer($('#tm'), 'chime'); draw();
      ['ls', 'hs', 'rm'].forEach(function (i) { $('#' + i).oninput = draw; });
      $('#pick').onclick = pick; $('#newr').onclick = function () { $('#hs').value = ''; $('#stage').textContent = 'New round. Press Pick'; draw(); };
      $('#out').onclick = function () { var h = state(cfg.collectInput()).h.list; if (!h.length) return; var last = h[h.length - 1], r = state(cfg.collectInput()).r.list; r.push(last); $('#rm').value = r.join(' '); $('#hs').value = h.slice(0, -1).join(' '); draw(); };
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#ls').value = s.listText; $('#hs').value = s.historyText; $('#rm').value = s.removedText; $('#md').value = s.motd; draw(); },
    reset: function () { ['#cl', '#dt', '#ls', '#hs', '#rm', '#md'].forEach(function (i) { $(i).value = ''; }); draw(); },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, listText: $('#ls').value, historyText: $('#hs').value, removedText: $('#rm').value, motd: $('#md').value }; },
    validateInput: function (i) { var e = []; if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.'); var s = state(i); e = e.concat(s.errors); if (!s.L.list.length && !s.L.errors.length) e.push('Enter the class list.'); if (!e.length) { var r = {}; s.r.list.forEach(function (c) { r[c] = 1; }); var both = s.h.list.filter(function (c) { return r[c]; }); if (both.length) e.push(both[0] + ' is both taken out and listed as having had a turn. Remove it from one.'); } return e; },
    run: function (input) {
      var s = state(input), r = {}, d = {}, flags = []; s.r.list.forEach(function (c) { r[c] = 1; }); s.h.list.forEach(function (c) { d[c] = 1; });
      var left = s.L.list.filter(function (x) { return !r[x.code] && !d[x.code]; }).map(function (x) { return x.code; });
      var eligible = s.L.list.length - s.r.list.length; if (!left.length) flags.push({ type: 'round_complete', text: 'Everyone in the room has had a turn. Start a new round.' });
      if (s.r.list.length) flags.push({ type: 'taken_out', text: s.r.list.length + ' learner(s) are taken out and cannot be picked.' });
      return { event: 'tb.picker.session', payload: { class: input.cls, date: input.date, listSize: s.L.list.length, eligible: eligible, turns: s.h.list, turnsTaken: s.h.list.length, notYetPicked: left, takenOut: s.r.list, rules: 'Each learner who had not had a turn had the same chance on every pick. ' + CLS.NOTE, flags: flags } };
    },
    renderPreview: function (env, el) {
      var p = env.payload; var h = '<h3>Class ' + esc(p.class) + ' · ' + esc(p.date) + '</h3><p class="cap">' + p.turnsTaken + ' / ' + p.eligible + ' have had a turn</p>';
      h += CE.table([{ key: 'k', label: 'Turn' }, { key: 'c', label: 'Code' }], p.turns.map(function (c, k) { return { k: k + 1, c: c }; }));
      h += '<p class="cap">Not yet picked: ' + esc(p.notYetPicked.join(', ') || 'nobody') + '. Taken out: ' + esc(p.takenOut.join(', ') || 'nobody') + '.</p>';
      el.innerHTML = h + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>' + e.payload.turnsTaken + ' turn(s) recorded for ' + esc(e.payload.class) + '. Approving releases <code>tb.picker.session</code>.</p>'; }
  };
  function draw() {
    var s = state(cfg.collectInput()), r = {}, d = {}; if (s.errors.length) { $('#cnt').textContent = s.errors[0]; return; }
    s.r.list.forEach(function (c) { r[c] = 1; }); s.h.list.forEach(function (c) { d[c] = 1; });
    var elig = s.L.list.length - s.r.list.length; $('#cnt').textContent = s.h.list.length + ' / ' + elig + ' have had a turn';
    var ch = $('#chips'); ch.innerHTML = s.r.list.map(function (c) { var x = CLS.byCode(s.L.list)[c]; return '<span class="cls-chip">' + esc(x.label) + ' <button type="button" data-add="' + esc(c) + '" aria-label="Add ' + esc(x.label) + ' back">Add back</button></span>'; }).join('');
    [].slice.call(ch.querySelectorAll('button')).forEach(function (b) { b.onclick = function () { var c = b.dataset.add; $('#rm').value = s.r.list.filter(function (x) { return x !== c; }).join(' '); draw(); }; });
  }
  function pick() {
    var s = state(cfg.collectInput()); if (s.errors.length || !s.L.list.length) { IAI.toast(s.errors[0] || 'Enter the class list first.'); return; }
    var r = {}, d = {}; s.r.list.forEach(function (c) { r[c] = 1; }); s.h.list.forEach(function (c) { d[c] = 1; });
    var pool = s.L.list.filter(function (x) { return !r[x.code] && !d[x.code]; });
    if (!pool.length) { $('#stage').textContent = 'Everyone has had a turn. Start a new round.'; return; }
    var w = pool[CLS.rand(pool.length)]; $('#hs').value = s.h.list.concat([w.code]).join(' '); $('#stage').textContent = w.label; $('#stage').dataset.code = w.code; draw();
  }
