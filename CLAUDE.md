# Fog Line — notes for Claude

- The game is static files in `public/`. No bundler, no npm deps. Scripts are classic (non-module) and share globals; load order in `index.html` matters.
- Rendering: world renders to a low-res target, characters (layer 1) render at 2x on top with depth, mist/halos/fire (layer 2) last. New character-like objects go on layer 1 via `onCharLayer`, atmosphere via `onFxLayer`.
- Script order: core, map, nav, world, actors, atmosphere, audio, weapons, loot, build, squad, days, anim, settings, game. `G` is defined in game.js, so earlier files only touch it inside functions. Per-soldier parts hook in with `forEachSoldier` so recruits get them too.
- `docs/design.md` is the source of truth for design decisions. Check it before adding or changing systems.
- Miguel plays on PC. Mobile performance is not a priority.
- When Miguel makes an observation about the game, ask before changing anything.
- Test headless before pushing: serve `public/` and load it in Playwright; there must be no page errors.
- Saves: `serialize()`/`applySave()` in days.js. Anything new that persists across a run needs adding to both.
