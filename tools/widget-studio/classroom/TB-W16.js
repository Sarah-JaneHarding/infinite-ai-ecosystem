  var CLS = IAI.CLS;
  var LIST = 'L01 | Lion\nL02 | Zebra\nL03 | Giraffe\nL04 | Rhino\nL05 | Hippo\nL06 | Leopard\nL07 | Meerkat\nL08 | Springbok\nL09 | Cheetah\nL10 | Eland\nL11 | Kudu\nL12 | Impala';
  var timer = null;
  function sample() { return { cls: 'Gr2A', date: '2027-02-16', listText: LIST, awayText: '', groupCount: 4, namesText: 'Red\nOrange\nYellow\nGreen', apartText: 'L01,L02', title: 'Reading groups', resultText: 'Red | L03 L10 L06\nOrange | L01 L08 L12\nYellow | L04 L11 L09\nGreen | L05 L02 L07' }; }
  function names(t, n) { var a = String(t || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), o = []; for (var k = 0; k < n; k++) o.push(a[k] || 'Group ' + (k + 1)); return o; }
  function pairs(t, known) {
    var out = [], errs = []; String(t || '').split(/\r?\n/).forEach(function (ln, i) { var s = ln.trim(); if (!s) return; var c = s.split(/[\s,;]+/).filter(Boolean); if (c.length !== 2) { errs.push('Keep-apart line ' + (i + 1) + ': give two codes.'); return; } if (!known[c[0]] || !known[c[1]]) { errs.push('Keep-apart line ' + (i + 1) + ': both codes must be on the class list.'); return; } if (c[0] === c[1]) { errs.push('Keep-apart line ' + (i + 1) + ': the two codes are the same.'); return; } out.push(c); });
    return { list: out, errors: errs };
  }
  function parseRes(t) { return String(t || '').split(/\r?\n/).filter(function (x) { return x.trim(); }).map(function (ln) { var p = ln.split('|'); return { name: p[0].trim(), members: (p[1] || '').split(/[\s,]+/).filter(Boolean) }; }); }
  function ctx(i) {
    var L = CLS.parseList(i.listText), known = CLS.byCode(L.list), a = CLS.codes(i.awayText, 'Away', known), ap = pairs(i.apartText, known);
    var away = {}; a.list.forEach(function (c) { away[c] = 1; });
    return { L: L, a: a, ap: ap, here: L.list.filter(function (x) { return !away[x.code]; }), known: known, errors: L.errors.concat(a.errors, ap.errors) };
  }
  function together(groups, ap) { var at = {}; groups.forEach(function (g, k) { g.forEach(function (c) { at[c] = k; }); }); return ap.filter(function (p) { return at[p[0]] !== undefined && at[p[0]] === at[p[1]]; }); }
  var cfg = {
    title: 'Fair groups in <span class="arc">one press, even sizes.</span>',
    lead: 'Type the class list as codes, tick off who is away, choose how many groups (2 to 30), and press Make groups. Sizes never differ by more than one. You can also name two learners who must be kept apart. Rename the groups in any language. Only codes leave this page.',
    noSourceRefs: true, requiredInput: ['cls', 'date', 'listText', 'groupCount'], piiTarget: 'title', changeTarget: { path: 'cls', value: 'Gr2B' },
    buildBench: function (el) {
      el.innerHTML = '<div class="grid2"><div><label for="cl">Class code</label><input id="cl" style="width:100%"></div><div><label for="dt">Date</label><input id="dt" type="date" style="width:100%"></div></div>' +
        '<label for="ls">Class list: one code per line, then an optional label after a bar</label><textarea id="ls" spellcheck="false" style="min-height:110px"></textarea>' +
        '<div class="grid2"><div><label for="aw">Away today (codes)</label><input id="aw" style="width:100%"></div><div><label for="gc">Number of groups (2 to 30)</label><input id="gc" type="number" min="2" max="30" style="width:100%"></div></div>' +
        '<div class="grid2"><div><label for="gn">Group names, one per line (any language)</label><textarea id="gn" style="min-height:90px"></textarea></div><div><label for="ka">Keep apart: two codes on a line</label><textarea id="ka" style="min-height:90px"></textarea></div></div>' +
        '<label for="tt">Title or message (optional, shown on the board)</label><input id="tt" style="width:100%" maxlength="80">' +
        '<label for="rs">Groups made (filled in by Make groups)</label><textarea id="rs" spellcheck="false" style="min-height:80px"></textarea>' +
        '<div id="board" class="cls-board" aria-label="Group board">' + CLS.chrome() + '<div id="tm"></div><h3 id="btitle" class="cls-big" style="font-size:1.8rem;margin:6px"></h3><div class="cls-bar"><button type="button" id="make">Make groups</button></div><div id="bgroups" class="cls-groups"></div></div>';
      CLS.bindChrome($('#board')); timer = CLS.timer($('#tm'), 'chime'); $('#make').onclick = make; ['tt', 'rs', 'gn'].forEach(function (i) { $('#' + i).oninput = draw; }); draw();
    },
    sample: sample,
    fillInput: function (s) { $('#cl').value = s.cls; $('#dt').value = s.date; $('#ls').value = s.listText; $('#aw').value = s.awayText; $('#gc').value = s.groupCount; $('#gn').value = s.namesText; $('#ka').value = s.apartText; $('#tt').value = s.title; $('#rs').value = s.resultText; draw(); },
    reset: function () { ['#cl', '#dt', '#ls', '#aw', '#gc', '#gn', '#ka', '#tt', '#rs'].forEach(function (i) { $(i).value = ''; }); draw(); },
    collectInput: function () { return { cls: $('#cl').value.trim(), date: $('#dt').value, listText: $('#ls').value, awayText: $('#aw').value, groupCount: +$('#gc').value || null, namesText: $('#gn').value, apartText: $('#ka').value, title: $('#tt').value, resultText: $('#rs').value }; },
    validateInput: function (i) {
      var e = []; if (!i.cls) e.push('Enter the class code.'); if (!CE.isDate(i.date)) e.push('Enter the date.');
      var c = ctx(i); e = e.concat(c.errors); if (!c.L.list.length && !c.L.errors.length) e.push('Enter the class list.');
      if (!i.groupCount || i.groupCount < 2 || i.groupCount > 30 || i.groupCount % 1) e.push('The number of groups must be a whole number from 2 to 30.');
      else if (!e.length && c.here.length < i.groupCount) e.push('There are only ' + c.here.length + ' learner(s) here for ' + i.groupCount + ' groups.');
      if (!e.length) {
        var g = parseRes(i.resultText); if (!g.length) e.push('Press Make groups first. No groups have been made yet.');
        else {
          if (g.length !== i.groupCount) e.push('The groups made (' + g.length + ') do not match the number of groups (' + i.groupCount + '). Press Make groups again.');
          var seen = {}, here = {}; c.here.forEach(function (x) { here[x.code] = 1; });
          g.forEach(function (x) { if (!x.members.length) e.push('Group "' + x.name + '" has no learners.'); x.members.forEach(function (m) { if (!here[m]) e.push('"' + m + '" is in a group but is away or not on the list.'); else if (seen[m]) e.push('"' + m + '" is in two groups.'); seen[m] = 1; }); });
          c.here.forEach(function (x) { if (!seen[x.code]) e.push(x.code + ' is here but not in any group.'); });
          var bad = together(g.map(function (x) { return x.members; }), c.ap.list); if (bad.length) e.push(bad[0].join(' and ') + ' are in the same group but were to be kept apart.');
        }
      }
      return e;
    },
    run: function (input) {
      var c = ctx(input), g = parseRes(input.resultText), sizes = g.map(function (x) { return x.members.length; }), flags = [];
      var mx = Math.max.apply(null, sizes), mn = Math.min.apply(null, sizes); if (mx - mn > 1) flags.push({ type: 'uneven', text: 'The group sizes differ by more than one. Make the groups again for even sizes.' });
      if (c.a.list.length) flags.push({ type: 'away', text: c.a.list.length + ' learner(s) are away and are not in a group.' });
      return { event: 'tb.groups.formed', payload: { class: input.cls, date: input.date, groupCount: g.length, learnersGrouped: c.here.length, away: c.a.list, keepApart: c.ap.list, keepApartRespected: true, groups: g.map(function (x) { return { name: x.name, members: x.members }; }), sizes: sizes, rules: 'Learners were shuffled with a fair random draw and dealt out one at a time, so sizes differ by at most one. ' + CLS.NOTE, flags: flags } };
    },
    renderPreview: function (env, el) {
      var p = env.payload; var h = '<h3>Class ' + esc(p.class) + ' · ' + p.groupCount + ' group(s) · ' + p.learnersGrouped + ' learner(s)</h3>';
      h += CE.table([{ key: 'g', label: 'Group' }, { key: 'm', label: 'Members (codes)' }, { key: 'n', label: 'Size' }], p.groups.map(function (x) { return { g: x.name, m: x.members.join(', '), n: x.members.length }; }));
      el.innerHTML = h + (p.flags.length ? CE.checks(p.flags.map(function (f) { return { ok: false, text: f.text }; })) : '') + '<p class="cap">' + esc(p.rules) + '</p>' + CE.printBtn();
    },
    renderOutput: function (e) { return '<p>' + e.payload.groupCount + ' group(s) for ' + esc(e.payload.class) + '. Approving releases <code>tb.groups.formed</code>.</p>'; }
  };
  function make() {
    var i = cfg.collectInput(), c = ctx(i); if (c.errors.length) { IAI.toast(c.errors[0]); return; }
    if (!c.L.list.length) { IAI.toast('Enter the class list first.'); return; }
    if (!i.groupCount || i.groupCount < 2 || i.groupCount > 30) { IAI.toast('Choose 2 to 30 groups.'); return; }
    if (c.here.length < i.groupCount) { IAI.toast('There are fewer learners here than groups.'); return; }
    var g, ok = false, nm = names(i.namesText, i.groupCount);
    for (var t = 0; t < 500 && !ok; t++) {
      var sh = CLS.shuffle(c.here.map(function (x) { return x.code; })); g = []; for (var k = 0; k < i.groupCount; k++) g.push([]);
      sh.forEach(function (code, n) { g[n % i.groupCount].push(code); }); ok = !together(g, c.ap.list).length;
    }
    if (!ok) { IAI.toast('The keep-apart rules cannot be met with ' + i.groupCount + ' groups. Use more groups or fewer rules.'); return; }
    $('#rs').value = g.map(function (m, k) { return nm[k] + ' | ' + m.join(' '); }).join('\n'); draw();
  }
  function draw() {
    var i = cfg.collectInput(), c = ctx(i); $('#btitle').textContent = i.title || ''; var g = parseRes(i.resultText), box = $('#bgroups'); box.innerHTML = '';
    g.forEach(function (x, k) { var d = document.createElement('div'); d.className = 'cls-group'; d.innerHTML = '<h4 style="background:' + CLS.COLORS[k % CLS.COLORS.length] + '">' + esc(x.name) + '</h4><ul>' + x.members.map(function (m) { return '<li>' + esc(c.known[m] ? c.known[m].label : m) + '</li>'; }).join('') + '</ul>'; box.appendChild(d); });
  }
