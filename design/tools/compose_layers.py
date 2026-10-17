import sys, os
from PIL import Image
# compose.py out.png imgdir layer1.png layer2.png ...  (all same size, stacked in order)
out, d = sys.argv[1], sys.argv[2]
base = None
for n in sys.argv[3:]:
    im = Image.open(os.path.join(d, n)).convert('RGBA')
    if base is None: base = Image.new('RGBA', im.size, (255,255,255,255))
    base.alpha_composite(im)
base.save(out)
