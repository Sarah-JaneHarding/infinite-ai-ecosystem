"""python3 build_studio.py OUT  -> Studio added to every widget; Wiring Board also gets the custom-widget intake."""
import glob, os, sys, pathlib
import inject_studio as I
out = pathlib.Path(sys.argv[1]); 
for sub in ('', 'src'): (out/sub).mkdir(parents=True, exist_ok=True)
fs = glob.glob('/home/claude/widgets/dist/INFINITE-AI-P*-W*.html') + glob.glob('/home/claude/widgets/dist/INFINITE-AI-TB-W12.html') + glob.glob('/home/claude/rec/tbw/INFINITE-AI-TB-W*.html')
fs += glob.glob('/mnt/user-data/uploads/Downloads/INFINITE-AI ECOSYSTEM WIDGETS/**/INFINITE-AI-*-W*.html', recursive=True)
seen = {}
for f in fs:
    seen.setdefault(os.path.basename(f).split('_')[0], f)   # first wins: rebuilt dist before older copies
n = 0
for k, f in sorted(seen.items()):
    sub = 'src' if 'uploads' in f else ''
    o = out/sub/os.path.basename(f)
    r = I.inject_board(f, o) if 'PF-W06' in f else I.inject(f, o)
    n += 1
print(n, 'widgets')
