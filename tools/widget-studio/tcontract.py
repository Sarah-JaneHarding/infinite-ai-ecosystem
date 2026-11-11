import sys,json,glob
from playwright.sync_api import sync_playwright
import jsonschema
contracts=json.load(open('/home/claude/widgets/notes/agent-contracts.json'))
files=sorted(glob.glob(sys.argv[1]))
with sync_playwright() as p:
    b=p.chromium.launch(); bad=0
    for f in files:
        pg=b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file://'+f)
        try:
            if pg.locator('#btnSample').count(): pg.click('#btnSample')
            pg.click('#btnRun'); pg.wait_for_timeout(1200)
            r=pg.evaluate("(()=>{Object.assign(IAI.studio.state.extra,{measuredGrade:'2',targetMinGrade:'1',targetMaxGrade:'3',differentiationTier:'STANDARD',presentationPurpose:'LESSON',enrichmentFocus:'CHALLENGE_TASKS',blockedDownstream:'false',periodStart:'2026-01-13',periodEnd:'2026-03-27'});return IAI.studio.check()})()")
        except Exception as ex: r={'error':str(ex)[:80]}
        ag=None
        out=r.get('out') if r else None
        st='n/a'
        if r and r.get('applies'):
            if r.get('noAdapter'): st='no adapter'
            elif r.get('error'): st='ADAPTER ERROR '+r['error']
            elif out is not None:
                aid=pg.evaluate("window.__IAI_STUDIO.agent.id"); sch=contracts[aid]['output']
                py='py-ok'
                for item in (out if isinstance(out,list) else [out]):
                    try: jsonschema.validate(item,sch)
                    except jsonschema.ValidationError as ve: py='py-FAIL '+ve.message[:80]; bad+=1; break
                st=('browser-ok ' if not r['errs'] else 'browser-DIFF%d '%len(r['errs']))+py+' status='+(('array of %d '%len(out)+str(out[0].get('status'))) if isinstance(out,list) and out else str(out.get('status') if isinstance(out,dict) else out))
        print(f.split('/')[-1][:40].ljust(42),st,errs[:1], (' NEED:'+json.dumps(out.get('missingFields'))[:110]) if isinstance(out,dict) and out.get('status')=='needs_input' else '', (' DIFF:'+json.dumps(r['errs'][:2])[:200]) if r and r.get('errs') else '')
        pg.close()
    b.close(); print('bad',bad)
