"""Devanagari to Latin, for search.

Half the catalogue is in Devanagari, and shoppers type Hindi titles on a Latin
keyboard: "godaan", "premchand", "nirmala". Search over the Devanagari text alone
cannot match any of that, so those books were effectively unfindable unless the
romanised form happened to appear in a description — measured before this,
"nirmala" found निर्मला but "godaan" found nothing.

This is a search aid, not a transliteration standard. It is judged only by whether
a shopper's spelling reaches the right book, so:

  * Two spellings are produced for every word — a long form that doubles long
    vowels ("godaan") and a short form that does not ("godan") — because people
    write both and full-text matching is exact.
  * Schwa deletion is applied at the end of a word, since Hindi drops the inherent
    'a' there: राम is "ram"/"raam", never "raama".
  * Anything else is left to the trigram fallback in `core/search.py`, which
    already forgives a wrong letter or two.
"""

from __future__ import annotations

import re
import unicodedata

# Independent vowels. Long forms first; the short variant is derived below.
_VOWELS = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
    "ऋ": "ri", "ॠ": "ri", "ऌ": "li", "ए": "e", "ऐ": "ai", "ओ": "o",
    "औ": "au", "ऑ": "o", "ऍ": "e",
}

# Dependent vowel signs (matras) that follow a consonant.
_MATRAS = {
    "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri",
    "ॄ": "ri", "ॢ": "li", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ॉ": "o", "ॅ": "e",
}

# Consonants, without their inherent 'a' — that is added by the walker below.
_CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v", "ळ": "l",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    # Nukta forms, which carry the sounds Hindi borrowed from Persian and Arabic.
    "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "r", "ढ़": "rh",
    "फ़": "f", "य़": "y",
}

_DIGITS = {"०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
           "५": "5", "६": "6", "७": "7", "८": "8", "९": "9"}

_VIRAMA = "्"
_NUKTA = "़"
# Anusvara and chandrabindu both nasalise; 'n' is what people type for either.
_NASALS = {"ं": "n", "ँ": "n"}
_VISARGA = {"ः": "h"}

# Devanagari block, used to decide whether a string needs romanising at all.
_DEVANAGARI_RANGE = range(0x0900, 0x0980)


def has_devanagari(text: str) -> bool:
    return any(ord(ch) in _DEVANAGARI_RANGE for ch in text or "")


def _romanise_word(word: str, *, long_vowels: bool, compact: bool = False) -> str:
    """Transliterate one whitespace-free run of Devanagari.

    `compact` drops the inherent 'a' inside the word as well as at the end, which
    is what Hindi speakers actually do and how they spell it: प्रेमचंद is written
    "premchand", not "premachand". It is kept before a nasal, where the vowel is
    still pronounced (चं is "chan", not "chn").

    The rule over-applies on some words — मानसरोवर becomes "maansrovr" — but a
    spelling nobody types is harmless in an index, while missing "premchand" is
    not.
    """
    out: list[str] = []
    i = 0
    n = len(word)

    while i < n:
        ch = word[i]

        # A consonant plus the nukta sign is a single letter with its own sound.
        if i + 1 < n and word[i + 1] == _NUKTA and (ch + _NUKTA) in _CONSONANTS:
            ch = ch + _NUKTA
            i += 1

        if ch in _CONSONANTS:
            out.append(_CONSONANTS[ch])
            i += 1

            # What follows decides whether the inherent 'a' is pronounced.
            if i < n and word[i] == _VIRAMA:
                i += 1  # explicitly suppressed: this consonant joins the next
                continue
            if i < n and word[i] in _MATRAS:
                vowel = _MATRAS[word[i]]
                out.append(vowel if long_vowels else _shorten(vowel))
                i += 1
                continue
            if i < n and word[i] in _NASALS:
                # No matra, so the inherent 'a' is still there before the nasal.
                out.append("a")
                continue
            # Word-final inherent 'a' is dropped in Hindi (schwa deletion): राम
            # is "ram", not "rama". `compact` drops the internal ones too.
            if i < n and not compact:
                out.append("a")
            continue

        if ch in _VOWELS:
            vowel = _VOWELS[ch]
            out.append(vowel if long_vowels else _shorten(vowel))
            i += 1
            continue

        if ch in _MATRAS:
            # A stray matra with no consonant; treat it as its vowel.
            vowel = _MATRAS[ch]
            out.append(vowel if long_vowels else _shorten(vowel))
            i += 1
            continue

        if ch in _NASALS:
            out.append(_NASALS[ch])
            i += 1
            continue

        if ch in _VISARGA:
            out.append(_VISARGA[ch])
            i += 1
            continue

        if ch in _DIGITS:
            out.append(_DIGITS[ch])
            i += 1
            continue

        if ch in (_VIRAMA, _NUKTA, "‌", "‍"):
            # Joiners and a dangling virama carry no sound of their own.
            i += 1
            continue

        # Punctuation, Latin text already present, danda — kept as-is.
        out.append("।" == ch and " " or ch)
        i += 1

    return "".join(out).strip()


