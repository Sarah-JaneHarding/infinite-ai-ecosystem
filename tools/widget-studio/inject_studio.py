"""python3 inject_studio.py OUTDIR file1.html file2.html ...  -> adds the Studio layer to built widgets (idempotent)."""
import json, re, sys, pathlib
root = pathlib.Path(__file__).parent
contracts = json.load(open(root/'notes/agent-contracts.json'))
studio = (root/'kit/studio.js').read_text()
adapters = {}
ad = root/'adapters'
if ad.exists():
    for f in ad.glob('*.js'):
        if not f.stem.startswith('_'): adapters[f.stem] = f.read_text()
def last_script(h):
    """Start of the widget's own script: the line-start <script> that opens the widget wrapper.
    Widgets may carry '<script>' inside string literals, so the last tag is not safe."""
    m = re.search(r"\n<script>\n\(function \(\) \{\n  'use strict';", h)
    if m: return m.start() + 1
    i = h.rfind('\n<script>')
    return i + 1 if i >= 0 else h.rfind('<script>')

def agent_for(man):
    a = str(man.get('agentId',''))
    m = re.match(r'([A-Z]{2}-\d{2})', a)
    return m.group(1) if m and m.group(1) in contracts else None
def inject(src, out):
    h = pathlib.Path(src).read_text()
    if '__IAI_STUDIO' in h: pathlib.Path(out).write_text(h); return 'already'
    mm = re.search(r'<script type="application/json" id="iai-manifest">(.*?)</script>', h, re.S)
    man = json.loads(mm.group(1)); wid = man.get('widgetId')
    ag = agent_for(man); cfg = {'widgetId': wid, 'version': man.get('version','0.1.0'), 'name': man.get('name')}
    ad_js = 'null'
    if ag:
        c = contracts[ag]
        cfg['agent'] = {k: c.get(k) for k in ('version','module','purpose','model','requiresApproval','guardrails','writesToBrain')}; cfg['agent']['id'] = ag
        cfg['outputSchema'] = c.get('output')
        blocked = json.loads((root/'adapters/_blocked.json').read_text()).get(wid)
        if blocked: cfg['blocked'] = blocked
        if wid in adapters: ad_js = '(function(){' + (root/'adapters/_common.js').read_text() + 'return ' + adapters[wid].strip() + ';})()'
    pre = '<script>window.__IAI_STUDIO=' + json.dumps(cfg).replace('</','<\\/') + ';' + ('window.__IAI_STUDIO.adapter=' + ad_js + ';' if ad_js != 'null' else '') + '</script>\n<script>' + studio + '\n</script>\n'
    i = last_script(h)
    pathlib.Path(out).write_text(h[:i] + pre + h[i:]); return 'ok ' + str(wid) + ' ' + str(ag) + (' +adapter' if ad_js!='null' else '')
if __name__ == '__main__':
    o = pathlib.Path(sys.argv[1]); o.mkdir(parents=True, exist_ok=True)
    for f in sys.argv[2:]: print(pathlib.Path(f).name, inject(f, o/pathlib.Path(f).name))

def inject_board(src, out):
    """Wiring Board only: Studio, plus the custom-widget intake layer."""
    inject(src, out)
    h = pathlib.Path(out).read_text()
    if '__IAI_STUDIO_SRC' in h: return 'board already'
    j = last_script(h)
    A = "function () { sync(); }); cfg.ing = ing;"
    assert A in h[j:], 'board anchor missing'
    h = h[:j] + h[j:].replace(A, A + ' window.__iaiBoardIng = ing;', 1)
    intake = (root/'kit/intake.js').read_text()
    pre = '<script>window.__IAI_STUDIO_SRC=' + json.dumps(studio).replace('</', '<\\/') + ';</script>\n<script>' + intake + '\n</script>\n'
    i = last_script(h)
    pathlib.Path(out).write_text(h[:i] + pre + h[i:]); return 'board ok'
