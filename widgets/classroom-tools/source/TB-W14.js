  var CLS = IAI.CLS;
  var LIST = 'L01 | Lion\nL02 | Zebra\nL03 | Giraffe\nL04 | Rhino\nL05 | Hippo\nL06 | Leopard\nL07 | Meerkat\nL08 | Springbok\nL09 | Cheetah\nL10 | Eland\nL11 | Kudu\nL12 | Impala';
  var MARKS = 'L01 | present | Packed lunch\nL02 | present | School meal\nL03 | absent\nL04 | present | Packed lunch\nL05 | present | School meal\nL06 | present | Packed lunch\nL07 | absent\nL08 | present | School meal\nL09 | present | Packed lunch\nL10 | present | School meal\nL11 | present | Packed lunch\nL12 | present | School meal';
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', listText: LIST, lunchOn: 'yes', lunchOpts: 'Packed lunch; School meal', marksText: MARKS, motd: 'Good morning, Grade 2A!' }; }
  function opts(t) { return String(t || '').split(/[;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function parseMarks(text, known, lunchOn, lo) {
    var out = {}, errs = [];
    String(text || '').split(/\r?\n/).forEach(function (ln, i) {
      var t = ln.trim(); if (!t) return; var c = t.split('|').map(function (x) { return x.trim(); }), at = 'Mark line ' + (i + 1) + ': ';
      if (!known[c[0]]) { errs.push(at + '"' + c[0] + '" is not on the class list.'); return; }
      if (out[c[0]]) { errs.push(at + c[0] + ' is marked twice.'); return; }
      if (c[1] !== 'present' && c[1] !== 'absent') { errs.push(at + 'the mark must be present or absent.'); return; }
      if (c[2] && c[1] === 'absent') { errs.push(at + 'an absent learner cannot have a lunch choice.'); return; }
      if (c[2] && (!lunchOn || lo.indexOf(c[2]) < 0)) { errs.push(at + '"' + c[2] + '" is not one of the lunch choices.'); return; }
      out[c[0]] = { status: c[1], lunch: c[2] || null };
    });
    return { map: out, errors: errs };
  }
  var cfg = {
    title: 'Mark the class and count lunches <span class="arc">in one tap each.</span>',
    lead: 'Type the class list as codes (a label such as an animal name can follow a bar and is shown on the board only). Tap a card to mark it present, then absent, then unmarked. Switch lunch count on and the tap also cycles the lunch choices. Only codes and counts leave this page.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'listText'], piiTarget: 'motd', changeTarget: { path: 'date', value: '2027-02-17' },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%" placeholder="for example Gr2A"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<label for="ls">Class list: one code per line, then an optional label after a bar</label><textarea id="ls" spellcheck="false" style="min-height:120px"></textarea>' +
        '<div class="grid2"><div><label for="lu">Lunch count</label><select id="lu" style="width:100%"><option value="no">Off</option><option value="yes">On</option></select></div><div><label for="lc">Lunch choices (separate with ;)</label><input id="lc" style="width:100%" value="Packed lunch; School meal"></div></div>' +
        '<label for="md">Message of the day (shown on the board, not sent on)</label><input id="md" style="width:100%" maxlength="140">' +
        '<label for="mk">Marks (filled in as you tap)</label><textarea id="mk" spellcheck="false" style="min-height:70px"></textarea>' +
        '<div id="board" class="cls-board" aria-label="Register board">' + CLS.chrome() + '<div class="cls-big" id="bmotd" style="font-size:1.6rem"></div><div class="cls-grid" id="bgrid"></div><p id="bsum" class="cls-bar" role="status"></p></div>';
      CLS.bindChrome($('#board'));
      ['ls', 'lu', 'lc', 'mk', 'md'].forEach(function (i) { $('#' + i).oninput = $('#' + i).onchange = draw; });
      draw();
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#ls').value = s.listText; $('#lu').value = s.lunchOn; $('#lc').value = s.lunchOpts; $('#mk').value = s.marksText; $('#md').value = s.motd; draw(); },
    reset: function () { ['#cl', '#dt', '#ls', '#mk', '#md'].forEach(function (i) { $(i).value = ''; }); $('#lu').value = 'no'; draw(); },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, listText: $('#ls').value, lunchOn: $('#lu').value, lunchOpts: $('#lc').value, marksText: $('#mk').value, motd: $('#md').value }; },
    validateInput: function (i) {
      var e = []; if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.');
      var L = CLS.parseList(i.listText); e = e.concat(L.errors); if (!L.list.length && !L.errors.length) e.push('Enter the class list.');
      if (!e.length) e = e.concat(parseMarks(i.marksText, CLS.byCode(L.list), i.lunchOn === 'yes', opts(i.lunchOpts)).errors);
      return e;
    },
    run: function (input) {
      var L = CLS.parseList(input.listText).list, lo = opts(input.lunchOpts), on = input.lunchOn === 'yes', M = parseMarks(input.marksText, CLS.byCode(L), on, lo).map, flags = [];
      var rows = L.map(function (x) { var m = M[x.code]; return { code: x.code, status: m ? m.status : 'unmarked', lunch: m ? m.lunch : null }; });
      var c = { present: 0, absent: 0, unmarked: 0, total: rows.length }; rows.forEach(function (r) { c[r.status]++; });
      var lunch = null; if (on) { lunch = lo.map(function (o) { return { option: o, count: rows.filter(function (r) { return r.lunch === o; }).length }; }); var none = rows.filter(function (r) { return r.status === 'present' && !r.lunch; }).length; if (none) flags.push({ type: 'no_lunch_choice', text: none + ' present learner(s) have no lunch choice yet.' }); }
      if (c.unmarked) flags.push({ type: 'unmarked', text: c.unmarked + ' learner(s) are not marked. They are counted as unmarked, not as absent.' });
      return { event: 'tb.register.recorded', payload: { class: input.cls, date: input.date, counts: c, lunch: lunch, learners: rows, flags: flags, rules: CLS.NOTE } };
    },
    renderPreview: function (env, el) {
      var p = env.payload; var h = '<h3>Class ' + esc(p.class) + ' · ' + esc(p.date) + '</h3><p class="cap">' + p.counts.present + ' present · ' + p.counts.absent + ' absent · ' + p.counts.unmarked + ' not marked · ' + p.counts.total + ' on the list</p>';
      if (p.lunch) h += '<h4>Lunch count</h4>' + CE.table([{ key: 'o', label: 'Choice' }, { key: 'n', label: 'Learners' }], p.lunch.map(function (x) { return { o: x.option, n: x.count }; }));
      h += '<h4>By code</h4>' + CE.table([{ key: 'c', label: 'Code' }, { key: 's', label: 'Mark' }, { key: 'l', label: 'Lunch' }], p.learners.map(function (r) { return { c: r.code, s: r.status, l: r.lunch || '' }; }));
      el.innerHTML = h + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>Register for ' + esc(e.payload.class) + ': ' + e.payload.counts.present + ' present. Approving releases <code>tb.register.recorded</code>.</p>'; }
  };
  function draw() {
    var L = CLS.parseList($('#ls').value).list, on = $('#lu').value === 'yes', lo = opts($('#lc').value), M = parseMarks($('#mk').value, CLS.byCode(L), on, lo).map;
    $('#bmotd').textContent = $('#md').value; var g = $('#bgrid'); g.innerHTML = '';
    L.forEach(function (x) {
      var m = M[x.code], b = document.createElement('button'); b.type = 'button'; b.className = 'cls-card' + (m ? ' ' + m.status : ''); b.dataset.code = x.code;
      b.innerHTML = esc(x.label) + '<small>' + (m ? (m.status === 'present' ? 'Here' + (m.lunch ? ' · ' + esc(m.lunch) : '') : 'Away') : 'Tap to mark') + '</small>';
      b.setAttribute('aria-label', x.label + ': ' + (m ? m.status : 'not marked'));
      b.onclick = function () { tap(x.code); }; g.appendChild(b);
    });
    var n = { present: 0, absent: 0 }; L.forEach(function (x) { var m = M[x.code]; if (m) n[m.status]++; }); $('#bsum').textContent = n.present + ' here · ' + n.absent + ' away · ' + (L.length - n.present - n.absent) + ' not marked';
  }
  function tap(code) {
    var L = CLS.parseList($('#ls').value).list, on = $('#lu').value === 'yes', lo = opts($('#lc').value), M = parseMarks($('#mk').value, CLS.byCode(L), on, lo).map, m = M[code], steps = [null];
    if (on && lo.length) lo.forEach(function (o) { steps.push({ status: 'present', lunch: o }); }); else steps.push({ status: 'present', lunch: null });
    steps.push({ status: 'absent', lunch: null });
    var at = 0; if (m) steps.forEach(function (s, k) { if (s && s.status === m.status && s.lunch === m.lunch) at = k; });
    var nx = steps[(at + 1) % steps.length]; if (nx) M[code] = nx; else delete M[code];
    $('#mk').value = L.filter(function (x) { return M[x.code]; }).map(function (x) { return x.code + ' | ' + M[x.code].status + (M[x.code].lunch ? ' | ' + M[x.code].lunch : ''); }).join('\n'); draw();
  }
