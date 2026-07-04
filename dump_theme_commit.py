import pathlib
import zlib
import os

repo = pathlib.Path('e:/APP/ui/.git')
commit = 'e7c01386fc3e04fc2e8ac493aed01afae462fca2'
files = ['src/styles/globals.css', 'src/styles/themes/dark.css']


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
        path = os.path.join(prefix, name).replace('\\','/')
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
    else:
        t, content = read_obj(entries[f])
        print(content.decode('utf-8', errors='replace'))
    print('---')
