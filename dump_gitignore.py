import pathlib

path = pathlib.Path('.gitignore')
if path.exists():
    print(path.read_text())
else:
    print('MISSING')
