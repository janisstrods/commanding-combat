import json, sys
# pilot_map1.py <terr_1.json> <maps_base.json> <out maps.json>
t = json.load(open(sys.argv[1]))
base = json.load(open(sys.argv[2]))
hexes = {}
for lab, ter in sorted(t['hexes'].items(), key=lambda kv: ('ABCDEFGHIJKLMNO'.index(kv[0][0]), int(kv[0][1:]))):
    rec = {'terrain': ter, 'elevation': 0, 'features': []}
    if ter == 'Road':
        rec['terrain'] = 'Open'; rec['features'] = ['Road']
    elif ter == 'Wood trail':
        rec['terrain'] = 'Woods'; rec['features'] = ['Trail']
    elif ter == 'Water':
        rec['terrain'] = 'Water Barrier'; rec['note'] = 'pond'
    hexes[lab] = rec
for lab, num in {'E8': 1, 'D3': 2, 'H8': 3, 'N5': 4, 'F6': 5}.items():
    hexes[lab]['objective'] = num
notes = {
    'D2': 'centre dot sits on the edge of the woods artwork (classified Woods as in module file)',
    'D3': 'centre dot on the road; woods artwork covers the NE third and a small woods blob the SW corner. '
          'If CC uses "any artwork in hex" rather than centre dot, this hex is Woods.',
    'H5': 'road passes just west of the centre dot; trail starts at the H5/I5 hexside',
    'N9': 'road crosses the east half of the hex (~45 px from centre dot)',
    'O9': 'road crosses the west half of the hex',
    'I2': 'small clearing next to the centre dot; rest of hex woods',
    'F7': 'road Y-junction; spurs end at the F6 and E8 building hexsides',
    'E1': 'woods; top half of this high-column hex is cut by the map edge? no - full hex, woods',
}
for k, v in notes.items():
    if k in hexes and k != 'E1':
        hexes[k]['note'] = (hexes[k].get('note', '') + ' ' + v).strip()
        hexes[k]['confidence'] = 'medium'
fences = [sorted(e['hexes']) for e in t['edges']]
roads = [['A2', 'B2'], ['B2', 'C3'], ['C3', 'D3'], ['D3', 'E4'], ['E4', 'F4'], ['F4', 'G5'], ['G5', 'H5'],
         ['H5', 'H6'], ['H6', 'H7'], ['H7', 'I8'], ['I8', 'J8'], ['J8', 'K9'], ['K9', 'L9'], ['L9', 'M10'],
         ['M10', 'N10'], ['H7', 'G8'], ['G8', 'G9'], ['G9', 'G10'], ['F6', 'F7'], ['E8', 'F7'], ['F7', 'G8'],
         ['O1', 'O2'], ['O2', 'O3'], ['O3', 'O4'], ['O4', 'O5'], ['O5', 'O6'], ['O6', 'O7'], ['O7', 'O8'],
         ['O8', 'O9'], ['N9', 'O9'], ['N9', 'N10']]
road_exits = [{'hex': 'A2', 'side': 6, 'edge': 'left'}, {'hex': 'O1', 'side': 1, 'edge': 'top'},
              {'hex': 'G10', 'side': 4, 'edge': 'bottom'}, {'hex': 'N10', 'side': 4, 'edge': 'bottom',
               'note': 'road from O column, leaves near the S/SW corner'},
              {'hex': 'N10', 'side': 3, 'edge': 'bottom-right', 'note': 'diagonal road'}]
trails = [['H5', 'I5'], ['I5', 'J5'], ['J5', 'K5'], ['K5', 'L4']]
pilot = {
    'status': 'pilot transcription, verified hex-by-hex against images/Map1.png (VASSAL art) on 2026-10-17',
    'method': 'module terrainMaps/Board 1.txt converted to hex labels, then every hex and hexside checked on '
              '3-column overlay sheets (crop_hex.py --sheet) and zoomed crops; roads/trails traced as hexside '
              'crossings; objectives from the scenario-1 VPO markers and visually confirmed.',
    'classification_rule_used': 'terrain at the hex centre dot (matches the module file); hexes where other '
                                'terrain artwork is present are flagged with confidence=medium and a note',
    'effort': '~25 minutes for 150 hexes once tooling existed (Map 1 is flat and simple; hill/town maps will '
              'take longer)',
    'agreement_with_module_file': '150/150 hex terrain types and 21/21 fence hexsides agreed with the module '
                                  'file; the file lacks road/trail connectivity, objectives and elevation',
    'hexes': hexes,
    'hexsides': [{'between': f, 'feature': 'Fence'} for f in fences],
    'road_crossings': [{'between': sorted(r), 'feature': 'Road'} for r in roads],
    'road_map_edge_exits': road_exits,
    'trail_crossings': [{'between': sorted(r), 'feature': 'Trail',
                         **({'note': 'trail ends at this hexside'} if r == ['K5', 'L4'] else {}),
                         **({'note': 'trail starts at this hexside'} if r == ['H5', 'I5'] else {})} for r in trails],
    'elevation': 'Map 1 has no hills: every hex level 0',
}
for m in base['maps']:
    if m['map'] == '1':
        m['terrain_pilot'] = pilot
json.dump(base, open(sys.argv[3], 'w'), indent=1)
from collections import Counter
print(Counter(h['terrain'] for h in hexes.values()), len(fences), len(roads))
