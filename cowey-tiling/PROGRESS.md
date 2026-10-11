# Cowey Tiling website: saved progress

Live site: https://2kvsdfhjrk-beep.github.io/Cross-Spec/cowey-tiling/ (served from the `cowey-tiling/` folder on `main`)

## What is here
- `site/` is the finished website, ready to upload to any static host (see `site/README.txt`).
- `render/` holds everything that made it: the Blender scene scripts, the drone camera paths, photo finishing, page template and build script.
- `out/fly/manifest.json` describes the encoded flight (frame count and sizes) for the build script.

## How the page works
- The story is one continuous drone flight rendered in Blender Cycles: 150 frames through the house (garden, through the bifolds, kitchen, doorway, shower room), a dissolve, then 70 frames through a restaurant on the high street.
- Each frame is rendered square (1152 x 1152) and cut twice: 1152 x 648 for landscape screens and 648 x 1152 for phones.
- The first frame is an ordinary image so the page paints fast. The other frames download after the page has loaded and are drawn to a canvas as you scroll, blending between neighbouring frames so the motion never steps.
- Lighthouse: 100 for performance, accessibility, best practices and SEO on mobile and desktop.

## Still needed before launch
- Phone number, email, towns covered, a real form inbox, a Google Business Profile, and eventually photos of real jobs.

## Rebuild or change it
1. `python3.11 -m venv bl && ./bl/bin/pip install bpy==5.0.1 pillow numpy`
2. Change a camera path in `render/fly.py` (keys are frame, camera position, look-at point).
3. Render: `render/render_fly.sh` (about 77 s per house frame and 58 s per restaurant frame on four CPU cores, roughly 4.5 hours for the lot). Frames land in `out/fly/house` and `out/fly/street`.
4. `python3 render/frames.py` grades and encodes the frames into `site/f`, makes the poster and service photos in `site/img`, then `python3 render/build_site.py` rebuilds `site/index.html`.
