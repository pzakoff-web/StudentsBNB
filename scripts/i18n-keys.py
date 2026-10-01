#!/usr/bin/env python3
"""Lists every translation key used in js/: string literals passed to t() or plural(),
plus the label tables that are translated at render time. Used by tests/i18n.test.js."""
import re, glob, json, sys

CYR = re.compile(r"[А-Яа-я]")
TABLES = ["AMENITIES", "REVIEW_CATS", "GENDER_PREF", "TYPE_LABEL", "CATEGORIES", "SLEEP", "CLEAN", "GUESTS", "SPOKEN",
          "STEP_NAMES", "ROOMS", "SYSTEM", "DIRECT_REPLIES", "genderWord", "demoReply"]

def read_string(s, i):
    q = s[i]; j = i + 1; out = []
    while s[j] != q:
        if s[j] == "\\": out.append(s[j:j + 2]); j += 2; continue
        out.append(s[j]); j += 1
    return "".join(out), j + 1

def skip_template(s, i):
    j = i + 1; depth = 0
    while True:
        c = s[j]
        if c == "\\": j += 2; continue
        if c == "`" and depth == 0: return j + 1
        if c == "$" and s[j + 1] == "{": depth += 1; j += 2; continue
        if c == "}" and depth: depth -= 1
        elif c in "\"'" and depth: _, j = read_string(s, j); continue
        elif c == "`" and depth: j = skip_template(s, j); continue
        j += 1

def args_of(s, i):
    """i points at '('; returns list of (literal strings per top-level argument)."""
    depth = 0; j = i; args = [[]]
    while True:
        c = s[j]
        if c in "\"'":
            lit, j = read_string(s, j)
            if depth == 1: args[-1].append(lit)
            continue
        if c == "`": j = skip_template(s, j); continue
        if c in "([{": depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0: return args
        elif c == "," and depth == 1: args.append([])
        j += 1

def literals_in_block(s, i):
    depth = 0; j = i; out = []
    while True:
        c = s[j]
        if c in "\"'":
            lit, j = read_string(s, j); out.append(lit); continue
        if c == "`": j = skip_template(s, j); continue
        if c in "([{": depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0: return out
        elif c in ";\n" and depth == 0 and out: return out
        j += 1

keys = set()
for f in glob.glob("js/**/*.js", recursive=True):
    if any(x in f for x in ("i18n/", "icons.js", "seed.js")): continue
    s = open(f, encoding="utf-8").read()
    for m in re.finditer(r"(?<![\w.$])t\(", s):
        a = args_of(s, m.end() - 1)
        keys.update(x for x in a[0] if CYR.search(x))
    for m in re.finditer(r"(?<![\w.$])plural\(", s):
        a = args_of(s, m.end() - 1)
        for part in a[1:3]: keys.update(x for x in part if CYR.search(x))
    for name in TABLES:
        for m in re.finditer(r"(?:const|export const)\s+" + name + r"\s*=\s*", s):
            k = m.end()
            while s[k] not in "[{(": k += 1
            keys.update(x for x in literals_in_block(s, k) if CYR.search(x))
json.dump(sorted(keys), sys.stdout, ensure_ascii=False, indent=0)
