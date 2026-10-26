# Fog Line — design decisions

Collected from Miguel's answers. Where a pillar was skipped, it is Claude's call.

## Premise

- Abandoned squad of basic grunts (Second Squad: Cpl. Reyes, Pvt. Dunn, PFC Kowalski, Pvt. Hale) left holding Wolcott & 18th.
- One fortified building (Ferreteria Morales) plus the street line out front. Comfy nights inside, horde roams the fog outside.
- Look: low-res 3D upscaled with hard pixels, near-top-down perspective camera, characters at 2x resolution.

## Graphics

1. World pixels: Keep
2. Character sharpness: 2x (keep)
3. Night brightness: Keep
4. Palette: Cooler / blue
5. Color pops: Let them pop
6. Film grain: No
7. Lens effects: No
8. Vignette: Keep
9. Default zoom: Keep
10. Look-ahead: No
11. Screen shake: My shots, Nearby hits
12. Camera tilt: More tilt
13. Horde zoom: No
14. Rolling fog: Yes
15. Ground mist: Thick knee-high mist
16. Fog color: Warm (keep)
17. Light halos: Yes
18. Fog-edge zombies: Dark silhouettes
19. Flashlight beams: Visible cones in the air
20. Muzzle flash: Bigger and brighter
21. Moon shadows: Harder and longer
22. Extra lights: Flickering streetlamp, Burning car, Flares on the ground
23. Throwables: No (as a lighting item)
24. Day light: Weak sun with real shadows
25. Dawn: Yes
26. Weather: Ash / snow (keep)
27. Wet streets: Yes
28. Night particles: Yes
29. Squad variety: Radio pack, Different helmets / a cap, Bandages
30. Wear: Yes
31. Wounded: Yes
32. Name tags: Yes
33. Your highlight: Ring is enough
34. Gore: Gorier
35. Body types: Heavy, Tall and thin
36. Clothes: Cops, Soldiers, Hospital gowns, Construction vests
37. Eyes: Pure darkness
38. Deaths: Ragdoll falls, Dismemberment
39. Blood spray: Heavy
40. Bullet impacts: Sparks, Dust puffs, Chips flying
41. Shell casings: Yes
42. Barricade damage: Yes
43. Smoke: Yes
44. Trails: Yes
45. Clutter: Cars everywhere, Trash bags, Crashed bus, Checkpoint gear
46. Signage: Storefronts, Faded ads, Street signs, Graffiti, Survivor messages
47. Shop interior: Yes
48. Army leftovers: Yes
49. HUD amount: Fine
50. HUD style: Military stencil / olive drab

## Gameplay

1. Run length: Endless nights
2. Day phase: Scavenging runs
3. Scavenging: Both (player goes out, and can send buddies)
4. Night variety: Different events (sieges, storms, specials)
5. Win condition: Endless, chase a score
6. Permadeath: Soldiers can die or be wounded
7. Aiming: Mouse twin-stick (keep)
8. Fire mode: Toggle semi / full auto
9. Recoil: Keep
10. Headshots: Random but bigger reward
11. Penetration: Yes
12. Friendly fire: No
13. Reloads: Shared ammo pool (keep)
14. Weapon range: Wide (MG, sniper, scavenged civilian guns)
15. Melee: Melee weapons (bat, axe, bayonet)
16. Throwables: Grenades, Molotovs, Noise decoys
17. Defenses: Spike strips, Traps, Mounted MG
18. Jams: No
19. Suppressors: Yes
20. Noise detail: More detail (footsteps, running, doors)
21. Noise display: HUD meter only (keep)
22. Senses: Sound + sight (keep)
23. Light visibility: Keep
24. Stealth kills: Yes
25. Hiding: Yes (go dark inside and wait them out)
26. Speed: All shamblers
27. Specials: None
28. Climbing: Only break through (keep)
29. Scaling: Horde growth based on noise you made
30. Infection: Just damage (keep)
31. Break-ins: Yes (zombies break into buildings / windows)
32. Corpses: Just decoration (keep)
33. Squad size: Recruit survivors (up to 6–8)
34. Control: Control one, swap (keep)
35. Orders: Hold a specific spot, Watch a sector, Heal someone, Scavenge
36. Morale: Keep
37. Injuries: Specific wounds (leg slows, arm hurts aim)
38. Leveling: Yes
39. Relationships: Yes
40. Base: Fortify the whole block
41. Resources: Ammo, Food, Water, Generator fuel
42. Crafting: Yes
43. Power: Free (keep) — fuel is for cooking and workshop tools
44. Barricade placement: Fixed spots (keep) — see Agency: free placement for base layout
45. Fatigue: Yes
46. Difficulty: One tuned difficulty
47. Pausing: Yes
48. Saving: Save anytime
49. Map: Fixed map, random events
50. Meta-progression: No

