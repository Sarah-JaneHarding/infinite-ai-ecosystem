import json, sys
from playwright.sync_api import sync_playwright
ROOT = '/home/claude/widgets'
def url(w): return 'file://%s/dist/INFINITE-AI-%s.html' % (ROOT, w)
fails = []
def ok(c, m):
    print(('  ok   ' if c else '  FAIL ') + m)
    if not c: fails.append(m)
def run(pg):
    pg.evaluate("document.querySelector('#btnRun').click()"); pg.wait_for_timeout(250)
    msg = pg.inner_text('#runMsg')
    env = None
    if msg.startswith('Draft ready'):
        env = {'payload': json.loads(pg.input_value('#outJson'))}
    return msg, env
def fresh(b, w, sample=True):
    pg = b.new_context(viewport={'width': 1200, 'height': 900}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(url(w))
    if sample: pg.click('#btnSample')
    return pg, errs
with sync_playwright() as p:
    b = p.chromium.launch()
    # W14
    print('TB-W14'); pg, er = fresh(b, 'TB-W14')
    msg, env = run(pg); c = env['payload']['counts']
    ok(c['present'] == 10 and c['absent'] == 2 and c['unmarked'] == 0, 'counts from the sample: %s' % c)
    ok({x['option']: x['count'] for x in env['payload']['lunch']} == {'Packed lunch': 5, 'School meal': 5}, 'lunch counts 5 and 5')
    ok('Lion' not in json.dumps(env) and 'Zebra' not in json.dumps(env), 'labels never reach the envelope')
    pg.fill('#mk', ''); pg.evaluate("document.querySelector('#ls').dispatchEvent(new Event('input'))")
    clk = lambda: pg.evaluate("document.querySelector('.cls-card[data-code=L01]').click()"); clk(); t1 = pg.input_value('#mk'); clk(); t2 = pg.input_value('#mk'); clk(); t4 = pg.input_value('#mk')
    ok('present | Packed lunch' in t1 and 'present | School meal' in t2 and 'absent' in t4, 'tap cycles lunch choices then absent: [%s] [%s] [%s]' % (t1, t2, t4))
    clk()
    ok(pg.input_value('#mk').strip() == '', 'a fourth tap returns to unmarked')
    pg.fill('#ls', 'Thandi\nL02'); msg, env = run(pg); ok(env is None and 'not a code' in msg, 'a name typed as a code is refused: ' + msg[:90].replace('\n', ' '))
    pg.fill('#ls', 'L01\nL01'); msg, env = run(pg); ok('twice' in msg, 'duplicate code refused')
    pg.click('#btnSample'); pg.fill('#mk', 'L99 | present'); msg, env = run(pg); ok('not on the class list' in msg, 'mark for an unknown code refused')
    ok(not er, 'no page errors %s' % er)
    # W15
    print('TB-W15'); pg, er = fresh(b, 'TB-W15'); got = []
    pg.fill('#hs', ''); 
    for k in range(11):
        pg.click('#pick'); got.append(pg.get_attribute('#stage', 'data-code'))
    ok(len(set(got)) == 11 and not (set(got) & {'L07'}), 'eleven picks (12 less one taken out), no repeat, taken-out learner never picked: %s' % got)
    pg.click('#pick'); ok('Everyone has had a turn' in pg.inner_text('#stage'), 'then it says the round is complete')
    pg.click('#newr'); ok(pg.input_value('#hs') == '', 'new round clears the turns')
    pg.click('#pick'); pg.click('#out'); ok(pg.input_value('#rm').split()[-1] != '' and pg.input_value('#hs') == '', 'take the picked learner out')
    before = len(pg.input_value('#rm').split()); pg.locator('#chips button').first.click(); ok(len(pg.input_value('#rm').split()) == before - 1 and 'L07' not in pg.input_value('#rm').split(), 'add back works')
    n = 0; counts = {}
    pg.evaluate("window.__IAI_RNG = (function(){var i=0;return function(){i++;return (i%11)/11;}})()")
    pg.click('#newr'); pg.click('#pick'); ok(pg.get_attribute('#stage', 'data-code') is not None, 'pick works with a fixed generator')
    pg.fill('#hs', ''); pg.fill('#rm', ''); pg.fill('#ls', 'L01'); msg, env = run(pg); ok(env is not None, 'a one learner list can run')
    pg.fill('#ls', 'L01\nL02'); pg.fill('#hs', 'L01'); pg.fill('#rm', 'L01'); msg, env = run(pg); ok(env is None and 'both taken out' in msg, 'taken out and picked at once is refused: ' + msg[:80])
    ok(not er, 'no page errors %s' % er)
    # W16
    print('TB-W16'); pg, er = fresh(b, 'TB-W16')
    pg.fill('#gc', '5'); pg.fill('#gn', ''); sizes_seen = set(); apart_ok = True
    for k in range(60):
        pg.click('#make'); r = pg.input_value('#rs').splitlines(); g = [x.split('|')[1].split() for x in r]
        sizes_seen.add(tuple(sorted(len(x) for x in g)))
        for m in g:
            if 'L01' in m and 'L02' in m: apart_ok = False
    ok(sizes_seen == {(2, 2, 2, 3, 3)}, 'five groups of 12 are always 3,3,2,2,2: %s' % sizes_seen)
    ok(apart_ok, 'L01 and L02 never together in 60 draws')
    msg, env = run(pg); ok(env is not None and env['payload']['groupCount'] == 5 and sum(env['payload']['sizes']) == 12, 'run gives 5 groups of 12 learners')
    pg.fill('#aw', 'L03 L04'); pg.click('#make'); msg, env = run(pg); ok(env['payload']['learnersGrouped'] == 10 and env['payload']['away'] == ['L03', 'L04'], 'away learners are left out')
    ok(pg.locator('.cls-group').count() == 5, 'board shows 5 group boxes')
    pg.fill('#gc', '30'); pg.fill('#aw', ''); pg.click('#make'); ok(True, 'more groups than learners does not crash')
    msg, env = run(pg); ok(env is None, 'more groups than learners is refused: ' + msg[:90].replace('\n', ' '))
    pg.fill('#ls', 'L01\nL02\nL03'); pg.fill('#gc', '2'); pg.fill('#ka', 'L01,L02\nL02,L03\nL01,L03'); pg.fill('#rs', ''); pg.click('#make'); ok(pg.input_value('#rs') == '', 'impossible keep-apart gives no groups')
    pg.fill('#gc', '2'); pg.fill('#ka', ''); pg.fill('#ls', 'L01\nL02'); pg.fill('#rs', 'A | L01 L02\nB | '); msg, env = run(pg); ok(env is None, 'an empty hand-edited group is refused: ' + msg[:90].replace('\n', ' '))
    pg.fill('#gc', ''); msg, env = run(pg); ok(env is None, 'missing group number refused')
    ok(not er, 'no page errors %s' % er)
    # W17
    print('TB-W17'); pg, er = fresh(b, 'TB-W17')
    pg.clock.install(); pg.goto(url('TB-W17')); pg.click('#btnSample'); pg.fill('#sp', '10'); pg.fill('#cs', '10'); pg.select_option('#cu', 'yes')
    pg.click('#rs'); ok(pg.inner_text('#rname') == 'Reading corner', 'first round name shown')
    pg.clock.run_for(10500); ok(pg.inner_text('#rname') == 'Clean up', 'after 10 s the clean-up step starts')
    ok(pg.evaluate("window.IAI.CLS.played.length") == 1 and pg.evaluate("window.IAI.CLS.played[0]") == 'xylophone', 'the chosen end sound played once')
    pg.clock.run_for(10500); ok(pg.inner_text('#rname') == 'Number games', 'then the next round')
    ok(pg.input_value('#dn') == '2', 'two steps counted as finished: ' + pg.input_value('#dn'))
    pg.click('#rs'); t = pg.inner_text('#rtime'); pg.clock.run_for(5000); ok(pg.inner_text('#rtime') == t, 'pause holds the time')
    pg.click('#rr'); ok(pg.input_value('#dn') == '0', 'reset clears progress')
    pg.fill('#rn', '11'); pg.click('#rs'); msg, env = run(pg); ok(env is None, 'eleven rounds refused: ' + msg[:80].replace('\n', ' '))
    pg.fill('#rn', '10'); pg.fill('#nm', ''); pg.select_option('#cu', 'no'); pg.fill('#dn', '0'); msg, env = run(pg); ok(env is not None and len(env['payload']['steps']) == 10 and env['payload']['steps'][0]['name'] == 'Round 1', 'ten default named rounds')
    pg.fill('#dn', '11'); msg, env = run(pg); ok(env is None, 'steps finished above the plan refused')
    ok(not er, 'no page errors %s' % er)
    # W18
    print('TB-W18'); pg, er = fresh(b, 'TB-W18')
    pg.select_option('#ic', '5'); pg.locator('.cls-team button[data-d="1"]').first.click(); ok(pg.input_value('#sc').split()[0] == '30', 'plus adds the step: ' + pg.input_value('#sc'))
    pg.locator('.cls-team button[data-d="-1"]').nth(1).click(); pg.locator('.cls-team button[data-d="-1"]').nth(1).click(); pg.locator('.cls-team button[data-d="-1"]').nth(1).click(); ok(pg.input_value('#sc').split()[1] == '-5', 'score can go below zero')
    ok(pg.input_value('#mv') == '9', 'changes counted: ' + pg.input_value('#mv'))
    pg.fill('#tc', '6'); pg.dispatch_event('#tc', 'change'); ok(pg.locator('.cls-team').count() == 6, 'six teams on the board')
    pg.fill('#tc', '7'); msg, env = run(pg); ok(env is None, 'seven teams refused')
    pg.fill('#tc', '2'); pg.dispatch_event('#tc', 'change'); msg, env = run(pg); ok(env is not None and len(env['payload']['teams']) == 2, 'back to two teams runs')
    ok(not er, 'no page errors %s' % er)
    # W19
    print('TB-W19'); pg, er = fresh(b, 'TB-W19')
    pg.fill('#lg', ''); pg.click('.cls-level[data-level="2"]'); pg.click('.cls-level[data-level="0"]'); ok(len(pg.input_value('#lg').splitlines()) == 2, 'two touches log two changes')
    ok(pg.get_attribute('.cls-level[data-level="0"]', 'aria-pressed') == 'true' and pg.get_attribute('.cls-level[data-level="2"]', 'aria-pressed') == 'false', 'only the touched level is active')
    pg.fill('#at', '0'); pg.click('#att'); pg.click('#att'); ok(pg.input_value('#at') == '2' and pg.evaluate("window.IAI.CLS.played.length") == 2, 'attention sound plays and is counted')
    msg, env = run(pg); ok(env is not None and env['payload']['levelsUsed'] == [0, 2] and env['payload']['attentionSounds'] == 2, 'summary lists levels used')
    ok('getUserMedia' not in open(ROOT + '/dist/INFINITE-AI-TB-W19.html').read(), 'no microphone call in the page')
    pg.fill('#lt', 'a\nb\nc\nd\ne\nf'); msg, env = run(pg); ok(env is None, 'six levels refused')
    ok(not er, 'no page errors %s' % er)
    # W20
    print('TB-W20'); pg, er = fresh(b, 'TB-W20')
    pg.locator('#bc button[data-d="-1"]').first.click(); pg.locator('#bc button[data-d="-1"]').first.click(); pg.locator('#bc button[data-d="-1"]').first.click(); pg.locator('#bc button[data-d="-1"]').first.click(); pg.locator('#bc button[data-d="-1"]').first.click()
    ok(pg.input_value('#ct').split()[0] == '0', 'minus stops at zero: ' + pg.input_value('#ct'))
    pg.locator('#bc button[data-d="1"]').nth(2).click(); ok(pg.input_value('#ct').split()[2] == '4', 'plus adds one')
    ok(pg.locator('#bg div').count() == 4, 'graph has four bars'); pg.select_option('#gs', 'no'); ok(pg.locator('#bg div').count() == 0, 'graph can be hidden')
    msg, env = run(pg); ok(env['payload']['total'] == 9 and env['payload']['graphShown'] is False, 'summary total and graph flag')
    pg.fill('#cc', 'one'); msg, env = run(pg); ok(env is None, 'one choice refused'); pg.fill('#cc', 'a\nb\nc\nd\ne'); msg, env = run(pg); ok(env is None, 'five choices refused')
    pg.fill('#cc', 'a\nb'); pg.fill('#ct', '1 2 3'); msg, env = run(pg); ok(env is None, 'count mismatch refused')
    pg.fill('#cc', 'a\nb'); pg.fill('#ct', '1 -2'); msg, env = run(pg); ok(env is None, 'negative count refused')
    pg.fill('#ct', ''); pg.fill('#qq', 'Learner: Thandi Mokoena 0821234567 8001015009087'); msg, env = run(pg); ok('Approval is blocked' in pg.inner_text('body'), 'name, phone and ID typed into the question: approval is blocked'); 
    ok(not er, 'no page errors %s' % er)
    b.close()
print('\nFAILED %d' % len(fails) if fails else '\nALL PASSED'); sys.exit(1 if fails else 0)
