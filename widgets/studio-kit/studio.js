/* INFINITE-AI Studio add-on: output file pane, schema revisions, named ratification, release packages, version history and rollback,
   and a check of the output against the agent contract in the repo. Added to every widget. Nothing is stored or sent. */
(function () {
  'use strict';
  var IAI = window.IAI; if (!IAI || IAI.__studio) return; IAI.__studio = true;
  var CORES = [], origMake = IAI.makeCore;
  IAI.makeCore = function () { var c = origMake.apply(this, arguments); CORES.push(c); return c; };
  function core() { return CORES[CORES.length - 1]; }
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CFG = window.__IAI_STUDIO || {}, NIL = '00000000-0000-4000-8000-000000000000';
  var ROLES = ['Principal', 'Deputy Principal', 'Head of Department', 'HoD', 'SMT', 'School Management Team', 'PD coordinator', 'Information Officer', 'SBST chairperson', 'Teacher'];
  var S = { extra: {}, ids: {}, rev: 0, version: CFG.version || '0.1.0', history: [], pending: null, ratified: null, loaded: [], lastHash: null };

  /* ---------- JSON Schema subset validator (what zod emits) ---------- */
  function validate(schema, v, root, path, errs) {
    root = root || schema; path = path || ''; errs = errs || [];
    if (!schema || schema === true) return errs;
    if (schema.$ref) { var t = String(schema.$ref).replace(/^#\//, '').split('/').reduce(function (o, k) { return o && o[k]; }, root); return validate(t, v, root, path, errs); }
    if (schema.allOf) { schema.allOf.forEach(function (s) { validate(s, v, root, path, errs); }); }
    var alts = schema.oneOf || schema.anyOf;
    if (alts) {
      var best = null;
      for (var i = 0; i < alts.length; i++) { var e2 = validate(alts[i], v, root, path, []); if (!e2.length) { best = null; break; } if (!best || e2.length < best.length) best = e2; }
      if (best) errs.push.apply(errs, best.length > 3 ? best.slice(0, 3).concat([{ path: path, msg: 'no option of ' + alts.length + ' matched (closest option shown)' }]) : best);
      return errs;
    }
    var type = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : null;
    function is(t) { return t === 'null' ? v === null : t === 'array' ? Array.isArray(v) : t === 'object' ? (v !== null && typeof v === 'object' && !Array.isArray(v)) : t === 'integer' ? (typeof v === 'number' && isFinite(v) && v === Math.floor(v)) : t === 'number' ? (typeof v === 'number' && isFinite(v)) : typeof v === t; }
    if (v === undefined) { errs.push({ path: path, msg: 'missing' }); return errs; }
    if (type && !type.some(is)) { errs.push({ path: path, msg: 'should be ' + type.join(' or ') + (v === null ? ', is null' : '') }); return errs; }
    if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(v)) errs.push({ path: path, msg: 'must be ' + JSON.stringify(schema.const) });
    if (schema.enum && schema.enum.map(function (x) { return JSON.stringify(x); }).indexOf(JSON.stringify(v)) < 0) errs.push({ path: path, msg: 'must be one of ' + schema.enum.slice(0, 8).join(', ') });
    if (typeof v === 'string') {
      if (schema.minLength != null && v.length < schema.minLength) errs.push({ path: path, msg: 'is empty or too short' });
      if (schema.maxLength != null && v.length > schema.maxLength) errs.push({ path: path, msg: 'is too long' });
      if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) errs.push({ path: path, msg: 'must be a UUID' });
      else if (schema.format === 'date-time' && !(/^\d{4}-\d{2}-\d{2}T/.test(v) && !isNaN(Date.parse(v)))) errs.push({ path: path, msg: 'must be an ISO date-time' });
      else if (schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push({ path: path, msg: 'has the wrong format' });
    }
    if (typeof v === 'number') {
      if (schema.minimum != null && v < schema.minimum) errs.push({ path: path, msg: 'is below ' + schema.minimum });
      if (schema.maximum != null && v > schema.maximum) errs.push({ path: path, msg: 'is above ' + schema.maximum });
      if (schema.exclusiveMinimum != null && v <= schema.exclusiveMinimum) errs.push({ path: path, msg: 'must be above ' + schema.exclusiveMinimum });
    }
    if (Array.isArray(v)) {
      if (schema.minItems != null && v.length < schema.minItems) errs.push({ path: path, msg: 'needs at least ' + schema.minItems + ' item(s)' });
      if (schema.maxItems != null && v.length > schema.maxItems) errs.push({ path: path, msg: 'allows at most ' + schema.maxItems + ' item(s)' });
      if (schema.items) v.forEach(function (x, i) { validate(schema.items, x, root, path + '[' + i + ']', errs); });
    } else if (v && typeof v === 'object') {
      (schema.required || []).forEach(function (k) { if (v[k] === undefined) errs.push({ path: path ? path + '.' + k : k, msg: 'is required by the agent contract and is missing' }); });
      var pr = schema.properties || {};
      Object.keys(pr).forEach(function (k) { if (v[k] !== undefined) validate(pr[k], v[k], root, path ? path + '.' + k : k, errs); });
      if (schema.additionalProperties === false) Object.keys(v).forEach(function (k) { if (!(k in pr)) errs.push({ path: path ? path + '.' + k : k, msg: 'is not part of the agent contract' }); });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') Object.keys(v).forEach(function (k) { if (!(k in pr)) validate(schema.additionalProperties, v[k], root, path + '.' + k, errs); });
    }
    return errs;
  }
  IAI.studioValidate = validate;

  /* ---------- small helpers ---------- */
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }); }
  function sha(text) { var b = new TextEncoder().encode(text); if (window.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', b).then(function (d) { return 'sha256:' + Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); return Promise.resolve('fnv32:' + IAI.hash32(text)); }
  function human(k) { return String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function bump(v) { var p = String(v).split('.').map(Number); if (p.length !== 3 || p.some(isNaN)) return '0.1.1'; p[2]++; return p.join('.'); }
  function download(name, text, mime) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function infer(v) {
    if (v === null) return { type: 'null' }; if (Array.isArray(v)) { var o = v.length ? infer(v[0]) : {}; return { type: 'array', items: o }; }
    if (typeof v === 'object') { var pr = {}; Object.keys(v).sort().forEach(function (k) { pr[k] = infer(v[k]); }); return { type: 'object', properties: pr }; }
    return { type: typeof v === 'number' ? (v === Math.floor(v) ? 'integer' : 'number') : typeof v };
  }
  function who() { var i = window.IAI_IDENTITY; return i && i.accountId && i.name ? i : null; }
  function env() { var c = core(); return c && c.st && c.st.env; }
  function mainArray(p) {
    var best = null, bp = null; (function walk(o, path) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { if (o.length && o.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) { if (!best || o.length * Object.keys(o[0]).length > best.length * Object.keys(best[0]).length) { best = o; bp = path; } } return; } Object.keys(o).forEach(function (k) { walk(o[k], path ? path + '.' + k : k); }); })(p, '');
    return best ? { path: bp, rows: best } : null;
  }

  /* ---------- format converters ---------- */
  function flatCell(v) { return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); }
  function toCSV(p) {
    var m = mainArray(p); if (!m) return 'field,value\n' + Object.keys(p).map(function (k) { return q(k) + ',' + q(flatCell(p[k])); }).join('\n');
    var cols = []; m.rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    return cols.map(q).join(',') + '\n' + m.rows.map(function (r) { return cols.map(function (c) { return q(flatCell(r[c])); }).join(','); }).join('\n');
    function q(s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  }
  function parseCSV(t) {
    var rows = [], row = [], cur = '', inq = false;
    for (var i = 0; i < t.length; i++) { var c = t[i]; if (inq) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inq = false; else cur += c; } else if (c === '"') inq = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); } return rows;
  }
  function toMD(p, lvl) {
    lvl = lvl || 2; var out = [];
    Object.keys(p).forEach(function (k) {
      var v = p[k]; if (v === null || v === undefined) return;
      if (Array.isArray(v)) {
        if (!v.length) return; out.push(new Array(lvl + 1).join('#') + ' ' + human(k));
        if (v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) { var cols = []; v.forEach(function (r) { Object.keys(r).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); }); }); out.push('| ' + cols.map(human).join(' | ') + ' |', '|' + cols.map(function () { return '---'; }).join('|') + '|'); v.forEach(function (r) { out.push('| ' + cols.map(function (c) { return flatCell(r[c]).replace(/\|/g, '/').replace(/\n/g, ' '); }).join(' | ') + ' |'); }); }
        else v.forEach(function (x) { out.push('- ' + flatCell(x)); });
        out.push('');
      } else if (typeof v === 'object') { out.push(new Array(lvl + 1).join('#') + ' ' + human(k), toMD(v, Math.min(lvl + 1, 6)), ''); }
      else out.push('**' + human(k) + ':** ' + v);
    });
    return out.join('\n');
  }
  function toHTML(p, title) {
    var css = 'body{font:16px/1.5 Inter,system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}h1,h2,h3{font-family:Space Grotesk,system-ui,sans-serif}table{border-collapse:collapse;width:100%;margin:.5rem 0}td,th{border:1px solid #bbb;padding:.35rem .5rem;text-align:left;vertical-align:top}th{background:#eee}footer{margin-top:2rem;color:#555;font-size:.85rem}';
    return '<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + css + '</style></head><body><h1>' + esc(title) + '</h1>' + body(p, 2) + '<footer>AI drafts. The teacher decides. Always.</footer></body></html>';
    function body(o, l) {
      var h = ''; Object.keys(o).forEach(function (k) {
        var v = o[k]; if (v === null || v === undefined) return;
        if (Array.isArray(v)) { if (!v.length) return; h += '<h' + l + '>' + esc(human(k)) + '</h' + l + '>'; if (v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) { var cols = []; v.forEach(function (r) { Object.keys(r).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); }); }); h += '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(human(c)) + '</th>'; }).join('') + '</tr></thead><tbody>' + v.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(flatCell(r[c])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; } else h += '<ul>' + v.map(function (x) { return '<li>' + esc(flatCell(x)) + '</li>'; }).join('') + '</ul>'; }
        else if (typeof v === 'object') h += '<h' + l + '>' + esc(human(k)) + '</h' + l + '>' + body(v, Math.min(l + 1, 6));
        else h += '<p><strong>' + esc(human(k)) + ':</strong> ' + esc(v) + '</p>';
      }); return h;
    }
  }

  /* ---------- editable document view ---------- */
  var FIELD_N = 0;
  function docView(o, path, depth) {
    var h = ''; var keys = Object.keys(o);
    keys.forEach(function (k) {
      var v = o[k], p = path ? path + '.' + k : k;
      if (v === null || v === undefined) { h += field(k, p, '', 'null'); return; }
      if (Array.isArray(v)) {
        h += '<h4 class="stH">' + esc(human(k)) + ' <span class="cap">(' + v.length + ')</span></h4>';
        if (v.length && v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); })) {
          var cols = []; v.forEach(function (r) { Object.keys(r).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); }); });
          h += '<div class="tw"><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(human(c)) + '</th>'; }).join('') + '</tr></thead><tbody>' + v.map(function (r, i) { return '<tr>' + cols.map(function (c) { var cv = r[c]; if (cv !== null && typeof cv === 'object') return '<td><span class="cap">' + esc(JSON.stringify(cv).slice(0, 80)) + '</span></td>'; return '<td>' + cell(p + '.' + i + '.' + c, cv) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        } else h += '<ul>' + v.map(function (x, i) { return '<li>' + (x !== null && typeof x === 'object' ? '<span class="cap">' + esc(JSON.stringify(x).slice(0, 120)) + '</span>' : cell(p + '.' + i, x)) + '</li>'; }).join('') + '</ul>';
      } else if (typeof v === 'object') { h += '<h4 class="stH">' + esc(human(k)) + '</h4><div class="stInd">' + docView(v, p, depth + 1) + '</div>'; }
      else h += field(k, p, v, typeof v);
    }); return h;
  }
  function cell(p, v) { return '<span class="stEd" contenteditable="true" spellcheck="true" data-path="' + esc(p) + '" data-type="' + (v === null ? 'null' : typeof v) + '">' + esc(v == null ? '' : v) + '</span>'; }
  function field(k, p, v, t) { return '<p class="stF"><strong>' + esc(human(k)) + ':</strong> ' + cell(p, v).replace('data-type="null"', 'data-type="' + t + '"') + '</p>'; }
  function applyDocEdits(root) {
    var e = env(); if (!e) return null; var out = IAI.clone(e.payload), changed = 0, bad = [];
    root.querySelectorAll('.stEd').forEach(function (n) {
      var path = n.getAttribute('data-path'), t = n.getAttribute('data-type'), raw = n.textContent, before = IAI.getPath(e.payload, path), val = raw;
      if (t === 'number') { var x = Number(raw.trim()); if (raw.trim() === '' || isNaN(x)) { bad.push(path + ' must be a number'); return; } val = x; }
      else if (t === 'boolean') { var s = raw.trim().toLowerCase(); if (s !== 'true' && s !== 'false') { bad.push(path + ' must be true or false'); return; } val = s === 'true'; }
      else if (t === 'null') { if (raw.trim() === '') val = null; }
      if (JSON.stringify(val) !== JSON.stringify(before)) { IAI.setPath(out, path, val); changed++; }
    });
    return { payload: out, changed: changed, bad: bad };
  }

  /* ---------- the panel ---------- */
  var UI = null;
  function build() {
    var host = $('#app'); if (!host || !$('#outJson') || $('#studioZone')) return false;
    var sec = document.createElement('section'); sec.id = 'studioZone'; sec.className = 'zone z-out'; sec.setAttribute('aria-label', 'Studio');
    sec.innerHTML = '<style>#studioZone .stTabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}#studioZone .stTabs button{padding:.4rem .7rem}#studioZone .stTabs button[aria-pressed=true]{outline:2px solid var(--violet,#7C5CFF)}#studioZone .stEd{display:inline-block;min-width:2ch;padding:0 .2rem;border-bottom:1px dashed var(--muted,#8FA0C2);outline-offset:2px}#studioZone .stEd:focus{background:rgba(124,92,255,.15)}#studioZone .stH{margin:.8rem 0 .3rem;font-family:"Space Grotesk",system-ui,sans-serif}#studioZone .stInd{margin-left:.8rem;padding-left:.6rem;border-left:2px solid rgba(143,160,194,.3)}#studioZone .stBox{max-height:28rem;overflow:auto;border:1px solid rgba(143,160,194,.25);border-radius:8px;padding:.6rem;background:rgba(255,255,255,.02)}#studioZone textarea{width:100%;min-height:12rem;font-family:monospace}#studioZone .stRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem}#studioZone .stOk{color:var(--cyan,#2DD4BF)}#studioZone .stBad{color:var(--rose,#FB7185)}#studioZone .stGold{color:var(--gold,#F5B841)}#studioZone table{font-size:.9rem}</style>' +
      '<h2>4 · Studio: file, schema, ratify, release</h2><p class="cap">View the output as a file, change it, and save. A saved change makes a new schema revision. A named person must ratify the revision before it can be sent to code. Nothing is stored here; the release package is a file you download.</p>' +
      '<div class="stTabs" role="tablist"><button type="button" class="btn secondary" data-tab="doc" aria-pressed="true">Document view</button><button type="button" class="btn secondary" data-tab="file" aria-pressed="false">File view</button><button type="button" class="btn secondary" data-tab="contract" aria-pressed="false">Agent contract</button><button type="button" class="btn secondary" data-tab="rev" aria-pressed="false">Revision and ratification</button><button type="button" class="btn secondary" data-tab="hist" aria-pressed="false">Versions and rollback</button></div>' +
      '<div data-pane="doc"><p class="cap" id="stDocCap">Run the widget to see its output here.</p><div class="stBox" id="stDoc"></div><p><label for="stWhy1">Reason for this change</label><input id="stWhy1" style="width:100%"></p><p><button type="button" class="btn" id="stSave">Save my edits</button> <span id="stSaveMsg" role="status"></span></p></div>' +
      '<div data-pane="file" hidden><div class="stRow"><div><label for="stFmt">File type</label><select id="stFmt"><option value="json">JSON (.json)</option><option value="csv">Table (.csv)</option><option value="md">Document (.md)</option><option value="html">Web page (.html)</option></select></div></div><textarea id="stFile" spellcheck="false" aria-label="File contents"></textarea><p class="cap" id="stFileCap"></p><p><button type="button" class="btn secondary" id="stApplyFile">Use my changes to this file</button> <button type="button" class="btn secondary" id="stDl">Download this file</button> <span id="stFileMsg" role="status"></span></p></div>' +
      '<div data-pane="contract" hidden id="stContract"></div>' +
      '<div data-pane="rev" hidden><div id="stRev"></div><div class="stRow"><div><label for="stName">Name of the person ratifying</label><input id="stName" autocomplete="off" placeholder="First name and surname"></div><div><label for="stRole">Role</label><select id="stRole">' + ROLES.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></div></div><p><label for="stWhy2">Reason (what changed and why)</label><input id="stWhy2" style="width:100%"></p><p><button type="button" class="btn" id="stRatify">Ratify this revision</button> <button type="button" class="btn" id="stSend" disabled>Send to code (download release package)</button> <span id="stRevMsg" role="status"></span></p></div>' +
      '<div data-pane="hist" hidden><p class="cap">Load earlier release packages (.json) of this widget. To roll back, choose a version and give your name and a reason; the roll-back becomes a new revision that a named person must ratify, like any other change.</p><input type="file" id="stLoad" accept=".json,application/json" multiple aria-label="Load release packages"><div id="stHist"></div></div>';
    var z = $('#z-out') || $('main') || host; (z.parentNode || host).insertBefore(sec, z.nextSibling); UI = sec; wire(sec); return true;
  }
  function lockWho() { var id = who(); if (!id || !UI) return; var n = $('#stName', UI); n.value = id.name; n.readOnly = true; if (id.role) { var r = $('#stRole', UI); if (!Array.prototype.some.call(r.options, function (o) { return o.value === id.role; })) r.add(new Option(id.role)); r.value = id.role; r.disabled = true; } }
  function show(tab) { lockWho(); UI.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tab; }); UI.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false'); }); if (tab === 'file') fillFile(); if (tab === 'contract') renderContract(); if (tab === 'rev') renderRev(); if (tab === 'hist') renderHist(); }
  function msg(id, t, cls) { var n = $(id, UI); n.className = cls || ''; n.textContent = t; }
  function name() { return (CFG.name || (window.__man && window.__man.name) || CFG.widgetId || 'Widget') + ' output'; }
  function manifest() { try { return JSON.parse($('#iai-manifest').textContent); } catch (e) { return {}; } }

  function pushEdit(payload, reason, source) {
    var oldIn = $('#outJson').value, why = $('#decReason'); $('#outJson').value = JSON.stringify(payload, null, 2);
    var roleSel = $('#decRole'); var prevRole = roleSel && roleSel.value; if (roleSel && !roleSel.value && roleSel.options.length > 1) roleSel.selectedIndex = 1;
    if (why) why.value = reason; $('#btnApplyJson').click();
    var m = $('#decMsg') ? $('#decMsg').textContent : ''; if (/not valid JSON|Choose the role|Give a reason|No change/i.test(m)) { $('#outJson').value = oldIn; return { ok: false, text: m }; }
    return { ok: true, text: m };
  }

  function wire(root) {
    root.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { show(b.getAttribute('data-tab')); }; });
    $('#stSave', root).onclick = function () {
      var why = $('#stWhy1', root).value.trim(); if (!env()) { msg('#stSaveMsg', 'Run the widget first.', 'stBad'); return; }
      var r = applyDocEdits($('#stDoc', root)); if (r.bad.length) { msg('#stSaveMsg', r.bad.join('; '), 'stBad'); return; } if (!r.changed) { msg('#stSaveMsg', 'No change to save.', 'stGold'); return; }
      if (!why) { msg('#stSaveMsg', 'Give the reason for the change.', 'stBad'); return; }
      var res = pushEdit(r.payload, why); if (!res.ok) { msg('#stSaveMsg', res.text, 'stBad'); return; }
      newRevision(why, 'edit'); msg('#stSaveMsg', r.changed + ' change(s) saved as revision ' + S.rev + '. Open "Revision and ratification" to ratify it.', 'stOk');
    };
    $('#stFmt', root).onchange = fillFile;
    $('#stDl', root).onclick = function () { var f = $('#stFmt', root).value, e = env(); if (!e) return; var mime = { json: 'application/json', csv: 'text/csv', md: 'text/markdown', html: 'text/html' }[f]; var t = f === 'json' ? JSON.stringify(e.payload, null, 2) : f === 'csv' ? toCSV(e.payload) : f === 'md' ? '# ' + name() + '\n\n' + toMD(e.payload) : toHTML(e.payload, name()); download((CFG.widgetId || 'widget') + '-output.' + f, t, mime); };
    $('#stApplyFile', root).onclick = function () {
      var f = $('#stFmt', root).value, e = env(), why = $('#stWhy1', root).value.trim(); if (!e) return;
      if (f === 'md' || f === 'html') { msg('#stFileMsg', 'Edit Markdown and web page output in the Document view, where each field is checked. This file view is for reading and download.', 'stGold'); return; }
      if (!why) { msg('#stFileMsg', 'Give the reason for the change in the Document view box first.', 'stBad'); return; }
      var out = IAI.clone(e.payload), txt = $('#stFile', root).value;
      try {
        if (f === 'json') out = JSON.parse(txt);
        else { var m = mainArray(e.payload); if (!m) throw new Error('This output has no table to read back.'); var rows = parseCSV(txt); var cols = rows.shift(); var orig = m.rows; if (rows.length !== orig.length) throw new Error('The table has ' + rows.length + ' rows, the output has ' + orig.length + '. Add or remove rows in the JSON instead.'); var arr = rows.map(function (r, i) { var o = IAI.clone(orig[i]); cols.forEach(function (c, j) { var ov = orig[i][c]; var s = r[j]; if (ov !== null && typeof ov === 'object') return; o[c] = typeof ov === 'number' ? (s.trim() === '' || isNaN(Number(s)) ? (function () { throw new Error('Row ' + (i + 2) + ', ' + c + ' must be a number.'); })() : Number(s)) : typeof ov === 'boolean' ? s.trim().toLowerCase() === 'true' : s; }); return o; }); IAI.setPath(out, m.path, arr); }
      } catch (err) { msg('#stFileMsg', 'Could not read the file: ' + err.message, 'stBad'); return; }
      var res = pushEdit(out, why); if (!res.ok) { msg('#stFileMsg', res.text, 'stBad'); return; } newRevision(why, 'edit'); msg('#stFileMsg', 'Saved as revision ' + S.rev + '.', 'stOk');
    };
    $('#stRatify', root).onclick = ratify;
    $('#stSend', root).onclick = sendToCode;
    $('#stLoad', root).onchange = loadPackages;
  }

  function fillFile() {
    var e = env(), f = $('#stFmt', UI).value, ta = $('#stFile', UI); if (!e) { ta.value = ''; $('#stFileCap', UI).textContent = 'Run the widget first.'; return; }
    ta.value = f === 'json' ? JSON.stringify(e.payload, null, 2) : f === 'csv' ? toCSV(e.payload) : f === 'md' ? '# ' + name() + '\n\n' + toMD(e.payload) : toHTML(e.payload, name());
    ta.readOnly = f === 'md' || f === 'html'; $('#stFileCap', UI).textContent = f === 'csv' ? 'The first table in the output, one row for each item. Change a cell and use the button below.' : f === 'json' ? 'The full output. You can edit it here.' : 'Read and download here. Edit in the Document view.';
  }

  /* ---------- contract ---------- */
  function adapted() {
    var e = env(); if (!e) return null; var a = CFG.adapter;
    if (typeof a !== 'function') return { status: 'noadapter' };
    var ctx = { extra: S.extra, idFor: function (k) { return S.ids[k] || (S.ids[k] = uuid()); }, uuid: uuid, now: function () { return new Date().toISOString(); }, tenantId: NIL };
    try { var out = a(IAI.clone(e.payload), e, ctx); return { status: 'ok', out: out }; } catch (err) { return { status: 'error', msg: String(err && err.message || err) }; }
  }
  function contractCheck() {
    var ag = CFG.agent; if (!ag) return { applies: false };
    var ad = adapted(); if (!ad) return { applies: true, noOutput: true };
    if (ad.status === 'noadapter') return { applies: true, noAdapter: true };
    if (ad.status === 'error') return { applies: true, error: ad.msg };
    var errs = [], list = Array.isArray(ad.out) ? ad.out : [ad.out]; list.forEach(function (r, i) { validate(CFG.outputSchema, r, CFG.outputSchema, Array.isArray(ad.out) ? '[' + i + ']' : '', []).forEach(function (x) { errs.push(x); }); }); return { applies: true, out: ad.out, errs: errs };
  }
  function renderContract() {
    var h = '<p class="cap">The repo gives each agent a contract. This checks the output, laid out the way the contract asks, against it. The tenant id is filled in by the platform when the output is ingested.</p>', ag = CFG.agent;
    if (!ag) { $('#stContract', UI).innerHTML = h + '<p>This widget has no agent in the repo. It is a platform function or a new widget, so no contract applies. The Wiring Board checks its own contract rules.</p>'; return; }
    h += '<dl class="kv"><dt>Agent</dt><dd>' + esc(ag.id) + ' · version ' + esc(ag.version) + ' · ' + esc(ag.module || '') + '</dd><dt>Human approval required by the agent</dt><dd>' + (ag.requiresApproval ? 'yes' : 'no') + '</dd><dt>Guardrails</dt><dd>' + esc((ag.guardrails || []).join(', ') || 'none listed') + '</dd><dt>Model use</dt><dd>' + esc(ag.model || 'none') + '</dd></dl>';
    var c = contractCheck();
    if (c.noOutput) h += '<p>Run the widget to check its output.</p>';
    else if (c.noAdapter && CFG.blocked) { h += '<p class="stGold">Cannot be laid out in the agent\'s shape from this page.</p><p>' + esc(CFG.blocked) + '</p>'; }
    else if (c.noAdapter) {
      h += '<p class="stGold">No adapter yet: this widget\'s output has not been laid out in the agent\'s shape. Its own JSON is unchanged. The comparison below shows what the agent contract asks for.</p>';
      var br = CFG.outputSchema && (CFG.outputSchema.oneOf || CFG.outputSchema.anyOf || [CFG.outputSchema]).filter(function (b) { return b.properties && b.properties.status && b.properties.status.const === 'ok'; })[0] || CFG.outputSchema && (CFG.outputSchema.oneOf || [CFG.outputSchema])[0], e0 = env();
      if (br && br.properties && e0) { var skip = { tenantId: 1, generatedAt: 1, status: 1 }, have = Object.keys(e0.payload || {}), low = have.map(function (k) { return k.toLowerCase(); }), want = Object.keys(br.properties).filter(function (k) { return !skip[k]; }), req = br.required || [], same = want.filter(function (k) { return low.indexOf(k.toLowerCase()) >= 0; }), lack = want.filter(function (k) { return low.indexOf(k.toLowerCase()) < 0; });
        h += '<p><strong>The agent contract asks for:</strong> ' + want.map(function (k) { return '<code>' + esc(k) + '</code>' + (req.indexOf(k) >= 0 ? '' : ' (optional)'); }).join(', ') + '</p><p><strong>This output already has under the same name:</strong> ' + (same.length ? same.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ') : 'none') + '</p><p><strong>Not in this output:</strong> ' + (lack.length ? lack.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ') : 'none') + '</p><p class="cap">An adapter will map these without inventing values. Where the widget cannot supply a field, the adapter will answer "needs input" and name it.</p>'; }
    }
    else if (c.error) h += '<p class="stBad">The adapter could not run: ' + esc(c.error) + '</p>';
    else if (!c.errs.length) h += '<p class="stOk">The output matches the agent contract.</p>';
    else h += '<p class="stBad">' + c.errs.length + ' difference(s) from the agent contract:</p><ul>' + c.errs.slice(0, 25).map(function (x) { return '<li><code>' + esc(x.path || '(top level)') + '</code> ' + esc(x.msg) + '</li>'; }).join('') + '</ul>';
    if (c.out && !Array.isArray(c.out) && c.out.status === 'needs_input') {
      var simple = (c.out.missingFields || []).filter(function (f) { return /^[A-Za-z][A-Za-z0-9_.]*$/.test(f); });
      if (simple.length) h += '<p class="cap">The agent needs details the widget does not hold. Type them here (not stored; they go into the agent-shaped result only):</p>' + simple.map(function (f) { return '<p><label>' + esc(human(f)) + ' <input data-extra="' + esc(f) + '" value="' + esc(S.extra[f] || '') + '"' + (/date|start|end/i.test(f) ? ' placeholder="YYYY-MM-DD"' : '') + '></label></p>'; }).join('') + '<p><button type="button" class="btn secondary" id="stExtra">Use these details</button></p>';
    }
    if (c.out) h += '<details><summary>Output in the agent\'s shape</summary><pre style="white-space:pre-wrap;max-height:18rem;overflow:auto">' + esc(JSON.stringify(c.out, null, 2)) + '</pre></details><p><button type="button" class="btn secondary" id="stDlC">Download the agent-shaped output (.json)</button></p>';
    $('#stContract', UI).innerHTML = h; var bx = $('#stExtra', UI); if (bx) bx.onclick = function () { UI.querySelectorAll('[data-extra]').forEach(function (i) { if (i.value.trim()) S.extra[i.getAttribute('data-extra')] = i.value.trim(); }); renderContract(); };
    var b = $('#stDlC', UI); if (b) b.onclick = function () { download((CFG.widgetId || 'widget') + '-' + ag.id + '-result.json', JSON.stringify(c.out, null, 2)); };
  }

  /* ---------- revisions, ratification, release ---------- */
  function newRevision(reason, kind, extra) {
    var e = env(); if (!e) return; S.rev++; S.ratified = null;
    S.pending = { revision: S.rev, changeKind: kind, reason: reason, createdAt: new Date().toISOString(), payload: IAI.clone(e.payload), outputSchema: infer(e.payload), extra: extra || null };
    renderRev();
  }
  function renderRev() {
    var box = $('#stRev', UI), p = S.pending, h = '';
    if (!p) { h = '<p class="cap">No revision yet. Save an edit in the Document or File view, or choose a roll-back. The widget\'s published schema is version ' + esc(S.version) + '.</p>'; $('#stSend', UI).disabled = true; }
    else {
      var diff = IAI.diffObjects(S.base || {}, p.payload || {}); h = '<p><strong>Revision ' + p.revision + '</strong> · ' + esc(p.changeKind) + ' · will be version <code>' + esc(bump(S.version)) + '</code></p><p class="cap">Reason: ' + esc(p.reason) + '</p><p>Output schema now has ' + Object.keys((p.outputSchema.properties) || {}).length + ' top-level fields. The edited output becomes the widget\'s new example output.</p>';
      h += S.ratified ? '<p class="stOk">Ratified by ' + esc(S.ratified.name) + ' (' + esc(S.ratified.role) + ') at ' + esc(S.ratified.time) + '. It can be sent to code.</p>' + (S.ratified.identityVerified ? '<p class="cap">Recorded against the signed-in account.</p>' : '<p class="stGold">No signed-in account is connected to this page, so this is a typed name only. The registry will not accept it as ratified until a signed-in account ratifies it.</p>') : '<p class="stGold">Waiting for a named person to ratify. It cannot be sent to code until then.</p>';
      $('#stSend', UI).disabled = !S.ratified;
    }
    box.innerHTML = h;
  }
  function nameErr(n) { n = (n || '').trim(); if (n.length < 3 || !/[A-Za-z]/.test(n)) return 'Type the name of the person ratifying.'; if (/^[A-Za-z]{1,2}\d+$/.test(n) || /\d{6,}/.test(n)) return 'Type a name, not a code or number.'; if (!/\s/.test(n)) return 'Type first name and surname.'; return null; }
  function ratify() {
    var p = S.pending; if (!p) { msg('#stRevMsg', 'There is nothing to ratify yet.', 'stBad'); return; }
    var id = who(), n = id ? id.name : $('#stName', UI).value, role = id && id.role ? id.role : $('#stRole', UI).value, why = $('#stWhy2', UI).value.trim() || p.reason, ne = nameErr(n);
    if (ne) { msg('#stRevMsg', ne, 'stBad'); return; } if (!why) { msg('#stRevMsg', 'Give the reason.', 'stBad'); return; }
    var hard = IAI.hardPII(IAI.scanInput(p.payload)); if (hard.length) { msg('#stRevMsg', 'The output still has personal information (' + hard[0].type + '). Remove it first.', 'stBad'); return; }
    var c = contractCheck(); if (c.applies && c.errs && c.errs.length) { msg('#stRevMsg', 'Ratified, with ' + c.errs.length + ' difference(s) from the agent contract shown in the contract tab.', 'stGold'); }
    sha(JSON.stringify({ w: CFG.widgetId, r: p.revision, s: p.outputSchema, e: p.payload })).then(function (h) {
      S.ratified = { name: n.trim(), role: role, accountId: id ? id.accountId : null, identityVerified: !!id, time: new Date().toISOString(), reason: why, revisionHash: h }; renderRev(); if (!c.errs || !c.errs.length) msg('#stRevMsg', 'Ratified.', 'stOk');
    });
  }
  function sendToCode() {
    var p = S.pending, r = S.ratified; if (!p || !r) return; var mf = manifest(), c = contractCheck(), ver = bump(S.version);
    var pkg = { kind: 'iai.widget.release', packageVersion: 1, widgetId: CFG.widgetId || mf.widgetId, name: mf.name, version: ver, parentVersion: S.version, revision: p.revision, changeKind: p.changeKind, reason: r.reason, rollbackOf: p.extra && p.extra.rollbackOf || null, createdAt: p.createdAt,
      ratification: { name: r.name, role: r.role, accountId: r.accountId, identityVerified: r.identityVerified, time: r.time, revisionHash: r.revisionHash },
      manifest: Object.assign({}, mf, { version: ver, outputSchema: p.outputSchema }), exampleOutput: p.payload,
      contract: CFG.agent ? { agent: CFG.agent.id, agentVersion: CFG.agent.version, adapter: typeof CFG.adapter === 'function', matches: c.errs ? c.errs.length === 0 : null, differences: c.errs ? c.errs.slice(0, 50) : null, result: c.out || null } : null,
      status: r.identityVerified ? 'ratified_awaiting_wiring' : 'ratified_unverified_identity', popia: { personalInfoFound: false, note: 'Staff name is recorded as the ratifier. No learner information.' } };
    sha(JSON.stringify(pkg)).then(function (h) { pkg.contentHash = h; download(pkg.widgetId + '-release-v' + ver + '.json', JSON.stringify(pkg, null, 2)); S.history.push({ version: ver, pkg: pkg }); S.version = ver; S.base = IAI.clone(p.payload); S.pending = null; S.ratified = null; renderRev(); msg('#stRevMsg', 'Release package v' + ver + ' downloaded. Give it to the Wiring Board or commit it to the registry. Nothing was sent anywhere.', 'stOk'); });
  }

  /* ---------- history and rollback ---------- */
  function loadPackages(ev) {
    var files = Array.prototype.slice.call(ev.target.files || []), n = 0;
    files.forEach(function (f) { var rd = new FileReader(); rd.onload = function () { try { var j = JSON.parse(rd.result); if (j.kind !== 'iai.widget.release' || j.widgetId !== (CFG.widgetId || manifest().widgetId)) throw new Error('Not a release package for this widget.'); if (!S.loaded.some(function (x) { return x.version === j.version; })) S.loaded.push(j); } catch (err) { $('#stHist', UI).innerHTML = '<p class="stBad">' + esc(f.name) + ': ' + esc(err.message) + '</p>'; return; } if (++n === files.length) renderHist(); }; rd.readAsText(f); });
  }
  function vcmp(a, b) { var x = a.split('.').map(Number), y = b.split('.').map(Number); for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }
  function renderHist() {
    var all = S.loaded.concat(S.history.map(function (h) { return h.pkg; })).filter(function (v, i, a) { return a.findIndex(function (x) { return x.version === v.version; }) === i; }).sort(function (a, b) { return vcmp(b.version, a.version); });
    var box = $('#stHist', UI); if (!all.length) { box.innerHTML = '<p class="cap">No packages loaded. Current version: ' + esc(S.version) + '.</p>'; return; }
    box.innerHTML = '<div class="tw"><table><thead><tr><th>Version</th><th>Kind</th><th>Ratified by</th><th>Reason</th><th></th></tr></thead><tbody>' + all.map(function (p) { return '<tr><td>' + esc(p.version) + '</td><td>' + esc(p.changeKind) + (p.rollbackOf ? ' of ' + esc(p.rollbackOf) : '') + '</td><td>' + esc(p.ratification && p.ratification.name || '') + '</td><td>' + esc(p.reason || '') + '</td><td>' + (p.version === S.version ? 'current' : '<button type="button" class="btn secondary" data-rb="' + esc(p.version) + '">Roll back to this</button>') + '</td></tr>'; }).join('') + '</tbody></table></div><p class="cap">Give your name and the reason in the ratification tab fields, then press Roll back. Then ratify the new revision.</p>';
    box.querySelectorAll('[data-rb]').forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-rb'), pk = all.filter(function (x) { return x.version === v; })[0]; var why = $('#stWhy2', UI).value.trim(), nm = $('#stName', UI).value, ne = nameErr(nm); if (ne || !why) { show('rev'); msg('#stRevMsg', (ne || 'Give the reason for the roll-back.') + ' Then press Roll back again.', 'stBad'); return; } var ex = pk.exampleOutput; S.rev++; S.ratified = null; S.pending = { revision: S.rev, changeKind: 'rollback', reason: why, createdAt: new Date().toISOString(), payload: IAI.clone(ex), outputSchema: IAI.clone(pk.manifest && pk.manifest.outputSchema || infer(ex)), extra: { rollbackOf: pk.version, rolledBackBy: nm.trim() } }; show('rev'); msg('#stRevMsg', 'Roll back to ' + pk.version + ' prepared as revision ' + S.rev + '. Ratify it to send it to code.', 'stGold'); }; });
  }

  /* ---------- refresh ---------- */
  var lastKey = '';
  function refresh() {
    if (!UI) return; var e = env(), key = e ? e.runId + ':' + e.payloadHash : '';
    if (key === lastKey) return; lastKey = key; var doc = $('#stDoc', UI);
    if (!e) { doc.innerHTML = ''; $('#stDocCap', UI).textContent = 'Run the widget to see its output here.'; return; }
    if (!S.base) S.base = IAI.clone(e.payload);
    var m = mainArray(e.payload); $('#stDocCap', UI).textContent = (m ? 'Shown as a document with a table (' + m.rows.length + ' rows). ' : 'Shown as a document. ') + 'Click any text to change it. Fields that hold lists of objects inside a row stay as they are; change them in the File view.';
    if (document.activeElement && doc.contains(document.activeElement)) return; doc.innerHTML = docView(e.payload, '', 0);
    if (!$('#stContract', UI).hidden) renderContract(); if (!$('[data-pane=file]', UI).hidden) fillFile();
  }
  function start() { var tries = 0, t = setInterval(function () { if (build()) { clearInterval(t); setInterval(refresh, 500); refresh(); } else if (++tries > 120) clearInterval(t); }, 150); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  IAI.studio = { validate: validate, toCSV: toCSV, toMD: toMD, toHTML: toHTML, infer: infer, state: S, check: function () { return contractCheck(); } };
})();
