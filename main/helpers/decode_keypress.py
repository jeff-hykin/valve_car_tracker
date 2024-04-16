import re
import unicodedata
from typing import List, NamedTuple, Optional

class Keypress(NamedTuple):
    sequence: str
    unicode: str
    key: Optional[str] = None
    code: Optional[str] = None
    key_code: Optional[int] = None
    ctrl_key: bool = False
    meta_key: bool = False
    shift_key: bool = False

def to_unicode(string: str) -> str:
    result = ''
    for char in string:
        unicode = hex(ord(char))[2:].upper()
        while len(unicode) < 4:
            unicode = '0' + unicode
        unicode = '\\u' + unicode
        result += unicode
    return result

# Regexes used for ansi escape code splitting
meta_key_code_re = re.compile(r'^(?:\x1b)([a-zA-Z0-9])$')
function_key_code_re = re.compile(
    r'^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))')

chars_re = re.compile(r'^[A-zА-яЁё]$')

def decode_keypress(message: bytes) -> List[Keypress]:
    sequence = message.decode('utf-8')
    event = Keypress(sequence=sequence, unicode=to_unicode(sequence))

    if len(sequence) == 1:
        event = event._replace(key=sequence, key_code=ord(sequence))

    if sequence == '\r':
        event = event._replace(key='return')

    elif sequence == '\n':
        event = event._replace(key='enter')

    elif sequence == '\t':
        event = event._replace(key='tab')

    elif sequence in ('\b', '\x7f', '\x1b\x7f', '\x1b\b'):
        event = event._replace(key='backspace')

    elif sequence in ('\x1b', '\x1b\x1b'):
        event = event._replace(key='escape')

    elif sequence in (' ', '\x1b '):
        event = event._replace(key='space')

    elif ord(sequence) <= 0x1a:
        event = event._replace(
            key=chr(ord(sequence) + ord('a') - 1),
            ctrl_key=True
        )

    elif len(sequence) == 1 and chars_re.match(sequence):
        event = event._replace(
            key=sequence,
            shift_key=sequence != sequence.lowercase() and sequence == sequence.uppercase()
        )

    elif parts := meta_key_code_re.match(sequence):
        event = event._replace(
            key=parts[1].lower(),
            meta_key=True,
            shift_key=re.match(r'^[A-Z]$', parts[1]) is not None
        )

    elif parts := function_key_code_re.match(sequence):
        # reassemble the key code leaving out leading \x1b's,
        # the modifier key bitflag and any meaningless "1;" sequence
        code = parts[1] + parts[2] + parts[4] + parts[6]
        modifier = int(parts[3] or parts[5] or 1) - 1

        # Parse the key modifier
        event = event._replace(
            ctrl_key=(modifier & 4) != 0,
            meta_key=(modifier & 10) != 0,
            shift_key=(modifier & 1) != 0,
            code=code
        )

        # Parse the key itself
        key_map = {
            'OP': 'f1',
            'OQ': 'f2',
            'OR': 'f3',
            'OS': 'f4',
            '[11~': 'f1',
            '[12~': 'f2',
            '[13~': 'f3',
            '[14~': 'f4',
            '[[A': 'f1',
            '[[B': 'f2',
            '[[C': 'f3',
            '[[D': 'f4',
            '[[E': 'f5',
            '[15~': 'f5',
            '[17~': 'f6',
            '[18~': 'f7',
            '[19~': 'f8',
            '[20~': 'f9',
            '[21~': 'f10',
            '[23~': 'f11',
            '[24~': 'f12',
            '[A': 'up',
            '[B': 'down',
            '[C': 'right',
            '[D': 'left',
            '[E': 'clear',
            '[F': 'end',
            'OA': 'up',
            'OB': 'down',
            'OC': 'right',
            'OD': 'left',
            'OE': 'clear',
            'OF': 'end',
            '[1~': 'home',
            '[2~': 'insert',
            '[3~': 'delete',
            '[4~': 'end',
            '[5~': 'pageup',
            '[6~': 'pagedown',
            '[[5~': 'pageup',
            '[[6~': 'pagedown',
            '[7~': 'home',
            '[8~': 'end',
            '[a': 'up',
            '[b': 'down',
            '[c': 'right',
            '[d': 'left',
            '[2$': 'insert',
            '[3$': 'delete',
            '[5$': 'pageup',
            '[6$': 'pagedown',
            '[7$': 'home',
            '[8$': 'end',
            'Oa': 'up',
            'Ob': 'down',
            'Oc': 'right',
            'Od': 'left',
            'Oe': 'clear',
            '[2^': 'insert',
            '[3^': 'delete',
            '[5^': 'pageup',
            '[6^': 'pagedown',
            '[7^': 'home',
            '[8^': 'end',
            '[Z': 'tab',
        }
        event = event._replace(key=key_map.get(code, 'undefined'))

    return [event]