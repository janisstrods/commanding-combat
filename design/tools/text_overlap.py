# Copyright hygiene check: report runs of N or more consecutive words that our texts share with the GMT source texts.
# Usage: python3 -I design/tools/text_overlap.py reference/text . (the GMT texts are extracted into the git-ignored
# reference/text/; they are never committed). Data rows (tables of numbers, names, hex lists) may match; prose must not.
import sys, re, glob, os
N = 8
src_dir, repo = sys.argv[1], sys.argv[2]
def words(t):
    t = t.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return re.findall(r"[a-z0-9']+", t.lower())
src = set()
for f in ['CC_Rulebook_v1.1.txt', 'CC-20thAnniv_Rulebook_ONLINE.txt', 'CC-20thAnniv_Playbook_ONLINE.txt', 'CC-Consolidated-FAQ.txt', 'terrain.txt']:
    w = words(open(os.path.join(src_dir, f), errors='ignore').read())
    for i in range(len(w) - N + 1):
        src.add(' '.join(w[i:i+N]))
ours = []
for pat in ['src/data/card-texts.ts', 'src/scenarios/*.ts', 'src/data/scenarios/*.json', 'src/ui/**/*.tsx', 'src/ui/**/*.ts',
            'src/engine/**/*.ts', 'src/ai/**/*.ts', 'design/*.md', 'README.md', 'CREDITS.md', 'CLAUDE.md', 'tests/**/*.ts', 'scripts/**/*.ts']:
    ours += glob.glob(os.path.join(repo, pat), recursive=True)
total = 0
for f in sorted(set(ours)):
    w = words(open(f, errors='ignore').read())
    hits = []
    i = 0
    while i <= len(w) - N:
        if ' '.join(w[i:i+N]) in src:
            j = i + N
            while j < len(w) and ' '.join(w[j-N+1:j+1]) in src:
                j += 1
            hits.append(' '.join(w[i:j]))
            i = j
        else:
            i += 1
    if hits:
        total += len(hits)
        print(f"\n== {os.path.relpath(f, repo)} ({len(hits)})")
        for h in hits:
            print('  -', h[:200])
print('\nTOTAL runs:', total)
