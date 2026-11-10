/* INFINITE-AI widget kit: classroom tools (live boards for the whiteboard, tablet or laptop). Original code and artwork. */
(function () {
  'use strict';
  var IAI = window.IAI, esc = IAI.esc, CLS = IAI.CLS = {};
  var CSS = [
    '.cls-board{--bg1:#BFE6FF;--bg2:#FFE9A8;--ink:#10223A;--card:#fff;--accent:#F59E0B;position:relative;border-radius:14px;padding:16px;min-height:260px;color:var(--ink);background:linear-gradient(180deg,var(--bg1),var(--bg2));border:2px solid rgba(16,34,58,.25);font-family:var(--body)}',
    '.cls-board[data-theme=ocean]{--bg1:#7DD3FC;--bg2:#0E7490;--ink:#052233;--accent:#FB7185}',
    '.cls-board[data-theme=night]{--bg1:#0B1030;--bg2:#2B1B5E;--ink:#F4F6FF;--card:#1B2350;--accent:#2DD4BF}',
    '.cls-board[data-theme=sunrise]{--bg1:#FDBA74;--bg2:#F472B6;--ink:#33122A;--accent:#7C5CFF}',
    '.cls-board[data-theme=veld]{--bg1:#BBF7D0;--bg2:#FDE68A;--ink:#14301C;--accent:#16A34A}',
    '.cls-board:fullscreen{overflow:auto;padding:28px;font-size:1.25em}',
    '.cls-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}',
    '.cls-bar select,.cls-bar button{min-height:44px;font-size:1rem}',
    '.cls-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}',
    '.cls-card{min-height:64px;border-radius:12px;border:3px solid rgba(16,34,58,.35);background:var(--card);color:var(--ink);font-weight:700;font-size:1.05rem;padding:8px;cursor:pointer;text-align:center}',
    '.cls-card small{display:block;font-weight:400;opacity:.75}',
    '.cls-card[aria-pressed=true]{outline:4px solid var(--accent)}',
    '.cls-card.present{background:#86EFAC;color:#052e16}.cls-card.absent{background:#FCA5A5;color:#450a0a}',
    '.cls-big{font-size:clamp(2rem,7vw,4.5rem);font-weight:800;text-align:center;margin:14px 0;overflow-wrap:anywhere}',
    '.cls-time{font:800 2rem/1 var(--head);padding:6px 12px;border-radius:10px;background:var(--card);color:var(--ink);min-width:5.2ch;text-align:center;display:inline-block}',
    '.cls-timer{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.cls-chip{display:inline-flex;gap:6px;align-items:center;border-radius:999px;background:var(--card);color:var(--ink);padding:4px 10px;margin:2px;border:1px solid rgba(16,34,58,.3)}',
    '.cls-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}',
    '.cls-group{background:var(--card);color:var(--ink);border:3px solid #10223A;border-radius:10px;overflow:hidden}',
    '.cls-group h4{margin:0;padding:6px;text-align:center;color:#fff;font-size:1rem}',
    '.cls-group ul{list-style:none;margin:0;padding:8px}',
    '.cls-disc{width:min(52vw,220px);aspect-ratio:1;border-radius:50%;margin:10px auto;border:6px solid var(--card);background:conic-gradient(var(--accent) var(--p,100%),rgba(255,255,255,.55) 0)}',
    '.cls-score{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}',
    '.cls-team{background:var(--card);color:var(--ink);border-radius:14px;border:4px solid var(--tc,#EF4444);text-align:center;padding:10px}',
    '.cls-team .n{font-size:3rem;font-weight:800}.cls-team button{min-width:56px;min-height:48px;font-size:1.4rem}',
    '.cls-level{display:flex;gap:10px;align-items:center;width:100%;min-height:58px;border-radius:12px;border:3px solid rgba(16,34,58,.35);background:var(--card);color:var(--ink);font-size:1.15rem;font-weight:700;margin:6px 0;padding:6px 12px;cursor:pointer;text-align:left}',
    '.cls-level b{font-size:2rem;min-width:1.4ch}.cls-level[aria-pressed=true]{background:var(--accent);color:#fff;transform:scale(1.02)}',
    '.cls-bars{display:grid;gap:6px;margin:10px 0}.cls-bars div{height:34px;border-radius:6px;background:var(--bc,#22C55E);min-width:4px;color:#fff;font-weight:800;padding:4px 8px;white-space:nowrap}',
    '@media (prefers-reduced-motion:reduce){.cls-level{transform:none!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  /* fair random numbers: rejection sampling on crypto bytes; a test may set window.__IAI_RNG */
  CLS.rand = function (n) {
    if (window.__IAI_RNG) return Math.floor(window.__IAI_RNG() * n);
    var a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % n;
  };
  CLS.shuffle = function (arr) { var r = arr.slice(); for (var i = r.length - 1; i > 0; i--) { var j = CLS.rand(i + 1), t = r[i]; r[i] = r[j]; r[j] = t; } return r; };

  /* class list: one learner per line, "code" or "code | label shown on the board".
     Only the code ever leaves the page. A code must hold a digit so a name is not typed by mistake. */
  CLS.MAX = 60;
  CLS.parseList = function (text) {
    var list = [], errors = [], seen = {};
    String(text || '').split(/\r?\n/).forEach(function (ln, i) {
      var t = ln.trim(); if (!t || t.charAt(0) === '#') return;
      var p = t.split('|'), code = p[0].trim(), label = (p[1] || '').trim(), at = 'List line ' + (i + 1) + ': ';
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,11}$/.test(code) || !/\d/.test(code)) { errors.push(at + '"' + code + '" is not a code. Use a short code with a number, such as L01. Do not type a name here.'); return; }
      if (seen[code]) { errors.push(at + 'code ' + code + ' is listed twice.'); return; }
      if (label.length > 24) { errors.push(at + 'the label is longer than 24 characters.'); return; }
      seen[code] = 1; list.push({ code: code, label: label || code });
    });
    if (list.length > CLS.MAX) errors.push('The list has ' + list.length + ' learners. The most this tool takes is ' + CLS.MAX + '.');
    return { list: list, errors: errors };
  };
  CLS.codes = function (text, label, known) {
    var out = [], errs = [], seen = {};
    String(text || '').split(/[\s,;]+/).filter(Boolean).forEach(function (c) {
      if (known && !known[c]) { errs.push(label + ': "' + c + '" is not on the class list.'); return; }
      if (seen[c]) { errs.push(label + ': "' + c + '" appears twice.'); return; } seen[c] = 1; out.push(c);
    });
    return { list: out, errors: errs };
  };
  CLS.byCode = function (list) { var m = {}; list.forEach(function (x) { m[x.code] = x; }); return m; };

  /* seven attention and end-of-time sounds, made with the browser's own audio. Nothing is downloaded. */
  CLS.SOUNDS = [
    { id: 'chime', name: 'Chime', t: 'sine', n: [[880, .18], [1320, .3]] },
    { id: 'bell', name: 'Bell', t: 'triangle', n: [[1046, .5]] },
    { id: 'xylophone', name: 'Xylophone', t: 'sine', n: [[523, .12], [659, .12], [784, .12], [1046, .25]] },
    { id: 'drum', name: 'Drum', t: 'sawtooth', n: [[110, .2], [110, .2], [147, .35]] },
    { id: 'whistle', name: 'Whistle', t: 'sine', n: [[1900, .15], [2300, .35]] },
    { id: 'buzzer', name: 'Buzzer', t: 'square', n: [[196, .5]] },
    { id: 'harp', name: 'Harp', t: 'triangle', n: [[392, .12], [494, .12], [587, .12], [784, .3]] }
  ];
  CLS.soundOptions = function (sel) { return CLS.SOUNDS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join(''); };
  CLS.played = [];
  CLS.play = function (id) {
    CLS.played.push(id);
    var s = CLS.SOUNDS.filter(function (x) { return x.id === id; })[0]; if (!s) return false;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try {
      CLS.ac = CLS.ac || new AC(); var t = CLS.ac.currentTime;
      s.n.forEach(function (n) { var o = CLS.ac.createOscillator(), g = CLS.ac.createGain(); o.type = s.t; o.frequency.value = n[0]; g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + n[1]); o.connect(g); g.connect(CLS.ac.destination); o.start(t); o.stop(t + n[1]); t += n[1] * .9; });
      return true;
    } catch (e) { return false; }
  };

  /* a countdown that keeps time from the clock, so a busy page does not make it drift */
  CLS.countdown = function (onTick, onEnd) {
    var C = { running: false, left: 0, _end: 0, _id: null };
    function tick() { C.left = Math.max(0, Math.ceil((C._end - Date.now()) / 1000)); if (onTick) onTick(C.left); if (C.left <= 0) { C.stop(); if (onEnd) onEnd(); } }
    C.start = function (sec) { C.stop(); C.left = sec; C._end = Date.now() + sec * 1000; C.running = true; C._id = setInterval(tick, 250); if (onTick) onTick(C.left); };
    C.pause = function () { if (!C.running) return; tick(); C.running = false; clearInterval(C._id); C._id = null; };
    C.resume = function () { if (C.running || C.left <= 0) return; C._end = Date.now() + C.left * 1000; C.running = true; C._id = setInterval(tick, 250); };
    C.stop = function () { C.running = false; if (C._id) clearInterval(C._id); C._id = null; };
    return C;
  };
  CLS.mmss = function (s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; };

  /* optional timer for a board: pick a length, Start, Pause, Reset. Plays a sound when it ends. */
  CLS.timer = function (mount, soundId) {
    mount.innerHTML = '<div class="cls-timer"><label>Timer <select data-r="len" aria-label="Timer length"><option value="0">No timer</option><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option></select></label><output class="cls-time" data-r="out">--:--</output><button type="button" data-r="go">Start</button><button type="button" data-r="rst">Reset</button></div>';
    var sel = mount.querySelector('[data-r=len]'), out = mount.querySelector('[data-r=out]'), go = mount.querySelector('[data-r=go]'), rst = mount.querySelector('[data-r=rst]');
    var T = { ended: 0, soundId: soundId || 'chime' };
    var cd = CLS.countdown(function (l) { out.textContent = CLS.mmss(l); }, function () { T.ended++; CLS.play(T.soundId); go.textContent = 'Start'; });
    function reset() { cd.stop(); var s = +sel.value; out.textContent = s ? CLS.mmss(s) : '--:--'; go.textContent = 'Start'; cd.left = s; }
    sel.onchange = reset; rst.onclick = reset;
    go.onclick = function () {
      if (!+sel.value) { IAI.toast('Choose a timer length first.'); return; }
      if (cd.running) { cd.pause(); go.textContent = 'Resume'; } else if (cd.left > 0 && cd.left < +sel.value) { cd.resume(); go.textContent = 'Pause'; } else { cd.start(+sel.value); go.textContent = 'Pause'; }
    };
    T.cd = cd; T.reset = reset; T.select = sel; T.len = function () { return +sel.value; };
    return T;
  };

  /* theme choice and full screen for the whiteboard */
  CLS.chrome = function () {
    return '<div class="cls-bar"><label>Theme <select data-r="theme" aria-label="Board theme"><option value="veld">Veld</option><option value="ocean">Ocean</option><option value="sunrise">Sunrise</option><option value="night">Night sky</option></select></label><button type="button" data-r="full">Full screen for the board</button></div>';
  };
  CLS.bindChrome = function (board) {
    var th = board.querySelector('[data-r=theme]'), fb = board.querySelector('[data-r=full]');
    board.setAttribute('data-theme', th.value);
    th.onchange = function () { board.setAttribute('data-theme', th.value); };
    fb.onclick = function () { if (board.requestFullscreen) board.requestFullscreen().catch(function () { IAI.toast('Full screen is not available here.'); }); else IAI.toast('Full screen is not available here.'); };
  };
  CLS.COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#2563EB', '#8B5CF6', '#DB2777', '#92400E', '#111827', '#6B7280'];
  CLS.today = function () { return new Date().toISOString().slice(0, 10); };
  CLS.rows = function (cols, rows) { return IAI.CE.table(cols, rows); };
  CLS.NOTE = 'Learner codes only. The link from a code to a learner stays on your own paper or in your own register. This is a classroom tool, not the official register.';
})();
