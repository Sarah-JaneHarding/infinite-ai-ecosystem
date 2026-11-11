  var CLS = IAI.CLS;
  var cd = null, idx = 0, seq = [], done = 0;
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', rounds: 4, secondsPer: 600, cleanupOn: 'yes', cleanupSeconds: 60, namesText: 'Reading corner\nNumber games\nWriting table\nBuilding blocks', sound: 'xylophone', doneText: '' }; }
  function nums(i) {
    var e = []; if (!i.rounds || i.rounds < 1 || i.rounds > 10 || i.rounds % 1) e.push('Rounds must be a whole number from 1 to 10.');
    if (!i.secondsPer || i.secondsPer < 10 || i.secondsPer > 3600 || i.secondsPer % 1) e.push('Seconds for each round must be a whole number from 10 to 3600.');
    if (i.cleanupOn === 'yes' && (!i.cleanupSeconds || i.cleanupSeconds < 10 || i.cleanupSeconds > 600 || i.cleanupSeconds % 1)) e.push('Seconds for clean-up must be a whole number from 10 to 600.');
    if (CLS.SOUNDS.map(function (s) { return s.id; }).indexOf(i.sound) < 0) e.push('Choose one of the seven end-of-round sounds.');
    return e;
  }
  function plan(i) {
    var nm = String(i.namesText || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), out = [];
    for (var k = 0; k < i.rounds; k++) { out.push({ n: out.length + 1, kind: 'round', name: nm[k] || 'Round ' + (k + 1), seconds: i.secondsPer }); if (i.cleanupOn === 'yes') out.push({ n: out.length + 1, kind: 'cleanup', name: 'Clean up', seconds: i.cleanupSeconds }); }
    return out;
  }
  var cfg = {
    title: 'Rotate the stations on time, <span class="arc">with a timer the little ones can see.</span>',
    lead: 'Set up to 10 rounds, name each round in any language, and add an optional clean-up period after each one. A shrinking disc shows the time left. A sound of your choice plays at the end of each round. The summary lists the plan and how many steps were finished.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'rounds', 'secondsPer'], piiTarget: 'namesText', changeTarget: { path: 'rounds', value: 3 },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<div class="grid2"><div><label for="rn">Rounds (1 to 10)</label><input id="rn" type="number" min="1" max="10" style="width:100%"></div><div><label for="sp">Seconds in each round</label><input id="sp" type="number" min="10" max="3600" style="width:100%"></div></div>' +
        '<div class="grid2"><div><label for="cu">Clean-up after each round</label><select id="cu" style="width:100%"><option value="no">No</option><option value="yes">Yes</option></select></div><div><label for="cs">Seconds for clean-up</label><input id="cs" type="number" min="10" max="600" value="60" style="width:100%"></div></div>' +
        '<label for="sd">End-of-round sound <button type="button" id="try">Hear it</button></label><select id="sd" style="width:100%">' + CLS.soundOptions('chime') + '</select>' +
        '<label for="nm">Round names, one per line (any language)</label><textarea id="nm" style="min-height:90px"></textarea><label for="dn">Steps finished (filled in as the timer runs)</label><input id="dn" style="width:100%" value="0">' +
        '<div id="board" class="cls-board" aria-label="Rotations board">' + CLS.chrome() + '<div class="cls-big" id="rname">Press Start</div><div class="cls-disc" id="disc" role="img" aria-label="Time left"></div><div class="cls-big" id="rtime" style="margin-top:0">--:--</div><div class="cls-bar" style="justify-content:center"><button type="button" id="rb">Back</button><button type="button" id="rs">Start</button><button type="button" id="rf">Next</button><button type="button" id="rr">Reset</button></div></div>';
      CLS.bindChrome($('#board')); $('#try').onclick = function () { CLS.play($('#sd').value); };
      cd = CLS.countdown(function (l) { $('#rtime').textContent = CLS.mmss(l); var t = seq[idx] ? seq[idx].seconds : 1; $('#disc').style.setProperty('--p', Math.round(l / t * 100) + '%'); }, function () { CLS.play($('#sd').value); mark(); advance(1, true); });
      $('#rs').onclick = function () { if (!load()) return; if (cd.running) { cd.pause(); $('#rs').textContent = 'Resume'; } else if (cd.left > 0 && seq[idx] && cd.left < seq[idx].seconds) { cd.resume(); $('#rs').textContent = 'Pause'; } else { cd.start(seq[idx].seconds); $('#rs').textContent = 'Pause'; } };
      $('#rf').onclick = function () { if (load()) advance(1, false); }; $('#rb').onclick = function () { if (load()) advance(-1, false); };
      $('#rr').onclick = function () { cd.stop(); idx = 0; $('#dn').value = '0'; show(); $('#rs').textContent = 'Start'; };
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#rn').value = s.rounds; $('#sp').value = s.secondsPer; $('#cu').value = s.cleanupOn; $('#cs').value = s.cleanupSeconds; $('#sd').value = s.sound; $('#nm').value = s.namesText; $('#dn').value = s.doneText === '' ? '0' : s.doneText; },
    reset: function () { ['#cl', '#dt', '#rn', '#sp', '#nm'].forEach(function (i) { $(i).value = ''; }); $('#dn').value = '0'; },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, rounds: +$('#rn').value || null, secondsPer: +$('#sp').value || null, cleanupOn: $('#cu').value, cleanupSeconds: +$('#cs').value || null, namesText: $('#nm').value, sound: $('#sd').value, doneText: $('#dn').value }; },
    validateInput: function (i) { var e = nums(i); if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.'); var d = i.doneText === '' ? 0 : +i.doneText; if (isNaN(d) || d < 0 || d % 1) e.push('Steps finished must be a whole number.'); else if (!e.length && d > plan(i).length) e.push('Steps finished (' + d + ') is more than the steps in the plan (' + plan(i).length + ').'); return e; },
    run: function (input) {
      var p = plan(input), d = input.doneText === '' ? 0 : +input.doneText, tot = p.reduce(function (s, x) { return s + x.seconds; }, 0), flags = [];
      if (d < p.length) flags.push({ type: 'unfinished', text: 'Only ' + d + ' of ' + p.length + ' steps were finished.' });
      return { event: 'tb.rotations.run', payload: { class: input.cls, date: input.date, steps: p.map(function (x) { return { step: x.n, kind: x.kind, name: x.name, seconds: x.seconds }; }), roundCount: input.rounds, totalSeconds: tot, totalMinutes: Math.round(tot / 6) / 10, stepsFinished: d, sound: input.sound, rules: 'A plan and a count only. No learner is named or placed in a station by this tool.', flags: flags } };
    },
    renderPreview: function (env, el) {
      var p = env.payload; var h = '<h3>Class ' + esc(p.class) + ' · ' + p.roundCount + ' round(s) · ' + p.totalMinutes + ' minute(s) in all</h3>';
      h += CE.table([{ key: 'n', label: 'Step' }, { key: 'k', label: 'Kind' }, { key: 'a', label: 'Name' }, { key: 's', label: 'Seconds' }], p.steps.map(function (x) { return { n: x.step, k: x.kind, a: x.name, s: x.seconds }; }));
      el.innerHTML = h + '<p class="cap">' + p.stepsFinished + ' of ' + p.steps.length + ' step(s) finished · sound: ' + esc(p.sound) + '</p>' + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>' + e.payload.steps.length + ' step(s), ' + e.payload.stepsFinished + ' finished. Approving releases <code>tb.rotations.run</code>.</p>'; }
  };
  function load() { var i = cfg.collectInput(), e = nums(i); if (e.length) { IAI.toast(e[0]); return false; } seq = plan(i); if (idx >= seq.length) idx = 0; if (!cd.running && cd.left === 0) show(); return true; }
  function show() { var s = seq[idx] || plan(cfg.collectInput())[idx]; if (!s) return; $('#rname').textContent = s.name; $('#rtime').textContent = CLS.mmss(s.seconds); $('#disc').style.setProperty('--p', '100%'); cd.left = 0; }
  function mark() { $('#dn').value = String(Math.max(+$('#dn').value || 0, idx + 1)); }
  function advance(dir, auto) {
    var n = idx + dir; if (n >= seq.length) { cd.stop(); $('#rname').textContent = 'All rounds finished'; $('#rs').textContent = 'Start'; idx = seq.length - 1; return; } if (n < 0) n = 0; idx = n; show();
    if (auto) { cd.start(seq[idx].seconds); $('#rs').textContent = 'Pause'; } else { cd.stop(); $('#rs').textContent = 'Start'; }
  }
