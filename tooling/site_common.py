"""One navigation, footer and design revision across the studio website."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def revision():
    paths = ['css/fonts.css','css/home.css','css/style.css','css/site.css','css/showcase.css','js/home.js','js/world.js','js/main.js']
    return hashlib.sha256(b''.join((ROOT/p).read_bytes() for p in paths)).hexdigest()[:12]

def render_shell(source, page):
    for name in ('header','footer'):
        source = source.replace('{{SITE_'+name.upper()+'}}', (ROOT/f'templates/partials/{name}.html').read_text(encoding='utf-8'))
    values = {
        'HOME_LINK':'#welcome' if page=='home' else 'index.html',
        'HOME_URL':'' if page=='home' else 'index.html',
        'TOOLS_CURRENT':'aria-current="page"' if page in ('asset','assets') else '',
        'BOOKS_CURRENT':'aria-current="page"' if page=='ebooks' else '',
        'ASSET_REV':revision()
    }
    for key,value in values.items():
        source=source.replace('{{'+key+'}}',value)
    return source
