# Exact byte-boundary cases are SYNTHETIC and padded, not illustrator exports.
from PIL import Image,TiffImagePlugin
from pathlib import Path
import struct,zlib,json
root=Path('/private/tmp/workspace-lapis-phase2-fixtures');root.mkdir(exist_ok=True)
source=Path('/private/tmp/workspace-lapis-fixtures/SYNTHETIC-5MB-4000x5000-alpha.png')
im=Image.open(source)
exif=Image.Exif();exif[0x013b]='SYNTHETIC Workspace test';exif[0x0112]=1
R=TiffImagePlugin.IFDRational
exif[0x8825]={1:'N',2:(R(0),R(0),R(0)),3:'E',4:(R(0),R(0),R(0))}
base=root/'SYNTHETIC-GPS-base.png';im.save(base,exif=exif)
raw=base.read_bytes();assert Image.open(base).getexif().get_ifd(0x8825)
rows=[]
for target in [19000000,20000000,20000001,20971520,20971521]:
 padding=bytes(target-len(raw)-12);kind=b'lpAD';chunk=struct.pack('>I',len(padding))+kind+padding+struct.pack('>I',zlib.crc32(kind+padding)&0xffffffff)
 name=f'SYNTHETIC-GPS-{target}-bytes.png';data=raw[:-12]+chunk+raw[-12:];assert len(data)==target
 (root/name).write_bytes(data)
 rows.append({'file':name,'bytes':target,'synthetic':True,'paddingChunk':True,'width':4000,'height':5000,'exifPresent':True,'gpsPresent':bool(Image.open(root/name).getexif().get_ifd(0x8825))})
(root/'manifest.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
