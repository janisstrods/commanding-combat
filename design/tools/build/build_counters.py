import json, sys, collections, re
# build_counters.py <counters_raw.json> <scenarios.json> <out>
raw = json.load(open(sys.argv[1]))
scen = json.load(open(sys.argv[2]))['scenarios']
NAT = {'German': 'German', 'Soviet': 'Russian', 'US': 'American'}
# max number of each counter needed by any one of the 12 base scenarios (staging + reinforcements)
need = collections.defaultdict(int)
for s in scen:
    for side in ('axis', 'allied'):
        sd = s[side]
        c = collections.Counter(sd['units_in_staging_area'])
        for t, units in sd['reinforcements_by_time_space'].items():
            c.update(units)
        nat = sd['nation']
        for name, n in c.items():
            nm = name
            if nm == 'Panzerfaust':
                nat2 = 'German'
            else:
                nat2 = nat
            need[(nat2, nm)] = max(need[(nat2, nm)], n)
RADIO_FP = {('German', '75'): 8, ('German', '81'): 9, ('German', '105'): 10, ('German', '120'): 11,
            ('German', '150'): 12, ('Russian', '76'): 8, ('Russian', '82'): 9, ('Russian', '122'): 11,
            ('Russian', '152'): 12, ('American', '75'): 8, ('American', '81'): 9, ('American', '105'): 10,
            ('American', '155'): 12, ('American', '203'): 13}
RADIO_NO_SMOKE = {('Russian', '152'), ('American', '203')}
ON_2006_CHARTS = {
    'German': {'Pionier Squad', 'SS Squad', 'Elite Rifle Squad', 'Fallschirmjager Squad', 'Rifle Squad',
               'Volksgrenadier Squad', 'Conscript Squad', 'Weapon Team', 'Elite Team', 'Line Team', 'LMG', 'HMG',
               'Light Mortar', 'Medium Mortar', 'IG 18 Gun', 'IG 33 Gun', 'Flamethrower', 'Satchel Charge',
               'Radio:75mm', 'Radio:81mm', 'Radio:105mm', 'Radio:120mm', 'Radio:150mm'},
    'Russian': {'Assault Squad', 'Guards SMG Squad', 'Guards Rifle Squad', 'SMG Squad', 'Rifle Squad',
                'Militia Squad', 'Weapon Team', 'Elite Team', 'Line Team', 'LMG', 'MMG', 'HMG', '.50 cal MG',
                'Light Mortar', 'Medium Mortar', 'Infantry Gun', 'Flamethrower', 'Satchel Charge', 'Radio:76mm',
                'Radio:82mm', 'Radio:122mm', 'Radio:152mm'},
    'American': {'Engineer Squad', 'Paratroop Squad', 'Elite Squad', 'Line Squad', 'Green Squad', 'Weapon Team',
                 'Elite Team', 'Line Team', 'Green Team', 'MMG', 'HMG', '.50 cal MG', 'Light Mortar',
                 'Medium Mortar', 'Pack Howitzer', 'Flamethrower', 'Satchel Charge', 'Radio:75mm', 'Radio:81mm',
                 'Radio:105mm', 'Radio:155mm', 'Radio:203mm'},
}
LEADERS_ON_2006_SUPPORT_TABLES = {
    'German': ['Cpt Wehling', 'Lt Borbe', 'Lt Huntziger', 'Lt Bolter', 'Sgt Benzing', 'Sgt Grein', 'Sgt Pfeiffer',
               'Cpl Schmidt', 'Cpl Guttman'],
    'Russian': ['Cpt Egorov', 'Lt Ostroumov', 'Lt Bijak', 'Sgt Pyotor', 'Sgt Rodimtsev', 'Sgt Kaminsky',
                'Cpl Anishchik', 'Cpl Kutikov', 'Cpl Denikin'],
    'American': ['Cpt Sitner', 'Lt Esparza', 'Lt Thomas', 'Sgt Bergstrom', 'Sgt Fuller', 'Sgt Elkheart',
                 'Sgt Goziak', 'Cpl Jensen', 'Cpl Twells']}
