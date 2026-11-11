import glob,os,sys,re
from playwright.sync_api import sync_playwright
extra=sys.argv[1:]  # extra dirs holding widget html (CE, DW, SA, PF)
ROOT=os.environ.get('WROOT','/home/claude/widgets/dist')
files=glob.glob(ROOT+'/INFINITE-AI-*-W*.html')+glob.glob(ROOT+'/src/INFINITE-AI-*-W*.html')
byid={}
for f in sorted(files):
    m=re.search(r'INFINITE-AI-([A-Z]+-W\d+)',f)
    if m and 'PF-W06' not in f: byid[m.group(1)]=f
files=[byid[k] for k in sorted(byid)]
print(len(files),'widgets')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.environ.get('BOARD','/home/claude/widgets/dist/INFINITE-AI-PF-W06.html'))
    pg.set_input_files('#iaiPick', files); pg.wait_for_timeout(5000)
    n=pg.evaluate("document.querySelectorAll('select.lab').length")
    for i in range(n):
        pg.evaluate("(i)=>{var s=document.querySelectorAll('select.lab')[i]; if(s&&!s.value){s.value='SOURCE DOCUMENT'; s.dispatchEvent(new Event('change',{bubbles:true}));}}", i)
        pg.wait_for_timeout(700)
    pg.wait_for_timeout(15000)
    w=pg.inner_text('#wTable'); rows=len(re.findall(r'MANIFEST OK|v\d+\.\d+\.\d+',w)); print('rows',n,'manifest lines',rows)
    pg.click('#runAll'); pg.wait_for_timeout(int(__import__("os").environ.get("RUNWAIT","120"))*1000)
    t=pg.inner_text('#lTable'); open('/tmp/ltable.txt','w').write(t); open('/tmp/wtable.txt','w').write(w)
    print(len(t)); print(errs[:3])
