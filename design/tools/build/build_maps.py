import json, sys, os, re
from PIL import Image
# build_maps.py <buildFile.xml> <extracted dir> <work dir with terr_*.json> <scenarios.json> <out maps.json>
bf, ex, work, scen_path, out = sys.argv[1:6]
import xml.etree.ElementTree as ET
root = ET.parse(bf).getroot()
scen = json.load(open(scen_path))['scenarios']
used = {}
for s in scen:
    used.setdefault(s['map'], []).append(s['number'])
obj_by_map = {}
for s in scen:
    obj_by_map[s['map']] = [{'objective': o['objective'], 'hex': o['hex']} for o in s['objectives_on_map']]
terr_files = {f[len('Board '):-4]: f for f in os.listdir(os.path.join(ex, 'terrainMaps'))}
boards = []
for b in root.iter('VASSAL.build.module.map.boardPicker.Board'):
    grid = None
    for z in b.iter('VASSAL.build.module.map.boardPicker.board.mapgrid.Zone'):
        if z.get('name') == 'Combat Zone':
            g = list(z)[0]
            grid = {'class': g.tag, **{k: g.get(k) for k in ('dx', 'dy', 'x0', 'y0', 'sideways')}}
            num = list(g)[0]
            grid['numbering'] = {k: num.get(k) for k in ('first', 'hType', 'hOff', 'vType', 'vOff', 'stagger', 'sep')}
            grid['combat_zone_path'] = z.get('path')
    if not grid:
        continue
    name = b.get('name').replace('Board ', '').split(' ')[0]
    img = os.path.join(ex, 'images', b.get('image'))
    im = Image.open(img)
    key = {'5w': '5W'}.get(name, name)
    tf = terr_files.get(key)
    draft = None
    if tf:
        t = json.load(open(os.path.join(work, 'terr_%s.json' % key)))
        from collections import Counter
        draft = {'module_file': 'terrainMaps/' + tf, 'hex_count': len(t['hexes']),
                 'hex_terrain_counts': dict(Counter(t['hexes'].values())),
                 'hexside_counts': dict(Counter(e['terrain'] for e in t['edges']))}
    rec = {'map': name, 'module_board_name': b.get('name'),
           'image': 'scratchpad/vassal/extracted/images/' + b.get('image'),
           'image_px': list(im.size),
           'used_by_scenarios': used.get(name, []),
           'printed_objectives': obj_by_map.get(name) or obj_by_map.get({'5': '5w'}.get(name, ''), None),
           'module_terrain_draft': draft}
    if name == '5':
        rec['note'] = 'Summer version; scenario 5 uses the winter variant 5w (same terrain file content).'
    if name == '5w':
        rec['note'] = 'Winter (snow) art variant of map 5; module terrain file "Board 5W.txt" identical to Board 5.'
    if name == '7-104':
        rec['note'] = 'Alternate art of map 7 for a non-base scenario (#104); terrain file identical to Board 7.'
    if name == '12h':
        rec['note'] = 'Map 12 variant "for Scenario 44" (not base game); terrain differs only in hexsides (no cliffs).'
    boards.append(rec)
res = {
    '_source': 'VASSAL module CombatCommanderEurope-2.6.4.vmod: buildFile.xml boards/grids, images/Map*.png, '
               'terrainMaps/Board *.txt, objective hexes from the VPO markers of the 12 predefined setups.',
    'grid': {
        'applies_to': 'all 15 map boards (images 3300x2600 px)',
        'module_grid': 'terrain.TerrainHexGrid dx=146.15829323957013 dy=168.8 x0=79 y0=28 sideways=false '
                       '(VASSAL HexGridNumbering first=H hType=A hOff=-3 vType=N vOff=-2 stagger=true)',
        'hex_shape': 'flat-topped (vertical columns), circumradius 97.46 px, width 194.9 px, height 168.8 px',
        'columns': 'A..O (15), left to right', 'rows': '1..10 per column, top to bottom (150 hexes)',
        'label': 'column letter + row number, e.g. F6 (as printed in each hex on the map)',
        'column_offset': 'A,C,E,G,I,K,M,O are the high columns; B,D,F,H,J,L,N sit half a hex lower',
        'center_px_formula': {'x': '79 + (k+3)*146.15829  (k=0 for A .. 14 for O)',
                              'y_even_k': '28 + (n+1)*168.8 + 84.4', 'y_odd_k': '28 + (n+2)*168.8'},
        'examples_px': {'A1': [517.5, 450.2], 'B1': [663.6, 534.4], 'H5': [1540.0, 1209.0], 'O10': [2563.7, 1969.2]},
        'combat_zone_px': [417, 361, 2666, 2142],
        'terrain_file_coords': 'terrainMaps "h,col,row,..." use grid col = k+3 and row = n+1 (even k) / n+2 (odd k)',
        'neighbours': {
            'side_numbering': '1=N, 2=NE, 3=SE, 4=S, 5=SW, 6=NW (same 1..6 compass as printed on the map / Breeze event)',
            'even_k (A,C,..,O)': {'1': [0, -1], '2': [1, -1], '3': [1, 0], '4': [0, 1], '5': [-1, 0], '6': [-1, -1]},
            'odd_k (B,D,..,N)': {'1': [0, -1], '2': [1, 0], '3': [1, 1], '4': [0, 1], '5': [-1, 1], '6': [-1, 0]},
            'note': '[dk, dn] offsets in (column index, row number)'},
        'board_edges': {
            'top': 'row-1 hexes; A1,C1,..,O1 touch the edge with sides 6,1,2; B1,D1,..,N1 with side 1 only '
                   '(zig-zag edge, no half hexes)',
            'bottom': 'row-10 hexes; B10..N10 (low columns) touch with sides 5,4,3; A10,C10,..,O10 with side 4',
            'left': 'column A (sides 5,6)', 'right': 'column O (sides 2,3)'},
    },
    'terrain_vocabulary_module_files': ['Open', 'Woods', 'Brush', 'Orchard', 'Field', 'Building', 'Water', 'Stream',
                                        'Marsh', 'Gully', 'Road', 'Wood trail', 'Railway track', 'Woods Railway track',
                                        'Hill', 'Hill Woods', 'Hill Building', 'Hill Brush', 'Hill Field',
                                        'Hill Orchard', 'Rubble', 'hexsides: Fence, Hedge, Wall, Cliff'],
    'maps': boards,
}
json.dump(res, open(out, 'w'), indent=1)
print('ok', [b['map'] for b in boards])
