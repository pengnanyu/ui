import pathlib
import zlib
import os

repo = pathlib.Path('e:/APP/ui/.git')
commit = 'ae0141a4760f0bcee7d1f306ab0295b51fbe2287'
files = [
    'src/store/provider.tsx',
    'src/pages/ParamConfigPage/index.tsx',
    'src/pages/ParamConfigPage/components/ParamGroupCard/ParamInput.tsx',
    'src/pages/ParamConfigPage/components/ParamGroupCard/ParamInput.module.css',
    'src/pages/BatteryInfoPage/components/StatusCard/StatusCard.module.css',
    'src/hooks/useColumnCount.ts',
    'src/utils/protocol-cache.ts',
    'src/vite-env.d.ts',
]


def read_obj(sha):
    path = repo / 'objects' / sha[:2] / sha[2:]
    data = zlib.decompress(path.read_bytes())
    i = data.find(b' ')
    t = data[:i].decode()
    rest = data[i+1:]
    j = rest.find(b'\x00')
    return t, rest[j+1:]


def get_tree_sha(commit_sha):
    t, content = read_obj(commit_sha)
    assert t == 'commit'
    for line in content.decode('utf-8', errors='replace').splitlines():
        if line.startswith('tree '):
            return line.split()[1]
    raise RuntimeError('tree not found')


def read_tree(tree_sha, prefix=''):
    t, content = read_obj(tree_sha)
    assert t == 'tree'
    i = 0
    while i < len(content):
        j = content.find(b' ', i)
        mode = content[i:j].decode()
        k = content.find(b'\x00', j)
        name = content[j+1:k].decode()
        sha = content[k+1:k+21].hex()
        path = os.path.join(prefix, name).replace('\\', '/')
        if mode == '40000':
            yield from read_tree(sha, path)
        else:
            yield path, sha
        i = k + 21


tree_sha = get_tree_sha(commit)
entries = dict(read_tree(tree_sha))
for f in files:
    print('FILE', f)
    if f not in entries:
        print('MISSING')
        continue
    t, content = read_obj(entries[f])
    print(content.decode('utf-8', errors='replace'))
    print('---')
