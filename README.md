# Fog Line

Top-down zombie hold-out. An abandoned squad of grunts holds Wolcott & 18th in Pilsen, Chicago, while the horde drifts past in the fog every night.

Plain HTML, CSS and JavaScript on three.js r128 (vendored). No build step: `public/` is the whole game.

## Run locally

```
cd public && python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Cloudflare Workers Builds runs `npx wrangler deploy` on every push to `main`. `wrangler.jsonc` points the static assets at `public/`.

## Layout

- `public/index.html` — markup and script load order
- `public/css/style.css` — HUD and menus
- `public/js/core.js` — helpers, renderer, fog shader, textures, materials
- `public/js/map.js` — the neighborhood: streets, lots, buildings, floors, rooms, doors and windows
- `public/js/nav.js` — collision, stairs, line of sight, bullet rays, flow-field pathing
- `public/js/world.js` — renders the map; props, signs, barricade, lights
- `public/js/actors.js` — squad and zombie models, gore, combat effects
- `public/js/atmosphere.js` — mist, halos, fire, smoke, wildlife, walkable space
- `public/js/audio.js` — synthesized ambience and sound effects
- `public/js/weapons.js` — weapon roster, shared ammo, firing, reloads, melee, throwables, explosions, fire, pickups
- `public/js/game.js` — game state, AI, input, HUD, main loop
- `docs/design.md` — every design decision so far
