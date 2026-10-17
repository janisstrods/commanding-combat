import json, sys, os, collections
# build_scenarios.py <dir with 001.json..012.json> <out.json>
src, out = sys.argv[1], sys.argv[2]
NAMES = {1: 'Fat Lipki', 2: 'Hedgerows and Hand Grenades', 3: 'Bonfire of the NKVD', 4: 'Closed for Renovation',
         5: 'Cold Front', 6: 'Paralyzed from the West Down', 7: 'Bessarabian Nights', 8: 'Breakout Dance',
         9: 'Rush to Contact', 10: 'Commando School', 11: 'Hold the Line', 12: 'Misty Mountain'}
NAT = {'German': 'German', 'Soviet': 'Russian', 'US': 'American'}
CTRL = {'1': None, '2': 'German', '3': 'Russian', '4': 'American'}
FORTS = ('Wire', 'Foxholes', 'Trench', 'Bunker', 'Pillbox', 'Minefield', 'Immobilized Sherman')
res = {'_source': 'VASSAL module CombatCommanderEurope-2.6.4.vmod predefined setups "001 - Fat Lipki.vsav" .. '
                  '"012 - Misty Mountain.vsav" (decoded with design/tools/vassal_extract.py scenario).',
       '_notes': [
           'Units are NOT on hexes in the module setups: they sit on the off-board Stage Map; players place them '
           'in their set-up areas, which are NOT in the module (scenario cards needed).',
           'time_marker_start / sudden_death_space are Time Track spaces (0..12).',
           'vp_marker_start: side_ahead + vp as placed on the VP track (VPValue-61; negative=Axis).',
           'objectives_on_map: hex of the module\'s VPO markers sitting on the numbered objective circles printed on '
           'the map; initial_control from the marker state (None = uncontrolled).',
           'objective_chits: chits placed face-up in the Open/Axis/Allied boxes; random_objective_reminders mark '
           'boxes where a chit is to be drawn at random; "set aside" chits were parked off-map by the module author '
           '(probably removed from the random pool - verify).',
           'hand_size = module AxisDrawLimit/AlliedDrawLimit, derived from posture (Defender 4, Recon 5, Attacker 6).',
           'Not in the module: set-up zones, special scenario rules text, which map edge each side uses/exits, '
           'scenario card exit VP, exact reinforcement entry rules.'],
       'scenarios': []}
for i in range(1, 13):
    d = json.load(open(os.path.join(src, '%03d.json' % i)))
    g = d['module_globals']
    sides = {}
    for side, natkey, orders, draw, tq, surr in (
            ('Axis', 'AxisPlayerSide', 'Axis Orders', 'AxisDrawLimit', 'AxisTQ', 'surrender_level_axis'),
            ('Allied', 'AlliedPlayerSide', 'Allied Orders', 'AlliedDrawLimit', 'AlliedTQ', 'surrender_level_allied')):
        ob = (d.get('ob_markers') or {}).get(side, {})
        units = collections.Counter()
        forts = collections.Counter()
        odd = []
        for u in d['stage_units']:
            if u['stage_side'] != side:
                continue
            if u['name'] in FORTS or u['name'].startswith('Minefield'):
                forts[u['name']] += 1
            else:
                units[u['name']] += 1
                if u['nation'] and u['nation'] != NAT[g[natkey]]:
                    odd.append('%s (%s counter in %s staging area)' % (u['name'], u['nation'], side))
        reinf = collections.defaultdict(collections.Counter)
        for r in d.get('reinforcements_on_time_track', []):
            if r['nation'] == NAT[g[natkey]]:
                reinf[r['time_track_space']][r['name']] += 1
        sides[side] = {
            'nation': NAT[g[natkey]], 'posture': ob.get('posture'),
            'troop_quality': g[tq], 'orders_per_turn': int(g[orders]), 'hand_size': int(g[draw]),
            'surrender_level': d.get(surr),
            'units_in_staging_area': dict(sorted(units.items())),
            'fortifications_in_staging_area': dict(sorted(forts.items())),
            'reinforcements_by_time_space': {str(k): dict(v) for k, v in sorted(reinf.items())},
        }
        if odd:
            sides[side]['oddities'] = odd
    chits = d.get('objective_chits_placed') or []
    rec = {
        'number': i, 'name': NAMES[i], 'module_file': '%03d - %s.vsav' % (i, NAMES[i]),
        'map': d['board'].replace('Board ', ''), 'year': d.get('year'),
        'axis': sides['Axis'], 'allied': sides['Allied'],
        'initiative_card_starts_with': d.get('initiative_card'),
        'time_marker_start': d.get('time_marker_start'), 'sudden_death_space': d.get('sudden_death_space'),
        'vp_marker_start': {'side_ahead': d['vp_marker_start']['side_ahead'], 'vp': d['vp_marker_start']['vp']},
        'objectives_on_map': sorted([{'objective': o['objective'], 'hex': o['hex'],
                                      'initial_control': CTRL.get(o['ControlBy'], o['ControlBy'])}
                                     for o in d.get('objectives_on_map', [])], key=lambda o: o['objective']),
        'objective_chits': {
            'open_fixed': sorted(c['chit'] for c in chits if c['zone'] == 'Open'),
            'axis_fixed': sorted(c['chit'] for c in chits if c['zone'] == 'Axis'),
            'allied_fixed': sorted(c['chit'] for c in chits if c['zone'] == 'Allied'),
            'set_aside': sorted(c['chit'] for c in chits if c['zone'].startswith('off-map')),
            'random_objective_reminders': d.get('random_objective_reminders') or []},
        'pre_placed_on_map': [{'name': m['name'], 'hex': m['hex']} for m in d['mainmap_units_and_fortifications']],
        'module_globals_nondefault': {k: v for k, v in g.items() if k in (
            'AxisElimMultiplier', 'AlliedElimMultiplier', 'AxisExitMultiplier', 'AlliedExitMultiplier',
            'NoAxisExit', 'NoAlliedExit', 'Nightime', 'AxisRadio', 'AlliedRadio', 'AxisDefender',
            'AlliedDefender', 'PreReg', 'MineCount', 'WireCount', 'WinterCamo', 'LimitedSmoke')
            and v not in ('1', 'false', '0', None)},
    }
    res['scenarios'].append(rec)
json.dump(res, open(out, 'w'), indent=1)
print('ok', len(res['scenarios']))
