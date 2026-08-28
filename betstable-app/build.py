#!/usr/bin/env python3
"""Inline the app into a single file.

Two outputs, from one source tree:
  dist/betstable-app.html  standalone page — open it directly, no server
  dist/artifact.html       same page without the document skeleton, for hosts
                           that supply their own <head>/<body>
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'index.html'


def build() -> str:
    html = SRC.read_text()

    css = (ROOT / 'assets/app.css').read_text()
    html = html.replace('<link rel="stylesheet" href="assets/app.css">',
                        '<style>\n' + css + '\n</style>')

    def inline(match):
        path = ROOT / match.group(1)
        if not path.exists():
            sys.exit('missing script: ' + match.group(1))
        # </script> inside a string literal would close the tag early.
        body = path.read_text().replace('</script>', '<\\/script>')
        return '<script>\n' + body + '\n</script>'

    html = re.sub(r'<script src="(src/[^"]+)"></script>', inline, html)
    if 'src="src/' in html:
        sys.exit('a script tag was left un-inlined')
    return html


def to_artifact(html: str) -> str:
    """Strip the document skeleton, keeping title, fonts, styles and body."""
    head = html[html.index('<title>'):html.index('</head>')]
    head = '\n'.join(l for l in head.splitlines()
                     if not l.startswith('<meta') and 'rel="icon"' not in l
                     and 'rel="preconnect"' not in l)
    body = html[html.index('<body>') + len('<body>'):html.index('</body>')]
    return head.strip() + '\n' + body.strip() + '\n'


if __name__ == '__main__':
    out = build()
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    (dist / 'betstable-app.html').write_text(out)
    (dist / 'artifact.html').write_text(to_artifact(out))
    for f in ('betstable-app.html', 'artifact.html'):
        print(f'{f}: {(dist / f).stat().st_size / 1024:.0f} KB')
