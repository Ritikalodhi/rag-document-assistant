import os

root = os.path.join(os.path.dirname(__file__), 'src')
files = []
for dirpath, dirnames, filenames in os.walk(root):
    for fn in filenames:
        if fn.endswith(('.ts', '.tsx')):
            files.append(os.path.join(dirpath, fn))

texts = {}
for path in files:
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        texts[path] = f.read()

skip = {'App.tsx', 'main.tsx', 'index.ts', 'vite-env.d.ts'}
unused = []
for path in files:
    if os.path.basename(path) in skip:
        continue
    stem = os.path.splitext(os.path.basename(path))[0]
    found = False
    for content in texts.values():
        if f"@/{stem}" in content or f"./{stem}" in content or f"../{stem}" in content:
            found = True
            break
    if found:
        continue
    for other_path, content in texts.items():
        if other_path == path:
            continue
        if stem in content:
            found = True
            break
    if not found:
        unused.append(path)

print('TOTAL TS/TSX FILES', len(files))
print('POTENTIAL UNUSED FILES', len(unused))
for p in sorted(unused):
    print(p)
