"""Build every studio page while preserving the ebook's interactive shelf."""
import re
from site_common import ROOT, render_shell
from build_home import main as build_home

def main():
    build_home()
    for page in ('assets','asset','ebooks'):
        source=(ROOT/f'templates/{page}.html').read_text(encoding='utf-8')
        output=render_shell(source,page)
        if re.search(r'\{\{[A-Z_]+\}\}',output):
            raise ValueError(f'Unresolved template token in {page}')
        (ROOT/f'{page}.html').write_text(output,encoding='utf-8')
        print(f'Built {page}.html')

if __name__=='__main__':
    main()