## Game feel
1. Move speed: (no pick) — keep but add sprint
2. Move weight: Slight momentum (keep)
3. Sprint: Yes
4. Sneak: Yes
5. Dodge: Yes
6. Vault: Yes
7. Hit feedback: Knockback
8. Kill feedback: Nothing extra
9. Camera kick: Keep
10. Gun identity: Very different from each other
11. Reload feel: Animated and interruptible
12. Shove: Keep
13. Getting hit: Camera jolt
14. Low health: Desaturated screen, Muffled audio
15. Doors: Walk into them, Kick open (loud)
16. Aim line: Laser / aim line
18. Camera follow: Keep

## World
1. Area size: A whole neighborhood
2. Enterable: Most buildings — most but only some will have usefull stuff
3. Floors: Multiple floors with stairs
4. Rooftops: (no pick) — reachable for some
5. Underground: None
6. World change: Stays the same
7. Destruction: Windows, Doors, Walls
8. Landmarks: Church, Gas station, Clinic, Police station, School, Supermarket, L station, Park
9. Setting: Lean into Pilsen, Chicago
10. Loot spots: Random each run
11. Interior clutter: Dense and cluttered
12. Shaping the map: Block alleys, Push cars into streets, Board windows, Cut fences
13. Night routes: Some routes become too dangerous
14. Secrets: Yes
15. Vehicles: Scenery only
16. Weather terrain: Yes

## Progression
1. Score: Nights survived, Kills, Supplies stockpiled
2. XP source: Both
3. Level-ups: Pick a perk
4. Roles: Grow from what they do
5. Level cap: Medium (10)
6. Getting guns: Both
7. Weapon mods: Scopes, Extended mags, Suppressors, Grips / stocks
8. Scarcity: Comfortable
9. Trading: No
10. Food & water: Simplified pool
11. Hunger cost: Health loss
12. Fuel use: Cooking, Workshop tools
13. Materials: Generic scrap
14. Craft time: Daytime hours
15. Upgrades: Expensive milestones
16. Recruit gear: It varies
17. Recruit skill: Random stats
18. Veterans: Should hurt a lot

## Challenge
1. Difficulty: Hard but fair
2. Saves vs score: Save anytime, my call
3. Squad wipe: Run over, score kept on a board
4. Losing the line: Usually recoverable
5. Collapse: Either
6. Ammo pressure: Medium
7. Noise sensitivity: Only big noise counts
8. Zombie toughness: Keep
9. Zombie damage: Keep
10. Buddy skill: Better
11. Catch-up: No
12. Spikes: Occasional brutal nights
13. Bad luck: No
14. Grace: Straight in
15. Other failures: None
16. Tutorial: Tooltips only

## AI
1. Autonomy: In between
2. Ammo sense: Yes
3. Cover: Yes
4. Auto actions: Reload, Heal themselves, Repair
5. Callouts: Some
6. Personality: Lightly
7. Disobey: Yes
8. Herds: Mixed
9. Memory: Short
10. Light pull: Only spot you better when lit (keep)
11. Chain reaction: Keep
12. Idle zombies: Wander, Stand still, Bang on doors, Gather at old noises
13. Other people: Neutral survivors, Traders
14. Animals: Keep pigeons and rats
16. Weather AI: Rain masks noise, Wind carries sound, Snow muffles
17. Day threats: Yes

