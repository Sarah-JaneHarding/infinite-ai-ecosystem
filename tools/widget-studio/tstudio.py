import sys,asyncio,json
from playwright.sync_api import sync_playwright
f=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+f)
    pg.click('#btnSample'); pg.click('#btnRun'); pg.wait_for_timeout(1500)
    print('studio',pg.locator('#studioZone').count(),'doc len',len(pg.inner_text('#stDoc')))
    pg.click('[data-tab=contract]'); print(pg.inner_text('#stContract')[:500])
    pg.click('[data-tab=doc]')
    ed=pg.locator('#stDoc .stEd[data-type=string]').first; print('first field',ed.get_attribute('data-path'),repr(ed.inner_text()))
    ed.click(); pg.keyboard.press('End'); pg.keyboard.type(' (edited)')
    pg.fill('#stWhy1','test edit'); pg.click('#stSave'); pg.wait_for_timeout(500); print(pg.inner_text('#stSaveMsg'))
    pg.click('[data-tab=rev]'); print(pg.inner_text('#stRev')[:300])
    pg.click('#stRatify'); print(pg.inner_text('#stRevMsg'))
    pg.fill('#stName','Jane Dlamini'); pg.fill('#stWhy2','Checked wording'); pg.click('#stRatify'); pg.wait_for_timeout(500); print(pg.inner_text('#stRevMsg'), pg.is_disabled('#stSend'))
    with pg.expect_download() as d: pg.click('#stSend')
    path=d.value.path(); j=json.load(open(path)); print(j['version'],j['ratification']['name'],j['status'],j['changeKind'])
    open('/tmp/rel.json','w').write(json.dumps(j))
    print('errors',errs); b.close()
