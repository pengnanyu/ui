import pathlib
import zlib
import os

repo = pathlib.Path('e:/APP/ui/.git')
head = (repo / 'HEAD').read_text().strip()
if head.startswith('ref: '):
    ref = head[5:]
    head = (repo / ref).read_text().strip()


def read_obj(sha):
    path = repo / 'objects' / sha[:2] / sha[2:]
    data = zlib.decompress(path.read_bytes())
    i = data.find(b' ')
    t = data[:i].decode()
    rest = data[i+1:]
    j = rest.find(b'\x00')
    return t, rest[j+1:]


def commit_info(sha):
    t, content = read_obj(sha)
    if t != 'commit':
        raise RuntimeError(f'Not commit: {sha} {t}')
    text = content.decode('utf-8', errors='replace')
    lines = text.splitlines()
    info = {'sha': sha, 'parents': [], 'author': '', 'date': '', 'message': ''}
    msg = []
    started = False
    for line in lines:
        if not started:
            if line.startswith('parent '):
                info['parents'].append(line.split()[1])
            elif line.startswith('author '):
                info['author'] = line[7:]
            elif line.startswith('committer '):
                info['date'] = line[10:]
            elif line == '':
                started = True
        else:
            msg.append(line)
    info['message'] = '\n'.join(msg).strip()
    return info


def walk_commits(sha, limit=20):
    seen = set()
    queue = [sha]
    result = []
    while queue and len(result) < limit:
        cur = queue.pop(0)
        if cur in seen:
            continue
        seen.add(cur)
        info = commit_info(cur)
        result.append(info)
        queue.extend(info['parents'])
    return result

commits = walk_commits(head, limit=15)
for c in commits:
    print('COMMIT', c['sha'])
    print('PARENTS', c['parents'])
    print('AUTHOR', c['author'])
    print('DATE', c['date'])
    print('MESSAGE', c['message'][:200].replace('\n',' | '))
    print('---')
