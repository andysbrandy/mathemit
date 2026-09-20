#!/usr/bin/env python3
"""check-strict-vars.py - findet Zuweisungen an nicht deklarierte Bezeichner.

Hintergrund: app-base.js und app-active.js laufen in einer IIFE mit "use strict".
Dort wirft jede Zuweisung an eine nicht deklarierte Variable zur Laufzeit
"ReferenceError: Can't find variable: X" (Safari) bzw. "X is not defined".
Dieser Check findet solche Stellen statisch, bevor sie live gehen.

Aufruf:  python3 scripts/check-strict-vars.py app-active.js app-base.js
Exit-Code 1, wenn Treffer gefunden wurden.
"""
import re
import sys

IDENT = r'[A-Za-z_$][\w$]*'
# Zuweisung am Statement-Anfang (Zeilenanfang oder nach ; { } ) , ( )
RE_ASSIGN = re.compile(r'(?:^|[;{}),])[ \t]*(' + IDENT + r')[ \t]*(\+=|-=|\*=|\/=|=(?![=>]))', re.M)
# zusätzlich: for(i = 0; ...) / if(x = 1) — Zuweisung direkt nach '('
RE_ASSIGN_PAREN = re.compile(r'\([ \t]*(' + IDENT + r')[ \t]*(\+=|-=|\*=|\/=|=(?![=>]))', re.M)
RE_DECL = re.compile(r'\b(?:var|let|const)\s+')
RE_FUNC = re.compile(r'\bfunction\b\s*(' + IDENT + r')?\s*\(')
RE_FUNC_EXPR = re.compile(r'\b(' + IDENT + r')\s*=\s*function\s*\(')
RE_ARROW = re.compile(r'(?:\(([^()]*)\)|(' + IDENT + r'))\s*=>\s*\{')


def strip_strings_and_comments(raw):
    """Ersetzt String-Inhalte und Kommentare durch Leerzeichen (Offsets bleiben)."""
    out, i, n = [], 0, len(raw)
    while i < n:
        ch = raw[i]
        if ch == '/' and i + 1 < n and raw[i + 1] == '/':
            while i < n and raw[i] != '\n':
                i += 1
        elif ch == '/' and i + 1 < n and raw[i + 1] == '*':
            i += 2
            while i + 1 < n and not (raw[i] == '*' and raw[i + 1] == '/'):
                out.append('\n' if raw[i] == '\n' else ' ')
                i += 1
            i += 2
        elif ch in '"\'':
            q = ch
            out.append(q)
            i += 1
            while i < n and raw[i] != q:
                if raw[i] == '\\' and i + 1 < n:
                    out.append(' \n' if raw[i + 1] == '\n' else '  ')
                    i += 2
                    continue
                out.append('\n' if raw[i] == '\n' else ' ')
                i += 1
            out.append(q)
            i += 1
        else:
            out.append(ch)
            i += 1
    return ''.join(out)


def match_brace(src, start):
    """Index des '{' -> Index des zugehoerigen '}' (oder len(src))."""
    depth = 0
    for j in range(start, len(src)):
        if src[j] == '{':
            depth += 1
        elif src[j] == '}':
            depth -= 1
            if depth == 0:
                return j
    return len(src)


def parse_params(text):
    names = []
    for p in text.split(','):
        p = p.strip().split('=')[0].strip()
        if re.fullmatch(IDENT, p):
            names.append(p)
    return names


class Scope(object):
    def __init__(self, parent, start, end):
        self.parent = parent
        self.start = start            # Position der '{'
        self.end = end                # Position der '}'
        self.body_start = start + 1
        self.children = []
        self.declared = set()
        if parent is not None:
            parent.children.append(self)

    def has(self, name):
        s = self
        while s is not None:
            if name in s.declared:
                return True
            s = s.parent
        return False

    def own_ranges(self):
        """Bereiche des eigenen Rumpfes ohne verschachtelte Funktionskoerper."""
        ranges, pos = [], self.body_start
        for c in sorted(self.children, key=lambda s: s.start):
            ranges.append((pos, c.start))
            pos = c.end + 1
        ranges.append((pos, self.end))
        return [(a, b) for a, b in ranges if b > a]


