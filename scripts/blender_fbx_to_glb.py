# Run from your repo root, this writes all .glb files to src/assets/ships/glb/:
# /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender_fbx_to_glb.py

import bpy, os, sys, glob

ROOT = os.path.abspath("src/assets/ships/raw")
OUT  = os.path.abspath("src/assets/ships/glb")
os.makedirs(OUT, exist_ok=True)

def process(ship):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fbx = os.path.join(ROOT, ship, f"{ship}.fbx")
    tex = os.path.join(ROOT, ship, "textures")
    glb = os.path.join(OUT, f"{ship}.glb")

    if not os.path.isfile(fbx):
        print(f"[skip] {ship}: missing {fbx}")
        return

    print(f"[import] {fbx}")
    bpy.ops.import_scene.fbx(filepath=fbx)

    if os.path.isdir(tex):
        try:
            bpy.ops.file.find_missing_files(directory=tex)
            print(f"[textures] searched in {tex}")
        except Exception as e:
            print(f"[warn] find_missing_files: {e}")

    print(f"[export] {glb}")
    bpy.ops.export_scene.gltf(
        filepath=glb,
        export_format='GLB',
        export_apply=True,  # apply modifiers/transforms
        export_materials='EXPORT'
    )

ships = ["visby","k130","saar6","lcs-freedom","lcs-independence"]
for s in ships:
    process(s)
print("[done]")
