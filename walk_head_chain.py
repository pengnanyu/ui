import pathlib
import zlib

repo = pathlib.Path('e:/APP/ui/.git')
head_ref = (repo / 'HEAD').read_text().strip()
if head_ref.startswith('ref: '):
    head_ref = (repo / head_ref[5:]).read_text().strip()


def read_obj(sha):
    path = repo / 'objects' / sha[:2] / sha[2:]
    data = zlib.decompress(path.read_bytes())
    i = data.find(b' ')
    t = data[:i].decode()
    rest = data[i+1:]
    j = rest.find(b'\x00')
    return t, rest[j+1:]


def parse_commit(sha):
    t, content = read_obj(sha)
    if t != 'commit':
        raise RuntimeError(f'{sha} is not a commit')
    text = content.decode('utf-8', errors='replace')
    lines = text.splitlines()
    parents = []
    msg_lines = []
    in_msg = False
    for line in lines:
        if not in_msg:
            if line.startswith('parent '):
                parents.append(line.split()[1])
            elif line == '':
                in_msg = True
        else:
            msg_lines.append(line)
    return parents, '\n'.join(msg_lines).strip()

cur = head_ref
for i in range(40):
    parents, msg = parse_commit(cur)
    print(f'{i}: {cur}')