_VOWEL_LETTERS = set("aeiou")


def _is_typable(token: str) -> bool:
    """Reject a spelling no human would type.

    The compact rule drops every internal schwa, which is right for "premchand"
    but turns बच्चन into "bchchn". A run of four or more consonants is the signal:
    it cannot be pronounced, so nobody will search for it, and leaving it out keeps
    the index free of tokens that can only ever cause a spurious match.
    """
    run = 0
    i = 0
    n = len(token)
    while i < n:
        ch = token[i]
        if ch.isalpha() and ch not in _VOWEL_LETTERS:
            # "ch", "sh", "bh"... are one sound written with two letters. Counting
            # letters instead would read "bachchan" as a four-consonant pile-up and
            # throw away a perfectly typable name.
            i += 2 if (i + 1 < n and token[i + 1] == "h") else 1
            run += 1
            if run >= 4:
                return False
        else:
            run = 0
            i += 1
    return True


def _shorten(vowel: str) -> str:
    """"aa" -> "a", "ii" -> "i", "uu" -> "u". Diphthongs are left alone."""
    if len(vowel) == 2 and vowel[0] == vowel[1]:
        return vowel[0]
    return vowel


def romanise(text: str) -> str:
    """Both spellings of `text`, space separated, ready to be indexed.

    Returns "" for text with no Devanagari in it, so callers can store the result
    unconditionally without duplicating Latin titles into the index.
    """
    if not text or not has_devanagari(text):
        return ""

    words = text.split()
    variants = [
        " ".join(_romanise_word(w, long_vowels=True) for w in words),
        " ".join(_romanise_word(w, long_vowels=False) for w in words),
        " ".join(_romanise_word(w, long_vowels=False, compact=True) for w in words),
    ]

    # Deduplicated: a short word often romanises identically under every rule, and
    # repeating a lexeme in the vector gains nothing.
    seen: list[str] = []
    for token in " ".join(variants).split():
        if token and token not in seen and _is_typable(token):
            seen.append(token)
    return " ".join(seen)


def search_aliases(*fields: str) -> str:
    """Romanised aliases for every Devanagari field of a book, as one string."""
    parts = [romanise(f) for f in fields if f]
    return " ".join(p for p in parts if p)


def author_slug(name: str) -> str:
    """A URL-safe, readable slug for an author's name.

    Author pages need one canonical spelling per author, which `romanise` does not
    give: it deliberately returns several spellings space-separated so the search
    index can match any of them. Picking one of those is this function's job.

    Devanagari names use the short-vowel spelling — `munshi-premchand` rather than
    `munshii-premachand` — because that is how a reader would type it and how it
    appears in print. Latin names are simply lowered and hyphenated.

    Returns "" when nothing usable survives, so callers can skip rather than
    publishing a URL that is just a hyphen.
    """
    if not name:
        return ""

    if has_devanagari(name):
        words = [w for w in name.split() if w]
        text = " ".join(_romanise_word(w, long_vowels=False) for w in words)
    else:
        text = name

    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    # Anything that is not a letter, digit or space becomes a separator, so
    # "Dr. B.R. Ambedkar" does not turn into "drbr-ambedkar".
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return "-".join(text.split())