out = {
    '_source': 'VASSAL module CombatCommanderEurope-2.6.4.vmod buildFile.xml, Parts palette (PieceSlots) with '
               'prototypes expanded; front values = dynamic-property start values, broken values = start value '
               '+ the Ctrl-B (break) increment of each property; boxed values = "Box *" prototype; weapon '
               'portage/move penalty = "Wpn MP n" layer; repair/eliminate rolls = broken-side image name; radio '
               'artillery FP and SMOKE read from the radio counter images.',
    '_verification': 'Front values of every squad/team/weapon in the 2006 and 2025 GMT Order-of-Battle and '
                     'Support charts shipped in the module (images/CC * Order of Battle.jpg, * OOB Table.png, '
                     'CC * Support Table.jpg, RSG Leaders and Fortifications.png) were compared and agree, '
                     'including boxes and weapon penalties. Broken-side values are module-only (no broken-side '
                     'art in the module) - verify against physical counters before relying on them.',
    '_counter_mix': 'The module does NOT contain the counter mix (VASSAL palettes are unlimited). Leaders are '
                    'unique named counters (1 each). For everything else "count" is null; '
                    '"max_needed_in_base_scenarios" is the largest number used by any one of the 12 '
                    'scenarios (lower bound only).',
    'nations': {}, 'markers': {}, 'objective_chits': {}}
for mod_nat, nat in NAT.items():
    lists = raw[mod_nat]
    sect = {'leaders': [], 'squads': [], 'teams': [], 'weapons': []}
    for lw, items in lists.items():
        for c in items:
            name = c['name']
            rec = {'name': name}
            t = c['type_hint']
            if t == 'leader':
                hero = '(Hero)' in name
                rec['kind'] = 'hero' if hero else 'leader'
                rec['rank'] = None if hero else name.split()[0]
                rec['front'] = c['front']
                rec['broken'] = c.get('broken')
                rec['count'] = 1
                rec['on_2006_support_table'] = name in LEADERS_ON_2006_SUPPORT_TABLES[nat]
                if name.startswith('Pvt'):
                    rec['verify'] = 'Private with module values FP2 / command 2 looks odd - verify'
                if hero:
                    rec['verify'] = 'module eliminates (does not flip) a hero when it breaks; broken values unreliable'
                sect['leaders'].append(rec)
            elif t in ('squad', 'team'):
                rec['front'] = c['front']
                rec['broken'] = c.get('broken')
                rec['boxed'] = c.get('boxed', {'firepower': False, 'range': False, 'movement': False})
                rec['count'] = None
                rec['max_needed_in_base_scenarios'] = need.get((nat, name), 0)
                rec['on_2006_oob_or_support_chart'] = name in ON_2006_CHARTS[nat]
                sect['squads' if t == 'squad' else 'teams'].append(rec)
            else:
                rec['kind'] = 'radio' if name.startswith('Radio') else ('ordnance' if t == 'ordnance' else 'weapon')
                if rec['kind'] == 'radio':
                    cal = re.search(r'(\d+)mm', name).group(1)
                    rec['artillery_firepower'] = RADIO_FP.get((nat, cal))
                    rec['smoke_capable'] = (nat, cal) not in RADIO_NO_SMOKE
                    rec['broken_side'] = 'module image "Repair A-R X A-D" (radio broken side)'
                else:
                    rec['firepower'] = c['front'].get('firepower')
                    if 'range_band' in c:
                        rec['range'] = c['range_band']
                        rec['min_range'], rec['max_range'] = map(int, c['range_band'].split('-'))
                    else:
                        rec['range'] = c['front'].get('range')
                    rec['portage_or_move_penalty'] = c.get('portage_or_move_penalty')
                    rec['boxed'] = c.get('boxed', {'firepower': False, 'range': False, 'movement': False})
                    rec['smoke_capable'] = bool(c.get('smoke_capable'))
                    if 'broken_side' in c:
                        bs = c['broken_side']
                        rec['broken_side'] = {'repair_numbers': bs['repair_roll'], 'eliminate_numbers': bs['eliminate_roll']}
                rec['count'] = None
                rec['max_needed_in_base_scenarios'] = need.get((nat, name), 0)
                rec['on_2006_oob_or_support_chart'] = name in ON_2006_CHARTS[nat]
                if not rec['on_2006_oob_or_support_chart']:
                    rec['verify'] = 'not on the 2006 CC:E charts - probably from a later expansion' + (
                        ' (but used in base scenario 11)' if name == 'Panzerfaust' else '')
                sect['weapons'].append(rec)
    out['nations'][nat] = sect