def collect_scopes(src, parent, start, end):
    """Rekursiv Funktions-Scopes sammeln (keine Duplikate, korrekte Eltern)."""
    pos = start
    while pos < end:
        hits = []
        for rx in (RE_FUNC, RE_ARROW):
            m = rx.search(src, pos, end)
            if m:
                hits.append(m)
        if not hits:
            break
        m = min(hits, key=lambda x: x.start())
        if m.re is RE_FUNC:
            paren = m.end() - 1
            depth, k = 0, paren
            while k < end:
                if src[k] == '(':
                    depth += 1
                elif src[k] == ')':
                    depth -= 1
                    if depth == 0:
                        break
                k += 1
            params = src[paren + 1:k]
            brace = src.find('{', k)
        else:
            params = m.group(1) or m.group(2) or ''
            brace = m.end() - 1
        if brace == -1 or brace >= end:
            pos = m.end()
            continue
        close = match_brace(src, brace)
        sc = Scope(parent, brace, close)
        sc.declared.update(parse_params(params))
        fe = RE_FUNC_EXPR.search(src, max(0, m.start() - 60), m.start())
        if fe:
            parent.declared.add(fe.group(1))   # handleCheck = function(){}
        else:
            name = m.group(1) if m.re is RE_FUNC else None
            if name:
                parent.declared.add(name)      # function foo(){}
                sc.declared.add(name)
        collect_scopes(src, sc, brace, close)
        pos = close + 1



def split_decl_names(text):
    """'a = {}, b = [1,2], c' -> a, b, c (verschachtelte Klammern entfernt)."""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r'\{[^{}]*\}|\[[^\[\]]*\]|\([^()]*\)', ' ', text)
    names = []
    for part in text.split(','):
        mm = re.match(r'\s*(' + IDENT + r')', part)
        if mm:
            names.append(mm.group(1))
    return names


def scan(path):
    raw = open(path, encoding='utf-8').read()
    src = strip_strings_and_comments(raw)
    raw_lines = raw.split('\n')
    root = Scope(None, -1, len(src))
    root.body_start = 0
    collect_scopes(src, root, 0, len(src))

    # Deklarationen je Scope (nur eigener Rumpf)
    stack = [root]
    while stack:
        sc = stack.pop()
        for a, b in sc.own_ranges():
            for m in RE_DECL.finditer(src, a, b):
                seg = src[m.end():min(b, m.end() + 400)]
                cut = re.search(r'[;\n]', seg)
                if cut:
                    seg = seg[:cut.start()]
                sc.declared.update(split_decl_names(seg))
        stack.extend(sc.children)

    # Zuweisungen pruefen
    hits = set()
    stack = [root]
    while stack:
        sc = stack.pop()
        for a, b in sc.own_ranges():
            for rx in (RE_ASSIGN, RE_ASSIGN_PAREN):
                for m in rx.finditer(src, a, b):
                    if not sc.has(m.group(1)):
                        line = src[:m.start(1)].count('\n') + 1
                        hits.add((line, raw_lines[line - 1].strip()[:120]))
        stack.extend(sc.children)
    return sorted(hits)


def main():
    total = 0
    for path in sys.argv[1:]:
        hits = scan(path)
        print('=== %s ===' % path)
        if not hits:
            print('  OK - keine nicht deklarierten Zuweisungen')
        for line, text in hits:
            print('  Zeile %d: %s' % (line, text))
        total += len(hits)
    print('--- %d Treffer ---' % total)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())


def split_decl_names(text):
    """'a = {}, b = [1,2], c' -> a, b, c (verschachtelte Klammern entfernt)."""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r'\{[^{}]*\}|\[[^\[\]]*\]|\([^()]*\)', ' ', text)
    names = []
    for part in text.split(','):
        mm = re.match(r'\s*(' + IDENT + r')', part)
        if mm:
            names.append(mm.group(1))
    return names

    return names
