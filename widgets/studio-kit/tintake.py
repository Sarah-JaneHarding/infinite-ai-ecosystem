import json,sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(accept_downloads=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/out/studio/INFINITE-AI-PF-W06.html'); pg.wait_for_selector('#intakeZone')
    def audit(w,c):
        pg.set_input_files('#inW',w); pg.set_input_files('#inC',c); pg.click('#inAudit'); pg.wait_for_timeout(500); return pg.inner_text('#inRep')
    r=audit('/tmp/custom.bad.html','/tmp/custom.bad.json'); print('BAD:\n',r[:1500])
    assert 'Not ready' in r and 'fetch' in r and 'pii_guard' in r and 'budget' in r.lower()
    assert pg.is_disabled('#inAlert')
    r=audit('/tmp/custom.html','/tmp/custom.contract.json'); print('GOOD:',r[:200]); assert 'Passed' in r
    pg.fill('#inSmt','Thandi Mokoena, Principal\nT04, Deputy'); pg.click('#inAlert'); print(pg.inner_text('#inAlertMsg')); 
    pg.fill('#inSmt','Thandi Mokoena, Principal\nSipho Naidoo, Deputy Principal')
    with pg.expect_download() as d: pg.click('#inAlert')
    print('alert file',json.load(open(d.value.path()))['to'])
    pg.fill('[data-nm="0"]','Wrong Person'); pg.click('[data-rt="0"]'); print(pg.inner_text('#inRatMsg'))
    pg.fill('[data-nm="0"]','Thandi Mokoena'); pg.click('[data-rt="0"]'); pg.wait_for_timeout(300)
    print('publish disabled after 1:',pg.is_disabled('#inPublish'))
    pg.fill('[data-nm="1"]','Sipho Naidoo'); pg.click('[data-rt="1"]'); pg.wait_for_timeout(300)
    print('publish disabled after 2:',pg.is_disabled('#inPublish'))
    pg.check('input[name=inPub][value=public]'); print('public blocked until cleaned:',pg.is_disabled('#inPublish'))
    pg.fill('#inScrubTerms','Observation Notes Analyser\nContact: a@b.co.za'); pg.click('#inScrub'); pg.wait_for_timeout(300); print(pg.inner_text('#inScrubRep')[:200])
    pg.fill('#inScrubName','Nobody Else'); pg.click('#inScrubConfirm'); print(pg.inner_text('#inPubMsg'))
    pg.fill('#inScrubName','Sipho Naidoo'); pg.click('#inScrubConfirm'); print('public blocked after confirm:',pg.is_disabled('#inPublish'))
    with pg.expect_download() as d: pg.click('#inPublish')
    raw=open(d.value.path()).read(); offer=json.loads(raw); print(offer['kind'],offer['status'],len(offer['ratifiedBy']),offer['schoolInfoRemoved'],offer['scrub']['itemsRemoved']); assert 'Observation Notes Analyser' not in raw and 'a@b.co.za' not in raw, 'term leaked'; print('terms absent from offer file')
    json.dump(offer,open('/tmp/offer.json','w'))
    pg.check('input[name=inPub][value=private]')
    with pg.expect_download() as d: pg.click('#inPublish')
    print(json.load(open(d.value.path()))['status'], pg.inner_text('#inPubMsg'))
    pg.wait_for_timeout(1500); print('board rows after private:',pg.inner_text('#wTable')[:300])
    # school D: accept offer
    pg.set_input_files('#inOffer','/tmp/offer.json'); pg.wait_for_timeout(500)
    print(pg.inner_text('#inOfferBox')[:200])
    pg.click('#inAcc'); print(pg.inner_text('#inOfMsg'))
    pg.fill('#inAn','Nomsa Zulu'); pg.fill('#inAr','Principal'); pg.fill('#inAw','Fits our PD plan')
    with pg.expect_download() as d: pg.click('#inAcc')
    print(json.load(open(d.value.path()))['decision'], pg.inner_text('#inOfMsg')[:120])
    print('errors',errs); b.close()