## Story
1. Amount: Light, mostly environmental
2. Delivery: Radio, The environment
3. Abandonment: Never answered
4. Evac: Rare evac event you can take
5. Squad bios: Light
6. Recruit bios: No bios
7. Dialogue tone: Some gallows humor
8. Night talks: Yes
9. Personal quests: No
10. Choices: None
11. Factions: Organized civilians, Raiders
12. Faith: Not a theme
13. Era: Present day
14. Outbreak: Hinted at
15. Run end: Epilogue from your stats
16. Logbook: No
17. Memorial: No

## Animation
1. Style: Exaggerated
2. Soldier anims: Sprint, Crouch, Vault, Detailed reloads, Idle fidgets, Eating and smoking at night
3. Zombie anims: Grab and wrestle, Stumble and fall, Get back up, Feeding on bodies
4. Downed: Dies outright (keep)
5. Grabs: Yes
6. Gun detail: Detailed (bolt, mag swaps)
7. Melee anims: Big visible arcs
8. Interactions: Yes
9. Fatigue anims: Yes
10. Deaths: Real ragdoll physics
11. Cloth: Yes
12. Vignettes: Yes

## Audio
1. Music: Ambient drones
2. Music style: Dark ambient
3. Gun sound: Punchy and loud
4. Per-gun sound: Yes
5. Voices: Text barks
6. Zombie sound: More variety
7. Positional: Precise, a gameplay tool
8. Ambience: Keep
9. Radio voice: Static plus on-screen text
10. Spanish: No
11. Silence: Ambience keeps going
12. Footsteps: Change with surface
13. Stress audio: Yes
14. UI sound: Minimal

## UI
1. Main menu: Simple
2. Orders input: Radial wheel
3. Inventory: Grid (Tarkov style)
4. Map screen: Full map of the area
5. Minimap: Yes
6. Damage numbers: No
7. Enemy bars: No
8. Squad display: Portraits down the side
9. Alerts: Banners (keep)
10. Planning: Dedicated screen
11. Tooltips: No
12. Kills shown: No
13. Clock: Countdown (keep)
14. Score shown: End screen only
15. Controller: No

## Atmosphere
1. Tone: Action-horror
2. Horror: Tense, not scary
3. Humor: Dark humor
4. Comfy nights: Some
5. Hope: Hopeful undercurrent
6. Isolation: Signs of others nearby
7. Season: Late fall into winter
8. Day mood: Pretty, in a sad way
9. Gore tone: Over the top
10. Military flavor: Light
11. Neighborhood: Light
12. Touchstones: Project Zomboid, Darkwood, Children of Men

## Pacing
1. Day length: Longer
2. Night length: Longer
3. Downtime: Keep
4. Skip day: Keep it
5. Night curve: Unpredictable
6. Session: Long hauls
7. Speed control: Yes
8. Event rate: Every few nights
9. Quiet nights: Yes
10. Run length: Long
11. Back by dusk: Flexible

## Agency
1. Playstyles: Ghost (never fire a shot), Loud fortress, Lone scavenger, Squad commander
2. Customize: Loadouts
3. Name recruits: No
4. Base layout: Free placement
5. Pick buildings: Yes
6. The dead: No
7. Leader: Yes
8. Start setup: Always Second Squad
9. Your paint: No
10. Helping others: Yes
11. Relocate: Yes

## Replay
1. Start variety: Random supplies
2. Event pool: Small and polished
3. Seeds: No
4. High scores: No
5. Summary: Detailed stats
6. Milestones: No
7. Mutators: No
8. Start spot: Always the shop
9. Recruit pool: Big random pool

## Tech
1. Framerate: Don't care
2. Settings: Yes
3. Pixel size: Yes
4. Horde cap: More (500+)
5. Corpses: Fade over days
6. Save storage: Both
7. Hosting: Move to GitHub + Cloudflare now
8. Loading: Fine
9. Fullscreen: Yes
10. Dev menu: Yes
11. Auto quality: No

## Accessibility
1. Rebinding: Yes
2. Subtitles: Yes
3. Colorblind: No
4. Shake toggle: Yes
5. Text size: Yes
6. Hold/toggle: Toggle options
7. Flashing: No
8. Gore toggle: No
9. Sound cues: Yes