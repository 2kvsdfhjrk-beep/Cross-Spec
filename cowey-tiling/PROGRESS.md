# Cowey Tiling website: saved progress

Live preview: https://claude.ai/artifact/Vba2dQSzQoRJGY6D5w2kNv

## What is here
- `site/` is the finished website, ready to upload to any static host (see `site/README.txt`).
- `renders/` holds the eight master renders (landscape `_L`, phone `_P`) plus the doorway and light positions used by the zoom transitions.
- `render/` holds everything that made them: the Blender scene scripts, materials, photo finishing, page template and build script.

## Status
- All eight renders finished. Lighthouse scores 100 for performance, accessibility, best practices and SEO on mobile and desktop.
- Still needed: phone number, email, towns covered, a real form inbox, a Google Business Profile, and eventually photos of real jobs.
- Design idea to try next session: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

## Rebuild or change it
1. `python3.11 -m venv bl && ./bl/bin/pip install bpy==5.0.1 pillow numpy`
2. Render a shot: `./bl/bin/python render/house.py garden 2400 1350 192 out/final/garden.png` (cameras: garden, kitchen, bath and the `_p` phone versions; `render/commercial.py commercial ...` for the restaurant). Each takes 10 to 40 minutes on four CPU cores.
3. `./bl/bin/python render/finalize.py` grades and encodes the images and rebuilds `site/`.
