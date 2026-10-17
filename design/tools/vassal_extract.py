#!/usr/bin/env python3
"""Extract game facts (numbers/names only) from an unpacked VASSAL module of
Combat Commander: Europe (module 2.6.4).

Reads ONLY the paths passed on the command line; writes JSON to stdout or to
an explicit --out path. Never executes anything from the module.

Run with the isolated interpreter, from a directory that is NOT inside the
extracted module:

    python3 -I vassal_extract.py cards    <buildFile.xml> [--decks German,Soviet,US]   (raw)
    python3 -I vassal_extract.py fate-cards <buildFile.xml>                         (clean)
    python3 -I vassal_extract.py counters <buildFile.xml>
    python3 -I vassal_extract.py grids    <buildFile.xml>
    python3 -I vassal_extract.py decode-save <scenario.vsav> <out.txt>
    python3 -I vassal_extract.py save-pieces <decoded-save.txt> [--map MainMap]
    python3 -I vassal_extract.py scenario <buildFile.xml> <decoded-save.txt>   (one predefined setup)
    python3 -I vassal_extract.py terrain  <terrainMaps/Board N.txt>
    python3 -I vassal_extract.py hex      <label e.g. F6>    (pixel centre on a 3300x2600 map)

Encoding notes (VASSAL):
  * A piece definition is "+/<id>/<type>/<state>" SequenceEncoded with '/'.
  * <type> and <state> are nested decorator lists SequenceEncoded with TAB:
    first token = outermost trait, second token = everything inside it.
  * An escaped delimiter is "\\<delim>" (exactly one backslash is removed per
    decoding level); tokens wrapped in single quotes are unwrapped.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

# ----------------------------------------------------------------------------
# VASSAL SequenceEncoder
# ----------------------------------------------------------------------------

def se_decode(val, delim):
    """Port of VASSAL SequenceEncoder.Decoder (split all tokens)."""
    out = []
    if val is None:
        return out
    while val is not None:
        i = val.find(delim)
        if i < 0:
            tok, val = val, None
        else:
            parts = []
            begin, end = 0, i
            while end >= 0 and begin <= end and end > 0 and val[end - 1] == '\\':
                parts.append(val[begin:end - 1])
                begin = end
                end = val.find(delim, end + 1)
            if end < 0:
                parts.append(val[begin:])
                val = None
            else:
                parts.append(val[begin:end])
                val = val[end + 1:]
            tok = ''.join(parts)
        if len(tok) > 1 and tok[0] == "'" and tok[-1] == "'":
            tok = tok[1:-1]
        out.append(tok)
    return out


def split_traits(type_str, state_str):
    """Return [(trait_type, trait_state), ...] outermost first; last is BasicPiece."""
    traits = []
    t, s = type_str, state_str or ''
    while True:
        tt = se_decode(t, '\t')
        ss = se_decode(s, '\t') if s else ['']
        traits.append((tt[0], ss[0] if ss else ''))
        if len(tt) < 2:
            break
        t = tt[1]
        s = ss[1] if len(ss) > 1 else ''
    return traits


def parse_piece(text):
    parts = se_decode(text.strip(), '/')
    if len(parts) < 3 or parts[0] != '+':
        raise ValueError('not an AddPiece command: %r' % text[:60])
    return split_traits(parts[2], parts[3] if len(parts) > 3 else '')


def trait_kind(t):
    return t.split(';', 1)[0]


def basic_name(traits):
    t = traits[-1][0]
    f = se_decode(t, ';')
    return f[-1] if f and f[0] == 'piece' else None


def basic_state(traits):
    f = se_decode(traits[-1][1], ';')
    return {'map': f[0] if f else None,
            'x': int(f[1]) if len(f) > 1 and f[1].lstrip('-').isdigit() else None,
            'y': int(f[2]) if len(f) > 2 and f[2].lstrip('-').isdigit() else None}


def emb_images(trait_type):
    """Image list of an emb2 (Layer) trait."""
    f = se_decode(trait_type, ';')
    if len(f) > 16:
        return [x for x in se_decode(f[16], ',')]
    return []


def emb_name(trait_type):
    f = se_decode(trait_type, ';')
    return f[19] if len(f) > 19 else ''


# ----------------------------------------------------------------------------
# Module (buildFile.xml) helpers
# ----------------------------------------------------------------------------

class Module:
    def __init__(self, path):
        self.root = ET.parse(path).getroot()
        self.protos = {}
        for p in self.root.iter('VASSAL.build.module.PrototypeDefinition'):
            try:
                self.protos[p.get('name')] = parse_piece(p.text or '')
            except Exception:
                self.protos[p.get('name')] = []

    def expand(self, traits, seen=None):
        """Inline 'prototype;Name' traits recursively. Returns list of
        (type, state, origin) where origin is the prototype chain."""
        seen = seen or ()
        out = []
        for t, s in traits:
            if trait_kind(t) == 'prototype':
                name = se_decode(t, ';')[1]
                if name in seen or name not in self.protos:
                    out.append((t, s, seen))
                    continue
                inner = self.protos[name][:-1]  # drop the prototype's empty BasicPiece
                out.append((t, s, seen))
                out.extend(self.expand(inner, seen + (name,)))
            else:
                out.append((t, s, seen))
        return out

    def list_widget(self, entry_name):
        for lw in self.root.iter('VASSAL.build.widget.ListWidget'):
            if lw.get('entryName') == entry_name:
                return [(s.get('entryName'), s.get('gpid'), s.text or '') for s in lw]
        return []

    def draw_pile(self, name):
        for dp in self.root.iter('VASSAL.build.module.map.DrawPile'):
            if dp.get('name') == name:
                return [(s.get('entryName'), s.get('gpid'), s.text or '') for s in dp]
        return []


# ----------------------------------------------------------------------------
# Fate cards
# ----------------------------------------------------------------------------

TRIGGER = {'': None, 'j': 'Jammed', 't': 'Time', 's': 'Sniper', 'e': 'Event',
           'd': 'Dispersal (smoke/starshell)'}


def card_from_traits(mod, traits):
    protos = [se_decode(t, ';')[1] for t, s in traits if trait_kind(t) == 'prototype']
    card = {'orders': [], 'actions': [], 'events': [], 'dice': None, 'random_hex': None,
            'trigger': None, 'raw_prototypes': protos}
    for p in protos:
        m = re.match(r'^DR-(\d)-(\d)([a-z]?)$', p)
        if m:
            card['dice'] = {'white': int(m.group(1)), 'red': int(m.group(2)),
                            'total': int(m.group(1)) + int(m.group(2))}
            card['trigger'] = TRIGGER.get(m.group(3), m.group(3))
        elif p.startswith('H-'):
            card['random_hex'] = p[2:]
        elif p.startswith('O-'):
            card['orders'].append(p[2:])
        elif p.startswith('A-') or p.startswith('AF-'):
            card['actions'].append(p)
        elif p.startswith('E-'):
            card['events'].append(p[2:])
    return card


def card_layers(mod, traits):
    """Images composing a card face, bottom-most first (BasicPiece image, then
    decorators from the inside out; prototypes expanded in place)."""
    ex = mod.expand(traits)
    layers = []
    bt = se_decode(ex[-1][0], ';')
    if len(bt) > 3 and bt[3]:
        layers.append(bt[3])
    for t, s, o in reversed(ex[:-1]):
        if trait_kind(t) == 'emb2':
            imgs = emb_images(t)
            lv = se_decode(s, ';')[0] if s else '1'
            try:
                lv = int(lv)
            except ValueError:
                lv = 1
            if 0 < lv <= len(imgs) and imgs[lv - 1]:
                layers.append(imgs[lv - 1])
    return layers


def card_marks(traits):
    m = {}
    for t, s in traits:
        if trait_kind(t) == 'mark':
            m[se_decode(t, ';')[1]] = s
    return m


# Display names as printed in the title bars of the module's card-layer
# images (read visually; see design/vassal-survey.md). Key = image-name prefix
# with the nation suffix (G/S/U/A/B/F/I) stripped.
ORDER_NAMES = {'O-advance': 'Advance', 'O-confusion': 'Command Confusion',
               'OA-confusion': 'Command Confusion', 'O-denied': 'Artillery Denied',
               'O-fire': 'Fire', 'O-move': 'Move', 'O-recover': 'Recover',
               'O-request': 'Artillery Request', 'O-rout': 'Rout'}
ACTION_NAMES = {'Action-Ambush': ('Ambush', False), 'Action-Assault Fire': ('Assault Fire', False),
                'Action-Boresight': ('Bore Sighting', True), 'Action-Concealment': ('Concealment', False),
                'Action-Crossfire': ('Crossfire', False), 'Action-Demolitions': ('Demolitions', False),
                'Action-Dig In': ('Dig In', False), 'Action-Hand Grenades': ('Hand Grenades', False),
                'Action-Hidden Mines': ('Hidden Mines', True), 'Action-Hidden Pillbox': ('Hidden Pillbox', True),
                'Action-Hidden Trench': ('Hidden Entrenchments', True), 'Action-Hidden Unit': ('Hidden Unit', True),
                'Action-Hidden Wire': ('Hidden Wire', True), 'Action-Light Wounds': ('Light Wounds', False),
                'Action-Marksman': ('Marksmanship', False), 'Action-NoQ': ('No Quarter', False),
                'Action-Smoke Grenades': ('Smoke Grenades', False), 'Action-Spray Fire': ('Spray Fire', False),
                'Action-Sustained fire': ('Sustained Fire', False)}
EVENT_NAMES = {'Event-Air support': 'Air Support', 'Event-Blaze': 'Blaze', 'Event-Booby trap': 'Booby Trap',
               'Event-Breeze': 'Breeze', 'Event-CandC': 'Command & Control', 'Event-Commisar': 'Commissar',
               'Event-Cower': 'Cower', 'Event-Deploy': 'Deploy', 'Event-Dust': 'Dust', 'Event-Elan': 'Elan',
               'Event-Entrench': 'Entrench', 'Event-Fog': 'Fog of War', 'Event-Hero': 'Hero',
               'Event-Infiltrate': 'Infiltration', 'Event-Integrity': 'Battlefield Integrity',
               'Event-Interdiction': 'Interdiction', 'Event-Interrogation': 'Interrogation', 'Event-KIA': 'KIA',
               'Event-Malfunction': 'Malfunction', 'Event-Medic': 'Medic', 'Event-Mission Obj': 'Mission Objective',
               'Event-Pow': 'Prisoners of War', 'Event-Promote': 'Field Promotion', 'Event-Recon': 'Reconnaissance',
               'Event-Reinforce': 'Reinforcements', 'Event-Rubble': 'Rubble', 'Event-Sappers': 'Sappers',
               'Event-Scrounge': 'Scrounge', 'Event-Shell shock': 'Shell Shock', 'Event-Shellholes': 'Shellholes',
               'Event-Strategic': 'Strategic Objective', 'Event-Suppress': 'Suppressing Fire',
               'Event-Vet': 'Battle Harden', 'Event-WhiteP': 'White Phosphorous', 'Event-Wounded': 'Walking Wounded'}


def _lookup(img, table):
    stem = img[:-4] if img.lower().endswith('.png') else img
    for cand in (stem, stem.rstrip('0123456789'), stem[:-1], stem[:-1].rstrip('0123456789')):
        if cand in table:
            return table[cand]
    return None


def cmd_fate_cards(args):
    """Clean per-card records for the three base-game decks."""
    mod = Module(args[0])
    decks = {'German': 'German', 'Soviet': 'Russian', 'US': 'American'}
    out = {'_source': 'VASSAL module CombatCommanderEurope-2.6.4.vmod, buildFile.xml DrawPiles '
                      '(Decks map); names read from the title bars of the card-layer images',
           'decks': {}}
    for pile, nation in decks.items():
        cards = []
        for entry, gpid, text in mod.draw_pile(pile):
            traits = parse_piece(text)
            raw = card_from_traits(mod, traits)
            layers = card_layers(mod, traits)
            marks = card_marks(traits)
            order = action = event = None
            action_defender_only = False
            order_img = layers[0]
            order = _lookup(order_img, ORDER_NAMES)
            for im in layers[1:]:
                if im.startswith('Action-'):
                    action, action_defender_only = _lookup(im, ACTION_NAMES) or (im, False)
                elif im.startswith('Event-'):
                    event = _lookup(im, EVENT_NAMES) or im
            if order_img.startswith('OA-'):
                action = 'Command Confusion'  # printed in both the order and action bars
            rec = {'id': entry, 'number': int(entry.split('-')[1]),
                   'order': order,
                   'order_also_playable_as_action': order == 'Fire',
                   'action': action,
                   'action_defender_only': action_defender_only,
                   'event': event,
                   'dice': raw['dice'],
                   'trigger': raw['trigger'],
                   'random_hex': raw['random_hex']}
            if event == 'Breeze' and 'direction' in marks:
                rec['breeze_direction'] = int(marks['direction'])
            rec['module'] = {'layers': layers, 'prototypes': [p for p in raw['raw_prototypes']
                                                             if p not in ('Draw',) and not p.startswith('Discard')]}
            cards.append(rec)
        out['decks'][nation] = cards
    print(json.dumps(out, indent=1))


def cmd_cards(args):
    mod = Module(args[0])
    decks = ['German', 'Soviet', 'US']
    if '--decks' in args:
        decks = args[args.index('--decks') + 1].split(',')
    out = {}
    for d in decks:
        cards = []
        for entry, gpid, text in mod.draw_pile(d):
            traits = parse_piece(text)
            c = card_from_traits(mod, traits)
            c['id'] = entry
            c['number'] = int(entry.split('-')[-1]) if entry.split('-')[-1].isdigit() else entry
            c['layers'] = card_layers(mod, traits)
            c['marks'] = card_marks(traits)
            # report strings carry the module's own display names for each part
            cards.append(c)
        out[d] = cards
    # resolve display names of the prototypes (from the 'report' traits)
    names = {}
    for pname, traits in mod.protos.items():
        if pname[:2] in ('O-', 'A-', 'E-') or pname[:3] == 'AF-':
            for t, s in traits:
                if trait_kind(t) == 'report':
                    f = se_decode(t, ';')
                    names[pname] = f[2] if len(f) > 2 else ''
                    break
    print(json.dumps({'decks': out, 'prototype_reports': names}, indent=1))


# ----------------------------------------------------------------------------
# Counters
# ----------------------------------------------------------------------------

BREAK_KEY, RALLY_KEY = '66,130', '89,130'   # Ctrl-B / Ctrl-Y


def prop_info(t, s):
    f = se_decode(t, ';')
    name = f[1]
    changes = f[3] if len(f) > 3 else ''
    on_break = None
    for ch in se_decode(changes, ','):
        pass
    m = re.search(r':66\\?,130:I\\?,(-?\d+)', t)
    if m:
        on_break = int(m.group(1))
    return name, s, on_break


def counter_from_slot(mod, name, text):
    traits = parse_piece(text)
    ex = mod.expand(traits)
    protos = [se_decode(t, ';')[1] for t, s, o in ex if trait_kind(t) == 'prototype']
    rec = {'name': name, 'module_prototypes': protos}
    vals, brk = {}, {}
    for t, s, o in ex:
        k = trait_kind(t)
        if k == 'PROP':
            pname, val, on_break = prop_info(t, s)
            if pname in ('MoveValue', 'RangeValue', 'FirepowerValue', 'MoraleValue', 'CommandValue', 'CommandScout'):
                if pname not in vals:
                    vals[pname] = val
                    brk[pname] = on_break
        elif k == 'emb2':
            imgs = emb_images(t)
            for im in imgs:
                if im.startswith('Repair '):
                    m = re.match(r'Repair (\S+) X (\S+)\.png', im)
                    if m:
                        rec['broken_side'] = {'repair_roll': m.group(1), 'eliminate_roll': m.group(2),
                                              'image': im}
                if im.startswith('Wpn MP '):
                    rec['portage_or_move_penalty'] = int(im[len('Wpn MP '):-4])
                if re.match(r'Range \d+-\d+\.png', im):
                    rec['range_band'] = im[len('Range '):-4]
            if emb_name(t) == 'Counter Text' and imgs:
                rec['label_image'] = imgs[0]
            if emb_name(t) == 'Counter' and imgs:
                rec['art_image'] = imgs[0]
    def num(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None
    key = {'FirepowerValue': 'firepower', 'RangeValue': 'range', 'MoveValue': 'movement',
           'MoraleValue': 'morale', 'CommandValue': 'command'}
    front, back = {}, {}
    for pk, ok in key.items():
        if pk in vals:
            front[ok] = num(vals[pk])
            back[ok] = front[ok] + (brk[pk] or 0) if front[ok] is not None else None
    rec['front'] = front
    if any(p in protos for p in ('RallyBreak',)) or 'CommandValue' in vals:
        rec['broken'] = back
    boxed = [p for p in protos if p.startswith('Box ')]
    if boxed:
        code = boxed[0][4:].rstrip('2')
        rec['boxed'] = {'firepower': 'F' in code, 'range': 'R' in code, 'movement': 'M' in code}
        rec['boxed_on_broken_side'] = boxed[0] == 'Box F2'
    if 'SmokeOrd' in protos:
        rec['smoke_capable'] = True
    for p in protos:
        if p.startswith('Command ') and p not in ('Command Scout',):
            rec['module_command_prototype'] = p
    for p in protos:
        if p.startswith('Range ') and re.match(r'Range \d+-\d+$', p):
            rec['range_band'] = p[6:]
    rec['type_hint'] = ('leader' if any(p.startswith('Ldr') or p.startswith('Hero') for p in protos)
                        else 'team' if any(p.startswith('HalfS') for p in protos)
                        else 'squad' if any(p.startswith('Sqd') for p in protos)
                        else 'ordnance' if any(p.startswith('Ord ') for p in protos)
                        else 'weapon' if any(p.startswith('Wpn ') for p in protos)
                        else 'other')
    return rec


def cmd_counters(args):
    mod = Module(args[0])
    lists = {
        'German': ['German Leaders', 'German Squads & Teams', 'German Weapons'],
        'Soviet': ['Soviet Leaders', 'Soviet Squads & Teams', 'Soviet Weapons'],
        'US': ['US Leaders', 'US Squads & Teams', 'US Weapons'],
        'Markers': ['Utility'],
    }
    out = {}
    for nation, lws in lists.items():
        out[nation] = {}
        for lw in lws:
            out[nation][lw] = [counter_from_slot(mod, n, t) for n, g, t in mod.list_widget(lw)]
    print(json.dumps(out, indent=1))


# ----------------------------------------------------------------------------
# Grids
# ----------------------------------------------------------------------------

def cmd_grids(args):
    mod = Module(args[0])
    out = []
    for b in mod.root.iter('VASSAL.build.module.map.boardPicker.Board'):
        rec = {'name': b.get('name'), 'image': b.get('image')}
        for z in b.iter('VASSAL.build.module.map.boardPicker.board.mapgrid.Zone'):
            if z.get('name') == 'Combat Zone':
                rec['combat_zone_path'] = z.get('path')
                for g in z:
                    rec['hexgrid'] = dict(g.attrib)
                    for n in g:
                        rec['numbering'] = dict(n.attrib)
        if 'hexgrid' in rec:
            out.append(rec)
    print(json.dumps(out, indent=1))


# ----------------------------------------------------------------------------
# Hex geometry for the 3300x2600 CC:E map images in this module
# ----------------------------------------------------------------------------
DX, DY, X0, Y0 = 146.15829323957013, 168.8, 79.0, 28.0
COLS = 'ABCDEFGHIJKLMNO'


def label_to_grid(label):
    """'F6' -> terrain-file (col,row). Columns A..O = grid col 3..17.
    Odd grid columns (A,C,E..) use row = n+1, even (B,D,..) use row = n+2."""
    col = COLS.index(label[0].upper()) + 3
    n = int(label[1:])
    row = n + 1 if col % 2 == 1 else n + 2
    return col, row


def grid_to_label(col, row):
    n = row - 1 if col % 2 == 1 else row - 2
    if not (3 <= col <= 17):
        return None
    return '%s%d' % (COLS[col - 3], n)


def grid_center(col, row):
    x = X0 + col * DX
    y = Y0 + row * DY + (DY / 2 if col % 2 == 1 else 0)
    return x, y


def pixel_to_label(x, y):
    best = None
    for c in range(3, 18):
        for r in range(1, 14):
            cx, cy = grid_center(c, r)
            d = (cx - x) ** 2 + (cy - y) ** 2
            if best is None or d < best[0]:
                best = (d, c, r)
    d, c, r = best
    lab = grid_to_label(c, r)
    if lab is None or d > (DX * 0.62) ** 2:
        return None
    n = int(lab[1:])
    if not 1 <= n <= 10:
        return None
    return lab


def cmd_hex(args):
    for lab in args:
        c, r = label_to_grid(lab)
        x, y = grid_center(c, r)
        print(json.dumps({'label': lab, 'grid': [c, r], 'center_px': [round(x, 1), round(y, 1)]}))


# ----------------------------------------------------------------------------
# Terrain files (terrainMaps/Board N.txt)
# ----------------------------------------------------------------------------

def cmd_terrain(args):
    hexes, edges, attrs = {}, [], []
    for line in open(args[0], encoding='latin-1'):
        f = line.strip().split(',')
        if not f or not f[0]:
            continue
        if f[0] == 'h':
            hexes[grid_to_label(int(f[1]), int(f[2]))] = f[3]
        elif f[0] == 'e':
            edges.append({'hexes': sorted([grid_to_label(int(f[1]), int(f[2])),
                                           grid_to_label(int(f[3]), int(f[4]))]), 'terrain': f[5]})
        elif f[0] == 'a':
            attrs.append({'hex': grid_to_label(int(f[1]), int(f[2])), 'terrain': f[3],
                          'flag': f[4] if len(f) > 4 else None})
    print(json.dumps({'hexes': hexes, 'edges': edges, 'attributes': attrs}, indent=1))


# ----------------------------------------------------------------------------
# Saved games
# ----------------------------------------------------------------------------

def cmd_decode_save(args):
    z = zipfile.ZipFile(args[0])
    raw = z.read('savedGame').decode('latin-1')
    if not raw.startswith('!VCSK'):
        raise SystemExit('not an obfuscated VASSAL save')
    key = int(raw[5:7], 16)
    body = raw[7:]
    out = bytes(int(body[i:i + 2], 16) ^ key for i in range(0, len(body) - 1, 2))
    open(args[1], 'wb').write(out)
    print('decoded %d bytes (key 0x%02x)' % (len(out), key))


def iter_save_pieces(path):
    text = open(path, encoding='latin-1').read()
    for c in text.split('\x1b'):
        if c.startswith('+/'):
            try:
                traits = parse_piece(c)
            except Exception:
                continue
            yield traits
        else:
            yield c


def piece_summary(traits):
    st = basic_state(traits)
    props = {}
    layers = {}
    for t, s in traits:
        k = trait_kind(t)
        if k == 'PROP':
            props[se_decode(t, ';')[1]] = s
        elif k == 'emb2':
            imgs = emb_images(t)
            lvl = se_decode(s, ';')[0] if s else ''
            try:
                lv = int(lvl)
            except ValueError:
                lv = None
            name = emb_name(t) or (imgs[0] if imgs else '')
            active = imgs[lv - 1] if lv and 0 < lv <= len(imgs) else None
            key, i = name, 2
            while key in layers:
                key = '%s#%d' % (name, i)
                i += 1
            layers[key] = {'level': lv, 'active': active}
    rec = {'name': basic_name(traits), **st, 'props': props, 'layers': layers}
    if rec['map'] == 'MainMap' and rec['x'] is not None:
        rec['hex'] = pixel_to_label(rec['x'], rec['y'])
    return rec


def cmd_save_pieces(args):
    want = None
    if '--map' in args:
        want = args[args.index('--map') + 1]
    rows = []
    for item in iter_save_pieces(args[0]):
        if isinstance(item, str):
            continue
        p = piece_summary(item)
        if want and p['map'] != want:
            continue
        if p['map'] == 'MainMap' and p['x'] is not None:
            p['hex'] = pixel_to_label(p['x'], p['y'])
        rows.append(p)
    print(json.dumps(rows, indent=1))


# ----------------------------------------------------------------------------
# Scenario summary from a decoded predefined-setup save
# ----------------------------------------------------------------------------
NATION_BY_BASE = {'Ger': 'German', 'Sov': 'Russian', 'US': 'American', 'Brit': 'British',
                  'French': 'French', 'Italy': 'Italian'}
POSTURE = {'0': None, '1': 'Defender', '2': 'Recon', '3': 'Attacker', '4': 'Invader', '5': 'Scenario Rule'}
UNIT_FIELDS = {'FirepowerValue': 'firepower', 'RangeValue': 'range', 'MoveValue': 'movement',
               'MoraleValue': 'morale', 'CommandValue': 'command'}


def _nation_of(p):
    for name, lay in p['layers'].items():
        a = lay.get('active') or ''
        m = re.match(r'Base (\w+?) (?:Wpn |Ord )?Front\.png', a)
        if m:
            return NATION_BY_BASE.get(m.group(1), m.group(1))
    for name, lay in p['layers'].items():
        a = lay.get('active') or ''
        m = re.match(r'Vet (\w+)\.png', a)
        if m:
            return NATION_BY_BASE.get(m.group(1), m.group(1))
    return None


def _broken(p):
    for name, lay in p['layers'].items():
        a = lay.get('active') or ''
        if re.match(r'Base \w+ Back\.png', a):
            return True
    return False


def cmd_scenario(args):
    mod_path, save_path = args[0], args[1]
    gprops, board = {}, None
    pieces = []
    for item in iter_save_pieces(save_path):
        if isinstance(item, str):
            if item.startswith('MainMapBoardPicker'):
                board = item.split('\t')[1]
            elif item.startswith('GlobalProperty\t'):
                f = item.split('\t', 1)[1].split(';')
                if len(f) >= 3:
                    gprops[f[1]] = f[2]
            continue
        pieces.append(piece_summary(item))
    out = {'board': board, 'module_globals': {k: gprops.get(k) for k in (
        'AxisPlayerSide', 'AlliedPlayerSide', 'Axis Orders', 'Allied Orders', 'AxisTQ', 'AlliedTQ',
        'AxisDrawLimit', 'AlliedDrawLimit', 'TimeMark', 'AxisElimMultiplier', 'AlliedElimMultiplier',
        'AxisExitMultiplier', 'AlliedExitMultiplier', 'NoAxisExit', 'NoAlliedExit', 'Nightime',
        'AxisRadio', 'AlliedRadio', 'AxisDefender', 'AlliedDefender', 'PreReg', 'MineCount',
        'WireCount', 'WinterCamo', 'LimitedSmoke', 'UseAxisDeck', 'UseAlliedDeck')}}
    stage, mainmap_units, markers = [], [], []
    for p in pieces:
        n, mp = p['name'], p['map']
        if not n:
            continue
        if mp == 'MainMap':
            if n == 'Turn Marker':
                out['time_marker_start'] = int(p['props'].get('TurnValue', 0))
            elif n == 'Sudden Death Marker':
                out['sudden_death_space'] = int(p['props'].get('SuddenDeathValue', 0))
            elif n == 'VP Marker':
                v = int(p['props'].get('VPValue', 61)) - 61
                out['vp_marker_start'] = {'raw_VPValue': p['props'].get('VPValue'),
                                          'side_ahead': 'Allied' if v > 0 else 'Axis' if v < 0 else None,
                                          'vp': abs(v)}
            elif n == 'Calender Year':
                for lay in p['layers'].values():
                    m = re.search(r'calender year (\d\d)\.png', lay.get('active') or '')
                    if m:
                        out['year'] = 1900 + int(m.group(1))
            elif n in ('AxisInitiative', 'AlliedInitiative'):
                for lay in p['layers'].values():
                    if (lay.get('active') or '').startswith('InitiativeButton'):
                        out['initiative_card'] = 'Axis' if n.startswith('Axis') else 'Allied'
            elif n in ('German OB', 'Soviet OB', 'US OB', 'British OB', 'French OB', 'Italian OB'):
                side = 'Axis' if n.split()[0] in ('German', 'Italian') else 'Allied'
                zone = 'Elite' if p['x'] < 166 else 'Line' if p['x'] < 276 else 'Green'
                out.setdefault('ob_markers', {})[side] = {
                    'marker': n, 'posture': POSTURE.get(p['props'].get('OOB')),
                    'troop_quality_column': zone, 'orders_row': round((p['y'] - 120) / 110) + 1}
            elif n.startswith('VPO '):
                out.setdefault('objectives_on_map', []).append({
                    'objective': int(n.split()[1]), 'hex': p.get('hex'), 'px': [p['x'], p['y']],
                    'ControlBy': p['props'].get('ControlBy')})
            elif n == 'Random Objective':
                zone = ('Axis' if p['x'] < 1161 else 'Open' if p['x'] < 1930 else 'Allied') \
                    if p['y'] > 2340 else 'elsewhere'
                out.setdefault('random_objective_reminders', []).append(zone)
            elif re.match(r'Objective [A-X]$', n) and not (p['x'] == 250 and p['y'] == 2437):
                x, y = p['x'], p['y']
                zone = ('off-map (set aside)' if x > 3300 else
                        ('Axis' if x < 1161 else 'Open' if x < 1930 else 'Allied') if 2340 <= y <= 2530
                        else 'elsewhere')
                out.setdefault('objective_chits_placed', []).append({'chit': n[-1], 'zone': zone, 'px': [x, y]})
            elif any(k in p['props'] for k in UNIT_FIELDS) or n in (
                    'Foxholes', 'Trench', 'Bunker', 'Pillbox', 'Wire', 'Minefield', 'Blaze') \
                    or n.startswith(('Minefield', 'SSR')):
                rec = {'name': n, 'hex': p.get('hex'), 'px': [p['x'], p['y']], 'nation': _nation_of(p)}
                if 85 <= p['y'] <= 240 and 680 <= p['x'] <= 2455:
                    # parked on the Time Track = reinforcement entering at that time space
                    rec['time_track_space'] = round((p['x'] - 759) / 125.0)
                    out.setdefault('reinforcements_on_time_track', []).append(rec)
                else:
                    mainmap_units.append(rec)
        elif mp == 'Casualties':
            if n == 'Axis Surrender Chit':
                out['surrender_level_axis'] = int(p['props'].get('AxisSurrenderValue', 0))
            elif n == 'Allied Surrender Chit':
                out['surrender_level_allied'] = int(p['props'].get('AlliedSurrenderValue', 0))
        elif mp == 'Stage Map':
            if n == 'OOB Base':
                continue
            rec = {'name': n, 'nation': _nation_of(p), 'stage_side': 'Axis' if p['x'] < 550 else 'Allied',
                   'px': [p['x'], p['y']]}
            vals = {UNIT_FIELDS[k]: int(v) for k, v in p['props'].items()
                    if k in UNIT_FIELDS and v.lstrip('-').isdigit()}
            if vals:
                rec['values'] = vals
            if _broken(p):
                rec['broken'] = True
            vet = [l['active'] for l in p['layers'].values() if (l.get('active') or '').startswith('Vet ')]
            if vet:
                rec['veteran'] = True
            stage.append(rec)
        elif mp and mp.endswith('Hand') and n == 'Initiative':
            out['initiative_card_holder_hand'] = p['props'].get('ToPlayer')
    out['stage_units'] = stage
    out['mainmap_units_and_fortifications'] = mainmap_units
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    cmds = {'cards': cmd_cards, 'fate-cards': cmd_fate_cards, 'counters': cmd_counters, 'grids': cmd_grids,
            'decode-save': cmd_decode_save, 'save-pieces': cmd_save_pieces,
            'terrain': cmd_terrain, 'hex': cmd_hex, 'scenario': cmd_scenario}
    if len(sys.argv) < 3 or sys.argv[1] not in cmds:
        print(__doc__)
        sys.exit(1)
    cmds[sys.argv[1]](sys.argv[2:])
