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


def iter_commits(sha, limit=200):
    seen = set()
    queue = [sha]
    while queue and limit>0:
        cur = queue.pop(0)
        if cur in seen:
            continue
        seen.add(cur)
        t, content = read_obj(cur)
        if t != 'commit':
            break
        text = content.decode('utf-8', errors='replace')
        lines = text.splitlines()
        parents = []
        msg = []
        started = False
        for line in lines:
            if not started:
                if line.startswith('parent '):
                    parents.append(line.split()[1])
                elif line == '':
                    started = True
            else:
                msg.append(line)
        yield cur, parents, '\n'.join(msg).strip()
        queue.extend(parents)
        limit -= 1

for sha, parents, msg in iter_commits(head, limit=200):
    if '主题' in msg or '主题' in msg or 'theme' in msg or 'Theme' in msg or 'dark' in msg or 'light' in msg:
        print('MATCH', sha)
        print(msg)
        print('PARENTS', parents)
        print('---')
