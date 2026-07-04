import pathlib
import zlib
import os
import sys

if len(sys.argv) != 2:
    print('Usage: python restore_commit.py <commit-sha>')
    sys.exit(1)

commit_sha = sys.argv[1].strip()
repo = pathlib.Path('e:/APP/ui/.git')
root = pathlib.Path('e:/APP/ui')

if not repo.exists() or not repo.is_dir():
    raise FileNotFoundError('.git repository not found')


def read_obj(sha):
    path = repo / 'objects' / sha[:2] / sha[2:]
    if not path.exists():
        raise FileNotFoundError(f'Git object not found: {sha}')
    data = zlib.decompress(path.read_bytes())
    i = data.find(b' ')
    t = data[:i].decode()
    rest = data[i + 1:]
    j = rest.find(b'\x00')
    return t, rest[j + 1:]


def read_tree(tree_sha, prefix=''):
    t, content = read_obj(tree_sha)
    if t != 'tree':
        raise ValueError(f'Expected tree object for {tree_sha}, got {t}')
    i = 0
    while i < len(content):
        j = content.find(b' ', i)
        mode = content[i:j].decode()
        k = content.find(b'\x00', j)
        name = content[j + 1:k].decode()
        sha = content[k + 1:k + 21].hex()
        path = os.path.join(prefix, name).replace('\\', '/')
        if mode == '40000':
            yield from read_tree(sha, path)
        else:
            yield path, sha
        i = k + 21

try:
    t, content = read_obj(commit_sha)
except FileNotFoundError as exc:
    print(exc)
    sys.exit(1)

if t != 'commit':
    print(f'Object {commit_sha} is not a commit but {t}')
    sys.exit(1)

commit_text = content.decode(errors='replace')
tree_sha = None
for line in commit_text.splitlines():
    if line.startswith('tree '):
        tree_sha = line.split()[1]
        break

if not tree_sha:
    print('Commit tree SHA not found')
    sys.exit(1)

print(f'Restoring commit {commit_sha} tree {tree_sha}')
restored = 0
for path, sha in read_tree(tree_sha):
    t, blob = read_obj(sha)
    if t != 'blob':
        print(f'Skipping non-blob {path} ({t})')
        continue
    out_path = root / path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(blob)
    restored += 1
    if restored % 100 == 0:
        print(f'Restored {restored} files...')

print(f'Restored {restored} tracked files from commit {commit_sha}')
