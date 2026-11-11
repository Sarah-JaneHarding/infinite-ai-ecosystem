/* INFINITE-AI Wiring Board intake: audit a custom widget and its agent contract, SMT ratification, private or public publishing,
   and a school's accept or reject of a widget offered to it. Nothing is stored or sent; every step makes a file. */
(function () {
  'use strict';
  var IAI = window.IAI; if (!IAI || IAI.__intake) return; IAI.__intake = true;
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function download(name, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function sha(t) { var b = new TextEncoder().encode(t); return crypto.subtle ? crypto.subtle.digest('SHA-256', b).then(function (d) { return 'sha256:' + Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }) : Promise.resolve('fnv32:' + IAI.hash32(t)); }
  var SEMVER = /^\d+\.\d+\.\d+$/, PLATFORM_ID = /^(CE|DW|SA|TB|PD|PF|AC|AI)-W\d{2}$/, CUSTOM_ID = /^CW-[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/;
  var S = { widget: null, contract: null, audit: null, smt: [], ratified: [], published: null, offer: null };

  /* ---------- audit ---------- */
  function add(list, level, area, text) { list.push({ level: level, area: area, text: text }); }
  function nameOk(n) { n = String(n || '').trim(); return n.length >= 3 && /\s/.test(n) && !/^[A-Za-z]{1,2}\d+$/.test(n) && !/\d{6,}/.test(n); }
  function auditWidget(html, L) {
    var m = /<script type="application\/json" id="iai-manifest">([\s\S]*?)<\/script>/.exec(html), man = null;
    if (!m) { add(L, 'fail', 'Widget contract', 'No widget manifest found (script id "iai-manifest").'); return null; }
    try { man = JSON.parse(m[1]); } catch (e) { add(L, 'fail', 'Widget contract', 'The manifest is not valid JSON.'); return null; }
    ['widgetId', 'version', 'name', 'humanGate', 'inputSchema', 'outputSchema', 'popia', 'emits', 'upstream'].forEach(function (k) { if (man[k] == null) add(L, 'fail', 'Widget contract', 'Manifest field "' + k + '" is missing.'); });
    if (man.version && !SEMVER.test(man.version)) add(L, 'fail', 'Widget contract', 'Version must look like 1.0.0.');
    if (man.widgetId) { if (PLATFORM_ID.test(man.widgetId)) add(L, 'fail', 'Widget contract', 'The id ' + man.widgetId + ' belongs to the platform. A custom widget id starts with CW-, for example CW-SCHOOL-01.'); else if (!CUSTOM_ID.test(man.widgetId)) add(L, 'fail', 'Widget contract', 'A custom widget id starts with CW- and uses letters, numbers and dashes.'); else add(L, 'pass', 'Widget contract', 'Id ' + man.widgetId + ' is a valid custom id.'); }
    if (man.humanGate) { var roles = man.humanGate.roles || (man.humanGate.role ? [man.humanGate.role] : []); if (!roles.length) add(L, 'fail', 'Human gate', 'No role is named to approve the output.'); else add(L, 'pass', 'Human gate', 'Output is approved by: ' + roles.join(', ') + '.'); }
    if (!/IAI\.init\s*\(/.test(html)) add(L, 'fail', 'Widget contract', 'The widget does not start through IAI.init, so the approval gate, envelope and edit log are not guaranteed.'); else add(L, 'pass', 'Widget contract', 'Starts through IAI.init (gate, envelope and edit log come from the kit).');
    if (man.popia) { if (!man.popia.purpose) add(L, 'fail', 'POPIA', 'No stated purpose.'); if (!man.popia.retention) add(L, 'fail', 'POPIA', 'No retention statement.'); if (man.popia.purpose && man.popia.retention) add(L, 'pass', 'POPIA', 'Purpose and retention are stated.'); if (man.popia.personalInfo === true) add(L, 'fail', 'POPIA', 'The manifest says the widget handles personal information. Custom widgets may use learner and staff codes only.'); }
    var vis = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    var pii = IAI.hardPII(IAI.scanInput({ page: vis, manifest: m[1] })); if (pii.length) add(L, 'fail', 'POPIA', 'Personal information found in the page text (' + pii[0].type + '). Replace it with synthetic data or codes.'); else add(L, 'pass', 'POPIA', 'No ID numbers, e-mail addresses or phone numbers in the page text.');
    var js = (html.match(/<script(?![^>]*application\/json)[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');
    [[/\bfetch\s*\(/, 'fetch()'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'], [/sendBeacon/, 'sendBeacon'], [/EventSource/, 'EventSource'], [/importScripts/, 'importScripts'], [/\beval\s*\(/, 'eval()'], [/new\s+Function\s*\(/, 'new Function()'], [/document\.cookie/, 'document.cookie'], [/window\.open\s*\(/, 'window.open()']].forEach(function (p) { if (p[0].test(js)) add(L, 'fail', 'Boundaries', 'The code uses ' + p[1] + '. Widgets run with no network and no dynamic code.'); });
    if (/<(script|link|img|iframe|form)\b[^>]*\s(src|href|action)\s*=\s*["']?https?:\/\//i.test(html)) add(L, 'fail', 'Boundaries', 'The page loads or posts to an outside address. Everything must be inside the one file.');
    if (!L.some(function (x) { return x.area === 'Boundaries'; })) add(L, 'pass', 'Boundaries', 'No network calls, dynamic code or outside addresses found.');
    if (/localStorage|sessionStorage|indexedDB/.test(js)) add(L, 'warn', 'POPIA', 'The code uses browser storage. State what is kept and for how long in the retention statement.');
    if (/rank(ing)?\s+(of\s+)?teachers?|leaderboard|score\s+(the\s+)?teachers?/i.test(vis + js)) add(L, 'fail', 'Standing rules', 'Teacher ranking or scoring is not allowed.');
    return man;
  }
  function auditContract(c, man, L) {
    if (!c) { add(L, 'fail', 'Agent contract', 'No agent contract supplied. Every custom widget needs one.'); return; }
    function need(k, t) { var v = c[k]; if (v == null || v === '') { add(L, 'fail', 'Agent contract', 'Field "' + k + '" is missing.'); return false; } if (t === 'array' && !Array.isArray(v)) { add(L, 'fail', 'Agent contract', '"' + k + '" must be a list.'); return false; } if (t && t !== 'array' && typeof v !== t) { add(L, 'fail', 'Agent contract', '"' + k + '" must be a ' + t + '.'); return false; } return true; }
    ['id', 'module', 'model', 'promptRef', 'evalSetRef'].forEach(function (k) { need(k, 'string'); });
    if (need('version', 'string') && !SEMVER.test(c.version)) add(L, 'fail', 'Agent contract', 'Agent version must look like 1.0.0.');
    if (need('purpose', 'string') && c.purpose.length < 30) add(L, 'fail', 'Agent contract', 'The purpose must say in a full sentence what the agent does and for whom (30 characters or more).');
    ['inputSchema', 'outputSchema'].forEach(function (k) { if (need(k, 'object') && !(c[k].type || c[k].oneOf || c[k].anyOf)) add(L, 'fail', 'Agent contract', '"' + k + '" is not a JSON Schema.'); });
    if (c.outputSchema && !JSON.stringify(c.outputSchema).match(/needs_input/)) add(L, 'warn', 'Agent contract', 'The output schema has no "needs_input" result. Agents must say what they are missing instead of guessing.');
    need('tools', 'array');
    if (need('guardrails', 'array')) { if (c.guardrails.indexOf('pii_guard') < 0) add(L, 'fail', 'Guardrails', 'The guardrail "pii_guard" is required.'); if (c.guardrails.indexOf('grounding_check') < 0) add(L, 'warn', 'Guardrails', 'No "grounding_check": outputs should cite their sources.'); }
    if (!c.budget || !(c.budget.maxTokens > 0 || c.budget.maxCostUsd > 0)) add(L, 'fail', 'Agent contract', 'A budget (maxTokens or maxCostUsd) is required.');
    if (typeof c.requiresApproval !== 'boolean') add(L, 'fail', 'Agent contract', '"requiresApproval" must be true or false.');
    if (typeof c.writesToBrain !== 'boolean') add(L, 'fail', 'Agent contract', '"writesToBrain" must be true or false.'); else if (c.writesToBrain && c.requiresApproval !== true) add(L, 'fail', 'Agent contract', 'An agent that writes to the Brain must require human approval.');
    if (!Array.isArray(c.rules) || c.rules.filter(function (r) { return typeof r === 'string' && r.length > 15; }).length < 3) add(L, 'fail', 'Rules', 'At least three clear rules are required ("rules": ["The agent must ...", ...]).'); else add(L, 'pass', 'Rules', c.rules.length + ' rules stated.');
    if (!Array.isArray(c.boundaries) || !c.boundaries.length) add(L, 'fail', 'Boundaries', 'State at least one boundary ("boundaries": ["Never ..."]).'); else if (!c.boundaries.some(function (b) { return /never|must not|may not|does not/i.test(b); })) add(L, 'warn', 'Boundaries', 'Boundaries should say what the agent never does.');
    var all = JSON.stringify(c.rules || []) + JSON.stringify(c.boundaries || []);
    if (!/human|teacher|decid|approv/i.test(all)) add(L, 'warn', 'Rules', 'No rule says a person decides. State it.');
    if (man && c.id && man.agentId && String(man.agentId).indexOf(c.id) !== 0) add(L, 'fail', 'Agent contract', 'The manifest names agent "' + man.agentId + '" but the contract id is "' + c.id + '".');
    if (!L.some(function (x) { return x.area === 'Agent contract' && x.level === 'fail'; })) add(L, 'pass', 'Agent contract', 'Required contract fields are present.');
  }
  function runAudit(html, contract) { var L = []; var man = auditWidget(html, L); auditContract(contract, man, L); return { items: L, man: man, fails: L.filter(function (x) { return x.level === 'fail'; }).length, warns: L.filter(function (x) { return x.level === 'warn'; }).length }; }
  IAI.intake = { audit: runAudit, state: S };

  /* ---------- Studio added to an ingested widget ---------- */
  function withStudio(html, man, contract) {
    if (/__IAI_STUDIO/.test(html) || !window.__IAI_STUDIO_SRC) return html;
    var cfg = { widgetId: man.widgetId, version: man.version, name: man.name }; if (contract) { cfg.agent = { id: contract.id, version: contract.version, module: contract.module, purpose: contract.purpose, model: contract.model, requiresApproval: contract.requiresApproval, guardrails: contract.guardrails, writesToBrain: contract.writesToBrain }; cfg.outputSchema = contract.outputSchema; }
    var i = html.lastIndexOf('<script>'); if (i < 0) return html;
    return html.slice(0, i) + '<script>window.__IAI_STUDIO=' + JSON.stringify(cfg).replace(/<\//g, '<\\/') + ';<\/script>\n<script>' + window.__IAI_STUDIO_SRC + '\n<\/script>\n' + html.slice(i);
  }
  function loadIntoBoard(name, html, man, contract) {
    var ing = window.__iaiBoardIng; if (!ing) return false;
    ing.addSynthetic([{ fileName: name, fileType: 'html', label: 'SOURCE DOCUMENT', text: man.name, raw: withStudio(html, man, contract) }]); return true;
  }

  /* ---------- UI ---------- */
  var UI;
  function badge(l) { return l === 'pass' ? '<span class="stOk">PASS</span>' : l === 'warn' ? '<span class="stGold">CHECK</span>' : '<span class="stBad">FAIL</span>'; }
  function read(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(f); }); }
  function msg(id, t, cls) { var n = $(id, UI); if (n) { n.className = cls || ''; n.textContent = t; } }
  function build() {
    var host = $('#app'); if (!host || $('#intakeZone')) return false;
    var sec = document.createElement('section'); sec.id = 'intakeZone'; sec.className = 'zone'; sec.setAttribute('aria-label', 'Custom widget intake');
    sec.innerHTML = '<style>#intakeZone .stOk{color:var(--cyan,#2DD4BF)}#intakeZone .stBad{color:var(--rose,#FB7185)}#intakeZone .stGold{color:var(--gold,#F5B841)}#intakeZone textarea{width:100%;min-height:5rem}#intakeZone table{font-size:.9rem;width:100%}#intakeZone td,#intakeZone th{padding:.25rem .4rem;text-align:left;vertical-align:top}</style>' +
      '<h2>5 · Custom widgets: audit, ratify, publish</h2><p class="cap">Bring in a widget a school made. The board audits it, the named SMT members ratify it, and the SMT chooses private or public. Nothing is sent from this page. Each step makes a file.</p>' +
      '<h3>A · Add and audit</h3><div class="row"><div><label for="inW">Widget file (.html)</label><input type="file" id="inW" accept=".html,text/html"></div><div><label for="inC">Agent contract (.json)</label><input type="file" id="inC" accept=".json,application/json"></div></div><p><button type="button" id="inAudit" class="pri">Audit this widget</button> <span id="inMsg" role="status"></span></p><div id="inRep"></div>' +
      '<h3>B · Alert the SMT and ratify</h3><p class="cap">List the SMT members who must ratify, one per line: <code>First Surname, Role</code>. At least two different people.</p><textarea id="inSmt" aria-label="SMT members" placeholder="Thandi Mokoena, Principal&#10;Sipho Naidoo, Deputy Principal"></textarea><p><button type="button" id="inAlert" disabled>Make the alert for these members</button> <span id="inAlertMsg" role="status"></span></p><div id="inRat"></div>' +
      '<h3>C · Publish</h3><p><label><input type="radio" name="inPub" value="private" checked> Private: stays in this school</label><br><label><input type="radio" name="inPub" value="public"> Public: offered to other schools after platform review</label></p><div id="inScrubBox" hidden><p class="cap">A public widget must carry no school-specific information. List what to remove, one per line: the school name, town, principal and staff names, staff codes, and anything else that identifies your school. These words are removed from the widget and its contract, and they are not written into the offer file.</p><textarea id="inScrubTerms" aria-label="Words to remove" placeholder="Benjamin Pine&#10;Durban&#10;Thandi Mokoena"></textarea><p><button type="button" id="inScrub">Remove school information and check</button></p><div id="inScrubRep"></div><div id="inScrubOk" hidden><p class="cap">One named SMT member confirms they have read the cleaned version.</p><div class="row"><div><label for="inScrubName">SMT member name</label><input id="inScrubName"></div><div><button type="button" id="inScrubConfirm">Confirm cleaned version</button></div></div></div></div><p><button type="button" id="inPublish" disabled>Complete publishing</button> <span id="inPubMsg" role="status"></span></p>' +
      '<h3>D · A widget or feature offered to this school</h3><p class="cap">Load an offer file. This school\'s named person accepts or rejects it. If accepted it is loaded into the board above for testing, editing to the school\'s template, ratification and wiring.</p><input type="file" id="inOffer" accept=".json,application/json" aria-label="Load offer file"><div id="inOfferBox"></div>';
    host.appendChild(sec); UI = sec; wire(); return true;
  }
  function wire() {
    $('#inAudit', UI).onclick = function () {
      var w = $('#inW', UI).files[0], c = $('#inC', UI).files[0]; if (!w) { msg('#inMsg', 'Choose the widget file.', 'stBad'); return; }
      Promise.all([read(w), c ? read(c) : Promise.resolve(null)]).then(function (r) {
        var contract = null; if (r[1]) { try { contract = JSON.parse(r[1]); } catch (e) { msg('#inMsg', 'The contract file is not valid JSON.', 'stBad'); return; } }
        S.widget = { name: w.name, html: r[0] }; S.contract = contract; S.ratified = []; S.published = null; S.clean = null; S.audit = runAudit(r[0], contract); S.widget.man = S.audit.man;
        var a = S.audit; $('#inRep', UI).innerHTML = '<p><strong>' + (a.fails ? '<span class="stBad">Not ready: ' + a.fails + ' must be fixed</span>' : '<span class="stOk">Passed</span>') + '</strong>' + (a.warns ? ' · <span class="stGold">' + a.warns + ' to check</span>' : '') + '</p><table><thead><tr><th></th><th>Area</th><th>Finding</th></tr></thead><tbody>' + a.items.map(function (x) { return '<tr><td>' + badge(x.level) + '</td><td>' + esc(x.area) + '</td><td>' + esc(x.text) + '</td></tr>'; }).join('') + '</tbody></table>';
        $('#inAlert', UI).disabled = !!a.fails; msg('#inMsg', a.fails ? 'Fix the failures and audit again.' : 'Audit passed. Next, alert the SMT.', a.fails ? 'stBad' : 'stOk'); $('#inRat', UI).innerHTML = ''; $('#inPublish', UI).disabled = true;
      });
    };
    $('#inAlert', UI).onclick = function () {
      var lines = $('#inSmt', UI).value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean), people = [], bad = [];
      lines.forEach(function (l) { var p = l.split(','); var n = (p[0] || '').trim(), r = (p.slice(1).join(',') || '').trim(); if (!nameOk(n) || !r) bad.push(l); else people.push({ name: n, role: r }); });
      var distinct = people.filter(function (p, i) { return people.findIndex(function (q) { return q.name.toLowerCase() === p.name.toLowerCase(); }) === i; });
      if (bad.length) { msg('#inAlertMsg', 'Each line needs a first name, surname and role: "' + bad[0] + '".', 'stBad'); return; } if (distinct.length < 2) { msg('#inAlertMsg', 'Name at least two different SMT members.', 'stBad'); return; }
      S.smt = distinct; S.ratified = [];
      var notice = { kind: 'iai.widget.smt-alert', widgetId: S.widget.man.widgetId, version: S.widget.man.version, name: S.widget.man.name, to: distinct, auditFails: S.audit.fails, auditChecks: S.audit.warns, message: 'A custom widget has passed the audit and needs your ratification before it is wired in. Open the Wiring Board, load the widget, and ratify with your name.', createdAt: new Date().toISOString() };
      download(notice.widgetId + '-smt-alert.json', JSON.stringify(notice, null, 2)); msg('#inAlertMsg', 'Alert file made for ' + distinct.length + ' members. This page cannot send it; give it to them.', 'stGold'); drawRat();
    };
    $('#inPublish', UI).onclick = completePublish; $('#inScrub', UI).onclick = doScrub; $('#inScrubConfirm', UI).onclick = confirmScrub; UI.querySelectorAll('input[name=inPub]').forEach(function (r) { r.onchange = pubChoice; });
    $('#inOffer', UI).onchange = function (e) { var f = e.target.files[0]; if (!f) return; read(f).then(function (t) { try { showOffer(JSON.parse(t)); } catch (x) { $('#inOfferBox', UI).innerHTML = '<p class="stBad">Not a valid offer file.</p>'; } }); };
  }
  function drawRat() {
    var h = '<table><thead><tr><th>SMT member</th><th>Role</th><th>Ratification</th></tr></thead><tbody>' + S.smt.map(function (p, i) { var r = S.ratified.filter(function (x) { return x.name.toLowerCase() === p.name.toLowerCase(); })[0]; return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.role) + '</td><td>' + (r ? '<span class="stOk">Ratified ' + esc(r.time.slice(0, 16).replace('T', ' ')) + '</span>' : '<input data-nm="' + i + '" placeholder="Type your full name" aria-label="Name of ' + esc(p.name) + '"> <button type="button" data-rt="' + i + '">Ratify</button>') + '</td></tr>'; }).join('') + '</tbody></table><p><label for="inWhy">Reason or comment</label><input id="inWhy" style="width:100%"></p><p id="inRatMsg" role="status"></p>';
    $('#inRat', UI).innerHTML = h;
    UI.querySelectorAll('[data-rt]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-rt'), p = S.smt[i], typed = $('[data-nm="' + i + '"]', UI).value.trim();
        if (typed.toLowerCase() !== p.name.toLowerCase()) { msg('#inRatMsg', 'The name typed must be ' + p.name + '. Only the named member can ratify.', 'stBad'); return; }
        sha(JSON.stringify({ w: S.widget.html, c: S.contract })).then(function (h) { var idn = window.IAI_IDENTITY && window.IAI_IDENTITY.accountId ? window.IAI_IDENTITY : null; if (idn && idn.name.toLowerCase() !== p.name.toLowerCase()) { msg('#inRatMsg', 'You are signed in as ' + idn.name + '. Only ' + p.name + ' can ratify for ' + p.name + '.', 'stBad'); return; } S.ratified.push({ name: p.name, role: p.role, accountId: idn ? idn.accountId : null, identityVerified: !!idn, time: new Date().toISOString(), reason: ($('#inWhy', UI).value || '').trim(), contentHash: h }); drawRat(); $('#inPublish', UI).disabled = S.ratified.length < S.smt.length; if (S.ratified.length >= S.smt.length) msg('#inRatMsg', 'All named SMT members have ratified. Choose private or public.', 'stOk'); });
      };
    });
  }

  /* ---------- public widgets carry no school-specific information ---------- */
  function esca(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var GENERIC = [[/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'e-mail address'], [/(?:\+27|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, 'phone number'], [/\b\d{13}\b/g, 'ID-style number'], [/\bPERSAL[\s:#-]*\d+/gi, 'PERSAL number'], [/https?:\/\/(?!www\.w3\.org)[^\s"'<>)]+/g, 'web address']];
  function scrubText(t, terms, count, genericFrom) {
    terms.forEach(function (w) { var re = new RegExp(esca(w), 'gi'); t = t.replace(re, function () { count.terms++; return '[school detail removed]'; }); });
    var cut = genericFrom || 0, head = t.slice(0, cut), tail = t.slice(cut);   /* shared kit code is not school content: only the widget's own part is pattern-scrubbed */
    GENERIC.forEach(function (g) { tail = tail.replace(g[0], function (m) { if (/^https?:\/\/(www\.)?(w3\.org|json-schema\.org)/i.test(m)) return m; count.generic[g[1]] = (count.generic[g[1]] || 0) + 1; return '[removed]'; }); });
    return head + tail;
  }
  function doScrub() {
    var terms = $('#inScrubTerms', UI).value.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 3; });
    if (!terms.length) { $('#inScrubRep', UI).innerHTML = '<p class="stBad">List at least the school name to remove.</p>'; return; }
    var cnt = { terms: 0, generic: {} }, wm = /\n<script>\n\(function \(\) \{\n  'use strict';/.exec(S.widget.html), html = scrubText(S.widget.html, terms, cnt, wm ? wm.index : S.widget.html.length), contract = S.contract ? JSON.parse(scrubText(JSON.stringify(S.contract), terms, cnt, 0)) : null;
    var left = terms.filter(function (w) { return new RegExp(esca(w), 'i').test(html + JSON.stringify(contract)); });
    var a = runAudit(html, contract), problems = a.fails + left.length;
    S.clean = { html: html, contract: contract, counts: cnt, termsListed: terms.length, auditFails: a.fails, confirmedBy: null };
    var gen = Object.keys(cnt.generic).map(function (k) { return cnt.generic[k] + ' ' + k + '(s)'; }).join(', ');
    $('#inScrubRep', UI).innerHTML = '<p>' + cnt.terms + ' school detail(s) removed' + (gen ? ', plus ' + esc(gen) : '') + '. ' + (problems ? '<span class="stBad">The cleaned widget fails the audit: ' + esc(a.items.filter(function (x) { return x.level === 'fail'; }).map(function (x) { return x.text; }).slice(0, 2).join(' ')) + ' Choose words that do not break the widget id or code.</span>' : '<span class="stOk">The cleaned widget passes the audit and none of your listed words remain.</span>') + '</p><p class="cap">Also check the example data and any template text yourself: a list of words cannot find every school-specific detail.</p>';
    $('#inScrubOk', UI).hidden = !!problems; $('#inPublish', UI).disabled = true;
  }
  function confirmScrub() {
    var n = $('#inScrubName', UI).value.trim(), p = S.smt.filter(function (x) { return x.name.toLowerCase() === n.toLowerCase(); })[0];
    if (!p) { msg('#inPubMsg', 'The confirming person must be one of the named SMT members.', 'stBad'); return; }
    S.clean.confirmedBy = { name: p.name, role: p.role, time: new Date().toISOString() }; $('#inPublish', UI).disabled = false; msg('#inPubMsg', 'Cleaned version confirmed by ' + p.name + '. You can complete publishing.', 'stOk');
  }
  function pubChoice() {
    var pub = $('input[name=inPub]:checked', UI).value === 'public'; $('#inScrubBox', UI).hidden = !pub;
    $('#inPublish', UI).disabled = S.ratified.length < S.smt.length || !S.smt.length || (pub && !(S.clean && S.clean.confirmedBy));
  }
  function completePublish() {
    var mode = $('input[name=inPub]:checked', UI).value, man = S.widget.man;
    if (mode === 'public' && !(S.clean && S.clean.confirmedBy)) { msg('#inPubMsg', 'Remove school information and confirm the cleaned version first.', 'stBad'); return; }
    var pubHtml = mode === 'public' ? S.clean.html : S.widget.html, pubContract = mode === 'public' ? S.clean.contract : S.contract, pubAudit = mode === 'public' ? runAudit(pubHtml, pubContract) : S.audit; if (mode === 'public') man = pubAudit.man;
    sha(JSON.stringify({ w: pubHtml, c: pubContract })).then(function (h) {
      var pkg = { kind: mode === 'public' ? 'iai.widget.offer' : 'iai.widget.intake', packageVersion: 1, widgetId: man.widgetId, version: man.version, name: man.name, visibility: mode, status: mode === 'public' ? 'submitted_for_platform_review' : 'ratified_private', identityNote: S.ratified.every(function (r) { return r.identityVerified; }) ? 'All ratifiers were signed-in accounts.' : 'At least one ratifier is a typed name only; the registry will not accept this until signed-in accounts ratify.', contentHash: h, ratifiedBy: S.ratified, audit: { fails: pubAudit.fails, checks: pubAudit.warns, items: pubAudit.items }, agentContract: pubContract, widgetHtml: pubHtml, schoolInfoRemoved: mode === 'public', scrub: mode === 'public' ? { itemsRemoved: S.clean.counts.terms, otherItemsRemoved: S.clean.counts.generic, termsListed: S.clean.termsListed, confirmedBy: S.clean.confirmedBy } : null, createdAt: new Date().toISOString(), note: mode === 'public' ? 'Not live. A platform operator must review before any school sees it (OQ-039).' : 'Stays in this school.' };
      download(man.widgetId + '-' + (mode === 'public' ? 'offer' : 'intake') + '.json', JSON.stringify(pkg, null, 2)); S.published = pkg;
      if (mode === 'private') { var ok = loadIntoBoard(S.widget.name, S.widget.html, man, S.contract); msg('#inPubMsg', 'Private. ' + (ok ? 'Loaded into the board above to test and wire.' : 'Load the widget file into the board above to test and wire.'), 'stOk'); }
      else msg('#inPubMsg', 'Public offer file made. It is submitted for platform review, not live.', 'stOk');
    });
  }
  function showOffer(o) {
    if (o.kind !== 'iai.widget.offer' && o.kind !== 'iai.widget.feature') { $('#inOfferBox', UI).innerHTML = '<p class="stBad">This is not an offer file.</p>'; return; }
    S.offer = o; var a = runAudit(o.widgetHtml || '', o.agentContract || null); if (o.kind === 'iai.widget.offer' && o.schoolInfoRemoved !== true) add(a.items, 'fail', 'School information', 'This offer is not marked as cleaned of school-specific information.'), a.fails++;
    $('#inOfferBox', UI).innerHTML = '<p><strong>' + esc(o.name) + '</strong> · ' + esc(o.widgetId) + ' v' + esc(o.version) + ' · ' + esc(o.kind === 'iai.widget.feature' ? 'new platform feature' : 'offered by another school') + '</p><p>Checked again on arrival: ' + (a.fails ? '<span class="stBad">' + a.fails + ' failure(s). It cannot be accepted.</span>' : '<span class="stOk">passed</span>') + (a.warns ? ' · <span class="stGold">' + a.warns + ' to check</span>' : '') + '</p><p>Ratified at the source by: ' + esc((o.ratifiedBy || []).map(function (r) { return r.name + ' (' + r.role + ')'; }).join('; ') || 'nobody') + '</p><div class="row"><div><label for="inAn">Name of this school\'s person deciding</label><input id="inAn"></div><div><label for="inAr">Their role</label><input id="inAr"></div></div><p><label for="inAw">Reason</label><input id="inAw" style="width:100%"></p><p><button type="button" id="inAcc"' + (a.fails ? ' disabled' : '') + '>Accept and load into the board</button> <button type="button" id="inRej">Reject</button> <span id="inOfMsg" role="status"></span></p>';
    function decide(acc) {
      var n = $('#inAn', UI).value.trim(), r = $('#inAr', UI).value.trim(), w = $('#inAw', UI).value.trim();
      if (!nameOk(n) || !r) { msg('#inOfMsg', 'Type the first name, surname and role of the person deciding.', 'stBad'); return; } if (!w) { msg('#inOfMsg', 'Give a reason.', 'stBad'); return; }
      var rec = { kind: 'iai.widget.offer-decision', widgetId: o.widgetId, version: o.version, decision: acc ? 'accepted' : 'rejected', by: { name: n, role: r }, reason: w, time: new Date().toISOString(), contentHash: o.contentHash };
      download(o.widgetId + '-' + rec.decision + '.json', JSON.stringify(rec, null, 2));
      if (acc) { var ok = loadIntoBoard(o.widgetId + '.html', o.widgetHtml, a.man, o.agentContract); msg('#inOfMsg', 'Accepted. ' + (ok ? 'Loaded into the board. Test it, edit it in its Studio panel to your template, have your named person ratify it, then wire it.' : 'Load the widget into the board to continue.'), 'stOk'); } else msg('#inOfMsg', 'Rejected. The decision file records who and why.', 'stGold');
    }
    $('#inAcc', UI).onclick = function () { decide(true); }; $('#inRej', UI).onclick = function () { decide(false); };
  }
  function start() { var n = 0, t = setInterval(function () { if (build()) clearInterval(t); else if (++n > 120) clearInterval(t); }, 150); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
