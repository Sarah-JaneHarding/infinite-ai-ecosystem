import glob,os,json,sys
from playwright.sync_api import sync_playwright
fs=sorted(glob.glob('/home/claude/out/studio/INFINITE-AI-*-W*.html')+glob.glob('/home/claude/out/studio/src/INFINITE-AI-*-W*.html'))
res=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(accept_downloads=True)
    for f in fs:
        n=os.path.basename(f)[11:26]; pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:60]))
        pg.goto('file://'+f); pg.wait_for_timeout(300)
        if not pg.locator('#studioZone').count() or 'PF-W06' in f: res.append((n,'no studio zone (by design)' if 'W03_APPROVAL' in f or 'PF-W06' in f else 'MISSING')); pg.close(); continue
        try:
            if pg.locator('#btnSample').count(): pg.click('#btnSample')
            pg.click('#btnRun'); pg.wait_for_timeout(1300)
            if not pg.evaluate("!!(IAI.studio.state && document.querySelector('#stDoc .stEd'))"): res.append((n,'no output after sample run')); pg.close(); continue
            ed=pg.locator('#stDoc .stEd[data-type=string]')
            if not ed.count(): res.append((n,'ok view; no string field to edit')); pg.close(); continue
            ed.first.click(); pg.keyboard.press('End'); pg.keyboard.type(' x')
            pg.fill('#stWhy1','test'); pg.click('#stSave'); pg.wait_for_timeout(400)
            msg=pg.inner_text('#stSaveMsg')
            if 'saved as revision' not in msg: res.append((n,'save: '+msg[:80])); pg.close(); continue
            pg.click('[data-tab=rev]'); pg.fill('#stName','Jane Dlamini'); pg.fill('#stWhy2','test'); pg.click('#stRatify'); pg.wait_for_timeout(300)
            if pg.is_disabled('#stSend'): res.append((n,'ratify: '+pg.inner_text('#stRevMsg')[:80])); pg.close(); continue
            with pg.expect_download() as d: pg.click('#stSend')
            j=json.load(open(d.value.path())); res.append((n,'OK v'+j['version']+(' contract='+str(j['contract']['matches']) if j['contract'] else '')+(' errs='+str(errs) if errs else '')))
        except Exception as ex: res.append((n,'EXC '+str(ex)[:90]))
        pg.close()
ok=[r for r in res if r[1].startswith('OK')]
print(len(res),'widgets;',len(ok),'full edit-ratify-release OK')
for r in res:
    if not r[1].startswith('OK'): print(r)
