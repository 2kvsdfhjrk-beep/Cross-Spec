# Cowey Tiling website: saved progress

Live site: https://2kvsdfhjrk-beep.github.io/Cross-Spec/cowey-tiling/ (served from the `cowey-tiling/` folder on `main`)

## What is here
- `site/` is the finished website, ready to upload to any static host (see `site/README.txt`).
- `render/` holds everything that made it: the Blender scenes (`house.py`, `street.py`), the drone path and tile laying animation (`fly.py`), grading and video encoding (`frames.py`), page template and build script.
- `out/fly/manifest.json` describes the encoded flight for the build script.

## How the page works
- The story is one continuous drone shot rendered in Blender Cycles, 290 frames: the back garden while the patio slabs are laid, through the bifolds and the kitchen, down a hallway with a Victorian geometric floor, into a bathroom at the front of the house, out of its open window, across the street and into a coffee shop whose floor is laid as the drone flies in.
- Each frame is rendered square (1152 x 1152) and cut twice: 1152 x 648 for landscape screens and 648 x 1152 for phones.
- The flight is encoded as three short H.264 videos per cut (VP9 copies for browsers without H.264) and scrubbed by seeking as you scroll, which phones decode in hardware.
- The first frame is an ordinary image, so the page paints fast. The videos download after the page has loaded and start on the first scroll or touch.
- Lighthouse: 100 for performance, accessibility, best practices and SEO on mobile and desktop.

## Still needed before launch
- Phone number, email, towns covered, a real form inbox, a Google Business Profile, and eventually photos of real jobs.

## Rebuild or change it
1. `python3.11 -m venv bl && ./bl/bin/pip install bpy==5.0.1 pillow numpy`
2. Change the camera path in `render/fly.py` (KEYS: frame, camera position, look-at point) or the scenes.
3. Render: `./bl/bin/python render/fly.py 1152 16 out/fly/world all` (about 85 s a frame on four CPU cores, roughly 7 hours).
   To share the work across machines, run `render/render_part.sh K` with K = 0, 1, 2, 3 on four machines.
4. `python3 render/frames.py` grades the frames, encodes the videos into `site/v` and the poster and service photos into `site/img`,
   then `python3 render/build_site.py` rebuilds `site/index.html`.
