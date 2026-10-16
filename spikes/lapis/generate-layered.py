# Synthetic containers, not illustrator samples; PSD is deliberately flattened.
from PIL import Image
from pathlib import Path
import struct,zipfile,io,json
root=Path('/private/tmp/workspace-lapis-fixtures')
im=Image.open(root/'SYNTHETIC-5MB-4000x5000-alpha.png').convert('RGBA')
im.save(root/'SYNTHETIC-flattened.tiff',compression='raw')
w,h=im.size
with open(root/'SYNTHETIC-flattened.psd','wb') as f:
 f.write(b'8BPS'+struct.pack('>H',1)+bytes(6)+struct.pack('>HIIHH',4,h,w,8,3)+bytes(12)+bytes(2))
 for band in im.split():f.write(band.tobytes())
preview=io.BytesIO();im.thumbnail((512,640));im.save(preview,format='PNG')
with zipfile.ZipFile(root/'SYNTHETIC-container.kra','w') as z:
 z.writestr('mimetype','application/x-krita',compress_type=zipfile.ZIP_STORED)
 z.writestr('maindoc.xml','<?xml version="1.0"?><DOC><IMAGE name="Synthetic fixture"/></DOC>',compress_type=zipfile.ZIP_DEFLATED)
 z.writestr('mergedimage.png',preview.getvalue(),compress_type=zipfile.ZIP_STORED)
 # Large inert layer payload tests bounded access, not Krita layer compatibility.
 z.writestr('layers/SYNTHETIC-NOT-A-KRITA-LAYER.bin',bytes(16*1024*1024),compress_type=zipfile.ZIP_STORED)
print(json.dumps({'synthetic':True,'files':[{'name':p.name,'bytes':p.stat().st_size} for p in root.glob('SYNTHETIC-*') if p.suffix in ['.psd','.tiff','.kra']]}))
