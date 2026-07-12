import json, re, sys
data = open('E:/APP/ui/temp_output.json', 'r', encoding='utf-8-sig').read()
# Fix broken JSON by finding BitDesc patterns
pattern = r'"Name_English":"([^"]*?)","Name_Chinase":"([^"]*?)".*?"BitTag":"TRUE".*?"BitDesc":"([^"]*?)"'
matches = re.findall(pattern, data)
for m in matches:
    if m[2]:
        print(f"{m[0]}|{m[1]}|{m[2]}")