out['markers'] = {
    'fortifications': [
        {'name': 'Foxholes', 'printed': '3 Cover*', 'cover': 3},
        {'name': 'Trench', 'printed': '4 Cover*', 'cover': 4},
        {'name': 'Pillbox', 'printed': '5 Cover*', 'cover': 5},
        {'name': 'Bunker', 'printed': '6 Cover*', 'cover': 6},
        {'name': 'Wire', 'printed': 'WIRE; variant art shows -1 / -1 / A', 'note': 'module has two wire images (Wire.png, Wire2.png)'},
        {'name': 'Minefield', 'variants_firepower': [6, 7, 8], 'printed': 'Minen! / 6FP / 7FP / 8FP'},
    ],
    'other': [
        {'name': 'Blaze', 'printed': 'BLAZE blocks LOS'},
        {'name': 'Smoke', 'note': 'module draw pile "Smoke Stack" of 50 chits valued -1..-10 (Smoke N.png) - '
                                  'count by value in the scenario-1 save: see vassal-survey.md'},
        {'name': 'Suppressed'}, {'name': 'Melee'}, {'name': 'Veteran'}, {'name': 'Starshell', 'note': 'not CC:E base'},
        {'name': 'Spotting Round markers', 'note': 'module helpers (Impact/Smoke/Pre-Registered/Starshells/Ordnance)'},
        {'name': 'Weather/visibility markers', 'note': 'Fog, Dusk, Night, Blizzard, Heavy Winds, Mist - module helpers'},
        {'name': 'Immobilized Sherman', 'note': 'used by base scenario 11'},
        {'name': 'Random Objective', 'note': 'module 2.6 reminder token only'},
    ],
    'time_track': {'spaces': list(range(0, 13)) + ['End'], 'markers': ['Time', 'Sudden Death']},
}
objs = {'A': (1, 1), 'B': (2, 1), 'C': (3, 1), 'D': (4, 1), 'E': (5, 1), 'F': (2, 2), 'G': (3, 2), 'H': (4, 2),
        'J': (5, 2), 'K': (3, 3), 'L': (4, 3), 'M': (5, 3), 'N': (4, 4), 'P': (5, 4), 'Q': (5, 5), 'R': (5, 10)}
for k, (o, v) in objs.items():
    out['objective_chits'][k] = {'objective': o, 'vp': v}
out['objective_chits'].update({'S': {'objective': 'each of 1-5', 'vp': 1}, 'T': {'objective': 'each of 1-5', 'vp': 2},
                               'U': {'objective': 'each of 1-5', 'vp': 3},
                               'V': {'objective': 'all', 'effect': 'Sudden Death win'},
                               'W': {'effect': 'exit points doubled'}, 'X': {'effect': 'elimination points doubled'}})
out['_objective_chits_source'] = 'images/OBJ-A.png .. OBJ-X.png (22 chits; no I or O)'
json.dump(out, open(sys.argv[3], 'w'), indent=1)
print({n: {k: len(v) for k, v in s.items()} for n, s in out['nations'].items()})
