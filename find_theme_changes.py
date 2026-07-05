import pathlib
import zlib
import os

repo = pathlib.Path('e:/APP/ui/.git')
head = (repo / 'HEAD').read_text().strip()
if head.startswith('ref: '):
    head = (repo / head[5:]).read_text().strip()


def read_obj(sha):
    path = repo / 'objects' / sha[:2] / sha[2:]
    data = zlib.decompress(path.read_bytes())
    i = data.find(b' ')
    t = data[:i].decode()
    rest = data[i+1:]
    j = rest.find(b'\x00')
    return t, rest[j+1:]


def read_tree(tree_sha, prefix=''):
    t, content = read_obj(tree_sha)
    if t != 'tree':
        raise RuntimeError(f'Expected tree, got {t}')
    i = 0
    while i < len(content):
        j = content.find(b' ', i)
        mode = content[i:j].decode()
        k = content.find(b'\x00', j)
        name = content[j+1:k].decode()
        sha = content[k+1:k+21].hex()
        path = os.path.join(prefix, name).replace('\\','/')
        if mode == '40000':
            yield from read_tree(sha, path)
        else:
            yield path, sha
        i = k + 21


def get_tree_sha(commit_sha):
    t, content = read_obj(commit_sha)
    if t != 'commit':
        raise RuntimeError(f'Expected commit, got {t}')
    for line in content.decode('utf-8', errors='replace').splitlines():
        if line.startswith('tree '):
            return line.split()[1]
    raise RuntimeError('No tree found')


def commit_parents(commit_sha):
    t, content = read_obj(commit_sha)
    return [line.split()[1] for line in content.decode('utf-8', errors='replace').splitlines() if line.startswith('parent ')]


def tree_entries(tree_sha):
    return dict(read_tree(tree_sha))


def diff_paths(tree_a, tree_b, paths):
    for p in paths:
        a = tree_a.get(p)
        b = tree_b.get(p)
        if a != b:
            yield p, a, b


targets = [
    'src/styles/globals.css',
    'src/styles/card.css',
    'src/styles/themes/dark.css',
    'src/styles/themes/light.css',
    'vite.config.ts',
    'src/styles/breakpoints.css',
    'src/store/provider.tsx',
    'src/pages/ParamConfigPage/index.tsx',
    'src/pages/ParamConfigPage/components/ParamGroupCard/ParamInput.tsx'
]

seen = set()
queue = [head]
count = 0
while queue and count < 200:
    sha = queue.pop(0)
    if sha in seen:
        continue
    seen.add(sha)
    count += 1
    parents = commit_parents(sha)
    tree_sha = get_tree_sha(sha)
    tree = tree_entries(tree_sha)
    for p in parents:
        parent_tree_sha = get_tree_sha(p)
        parent_tree = tree_entries(parent_tree_sha)
        diffs = list(diff_paths(tree, parent_tree, targets))
        if diffs:
            print('COMMIT', sha)
            print('PARENTS', parents)
            print('DIFFS')
            for dp, a, b in diffs:
                print(' ', dp, '->', 'present' if a else 'missing', ',', 'present' if b else 'missing')
            print('MSG')
            text = read_obj(sha)[1].decode('utf-8', errors='replace')
            msg = text.split('\n\n',1)[1] if '\n\n' in text else ''
            print(msg.strip().splitlines()[0] if msg else '')
            print('---')
        queue.extend(parents)
