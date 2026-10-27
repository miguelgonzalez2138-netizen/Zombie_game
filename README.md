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
- `public/js/loot.js` — item types, grid inventories, containers and loot tables, supplies, the inventory screen
- `public/js/build.js` — build mode, traps and the MG nest, boarding and fence cutting, the workshop
- `public/js/squad.js` — recruits, wounds, XP and perks, relationships, fatigue, orders and the wheel, scavenging runs, squad cards and screen
- `public/js/days.js` — the clock, weather, kinds of night, day events, radio, night talks, dawn planning, score board, saving
- `public/js/comfy.js` — quiet vs event nights, the safe block, off-duty squad, sitting and sleeping, dinner, night jobs, shop upgrades
- `public/js/anim.js` — ragdoll deaths, knockdowns, grabs, feeding, soldier idles, melee arcs, cloth, bodies
- `public/js/settings.js` — settings, key rebinding, sound captions, dev menu (backquote)
- `public/js/game.js` — game state, AI, input, HUD, main loop
- `docs/design.md` — every design decision so far
