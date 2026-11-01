
`4.3.1`

- Shop: deleting an item from a vendor works again. The confirmation dialog now calls DialogV2 through its class instead of a detached function, which threw before the delete ran.
- Shop: regenerating with Keep existing inventory off now opens the replace prompt and replaces the stock. With it on, existing items keep their stored prices and rolls, and generated duplicates are skipped instead of being added a second time.
- Shop: item actions keep working after searching or re-sorting the vendor inventory.

`4.3.0`

- REspec roster: player-assigned characters are listed automatically, and any other character sheet can be added from the Characters panel. Added sheets persist in a world setting, can be removed from their roster chip, and appear in cards, Pull chat, awards, Apply all, End session, and `getCharacters`.
- Opening Crawl: the pan to the planet can begin before the text finishes. The new Pan lead setting (default 10 seconds, limited to half the crawl) overlaps the reveal with the last lines; 0 keeps the old pan-after-text timing.
- Opening Crawl: pan distance is measured from the planet, which lands about 56% up the viewport. Crawls without an image use a readable fallback distance. Closing time stays on the old total, so music and endings are not shortened.
- Opening Crawl: the wordmark uses one text stroke instead of 121 stacked shadows, scales with the window under a viewport-height cap, zooms from a size that does not clip, and limits uploaded logo dimensions. A logo can be overridden per crawl type, with the global logo as fallback.
- Opening Crawl: episode and title use the film-title face. The episode keeps mixed case, the title is uppercase at 175% instead of 210%, and the body uses the real News Cycle Bold face. The crawl column is wider (21em, capped at 82vw) so long episode lines fit and justified lines do not stretch.
- Opening Crawl: SWCrawlTitle maps a capital S to the STAR WARS logo and a capital L to the "A long time ago..." line. Episode, title, and the Criminal Empire wordmark use the normal lowercase glyphs, so SESSION, TOTALLY, and LEGAL no longer print artwork inside the crawl. Digit runs are tightened because the font's "1" is very wide.
- Opening Crawl: new Criminal Empire - Crimson Dawn type with the classic opening line, a gold-on-black wordmark with a crimson keyline, a darker red vignette, and rising embers. Empire and Clone Wars remain available.
- Opening Crawl: Clone Wars gains drifting blue dust, holographic scanlines, a blue vignette, and occasional hyperspace streaks. Each layer has a switch plus intensity, speed, and density settings. Particles and streaks respect `prefers-reduced-motion`; the crawl still plays.
- Opening Crawl: the Clone Wars wordmark uses StarJedi logo lettering in blue. StarJedi's O reads as an N, so the zero glyph is used for O: CLONE renders as CLONE.
- Opening Crawl: finished intro, wordmark, and crawl stages are removed from the document, and the crawl text stays hidden until its delay, so earlier stages cannot paint over later ones.
- Opening Crawl: the window opens at the client viewport size instead of 4096x2160 and no longer promotes the whole animation subtree with `will-change`, avoiding stale first-paint textures after a resize.
- Opening Crawl: the wordmark's fly-away is capped to finish when the crawl starts, so STAR WARS no longer sits over the first lines.
- Opening Crawl: music no longer blocks the crawl. Remote tracks stream through a plain audio element buffered during the intro; local files still use Foundry's audio system.
- Opening Crawl settings are grouped into General, Presentation, Timing, and Atmosphere effects. File-picker buttons open the correct picker for their field, and clearing a checkbox saves.
- The crawl type creator uses radio cards with a description and colour chip instead of a dropdown.

`4.2.0`

- REspec follows the system's Mandar theme. It detects `mandar.css` or `mandar-dark.css` and switches the tracker, sheet panel, award and career dialogs, settings, confirms, and chat cards between the parchment and charcoal palettes.
- Colours and shapes come from the system sheets: parchment and `bgWindow.jpg` in light, `#0f0f0f` in dark, deep-maroon headers, `#415064`/`#2a3a4a` section bars, `#7da9c2` focus rings, Roboto body text, Elektra display names, and notched corners.
- The character-sheet panel uses the same parchment or charcoal surface and maroon rule as the surrounding sheet, in both themes.
- The compact card dashboard stays, with the system's flat button, input, threshold, and pip styling.
- Fixed the tracker hero collapsing inside the scrolling column, which clipped the title and roll controls.
- Scoped Mandar's global window button and input rules so the tracker's controls stay consistent in both themes.
- Party skill audit uses the same light and dark stylesheets: maroon or charcoal header, parchment or charcoal roster card, steel-blue notched section bars and tabs, themed character marks, and an optional breakdown table.
- Shop generator and vendor sheets use searchable, sortable Mandar-themed item cards with inline stock editing, tag filters, layout controls, and a confirmation before replacing stock.

`4.1.0`

- REspec Tracker shows who has which Pull die. The summary strip lists each player character's Boost/Setback result and whether it is ready or used; character cards show Conflict, Tranquility, Presence, and threshold state.
- Pull flow: one d100 for the table, a manual override, a new-encounter refresh, per-character Mark spent/Reset die, and a chat card listing every character's die. Rolling the Pull posts the summary automatically.
- Character cards are compact dashboards: a clickable ten-point Presence track, Conflict/Tranquility steppers with d10 helpers, Fear buttons, a threshold preview with one Apply/Remove action, and a collapsible conflict-talent list. Cards start collapsed when more than two player characters are present.
- End session previews which way each character will move before applying it. Unified Conflict Roll is disabled with an explanation while Force Presence resolves sessions.
- Award tables have a character picker, current totals, ranged/amount controls, a Murder row, and re-render after each award. Career powers have a filter and a single scrollable reference view.
- REspec settings are grouped in an ApplicationV2 panel with a master switch, dependent settings disabled until their prerequisite is on, an open-tracker button, and a threshold-effect cleanup action.
- The character-sheet panel is injected after Morality/Conflict on the Obligation tab, guarded against duplicate injection, and styled as a compact dark inset with Presence pips, session totals, and the Pull die.
- `styles/respec.css` is registered in the manifest and loaded dynamically for running worlds with an old cached manifest. The `wizard.html` dialog was removed in favour of inline controls.
- Macro API: `game.modules.get("ffg-star-wars-enhancements").api.respec` exposes `open`, `settings`, `rollPull`, `newEncounter`, `endSession`, and `getCharacters`.

`4.0.0`

- Foundry VTT 14 is now required (verified 14.368). The 13-compatible line stays on `main`.
- Status Icon Counters 3: talent-checker and stimpack-sync statuses are toggled on the actor and counted through the effect counter.
- Chat hooks moved to `renderChatMessageHTML`; the strain reminder uses `CHAT_MESSAGE_STYLES`.
- The dice helper ignores rolls that are not FFG dice pools instead of throwing.
- Dice helper suggestion messages use `style` instead of the legacy numeric `type`, which Foundry 12+ rejects.
- Runs under any Star Wars FFG system id: the vendor sheet takes the system sheet from the registry, system helpers load by dynamic import, and settings, flags, paths, and CSS classes use the running id.
- Vendor sheet registers at ready and no longer submits actor stats, so closing it does not throw.
- Manifest: both system ids declared, misspelled compatibility keys fixed, and dependency versions raised. Module url, manifest, and download stay on this fork.
- Actor sheet dice pools stay in a row. Foundry 14's reset makes every image a block, which stacked the skill dice.
- Opening Crawl: creating a crawl chooses a type. Empire keeps the saga opening. Clone Wars uses a flatter gold crawl, a red vignette, and a CLONE WARS wordmark. Journals with no type still play as Empire.
- Opening Crawl: the text scroll runs the full journal, instead of fading out at a fixed distance. The window close timer follows the same speed-adjusted length as the animation. Journal parsing no longer uses jQuery, and the crawl picker uses the journal id.
- Opening Crawl: a playlist can be chosen in the Opening Crawl settings. It plays through Foundry's playlist sync, alongside or instead of the music file, and stops when the crawl closes unless that switch is turned off.
- Opening Crawl settings: choice fields render again on Foundry 13+ (the removed `select` helper was still used), and the music delay hint now says seconds.
- Special ammo works on Codex II weapon and gear sheets. A loaded special magazine is what the weapon spends, and the weapon's own ammo counter is left alone while that magazine is loaded.
- Attack animations accept a wildcard file path, and animation settings can be exported and imported.
- Talents on the Codex II sheet have an Associated Skills tab.
- Dice helper journal lookup uses the first journal of that name that actually has pages, repairs an empty journal, drops its cache when the journal changes, and only the GM creates the journal. Spending suggestions are sorted by how many results they require, and contextual suggestions are grouped. Initiative rolls and the helper's own messages are ignored, and journal text saved in the editor still parses.
- Shop availability checks roll one pool instead of both halves, rarity above 10 no longer wraps into an easier check, and generation stops when the compendium runs out of candidates.
- Combatant renaming falls back to neutral when the actor has no token, and talent pills still render when a talent has no description.
- REspec Optionals: a GM world setting, off until the table opts in. Granular switches add Force Presence, Pull of the Force, a unified Conflict roll, Fear recording, conflict-on-use, and a career-power lookup. New data stays on the module flag. Strain and wound thresholds are one effect that is removed when the setting is turned off.
- Unit tests for these paths run with `npm run test:unit` and do not need Foundry.
- Party skill audit: a GM window lists each player-assigned character sheet with a tickbox, and any other character sheet can be added from the roster picker. Star charts are tabbed by skill section for the ticked sheets. Dice pools use yellow and green die symbols, character cards show each sheet's best trained pools, and the breakdown table stays collapsed unless it is opened.

`3.0.0` - 2026-03-28
- Improvement: [Talent Reminders!](https://github.com/wrycu/StarWarsFFG-Enhancements/pull/232)
- Improvement: [special ammo feature](https://github.com/wrycu/StarWarsFFG-Enhancements/wiki/Special-Ammo)
- FIX: Dice helper now works with Foundry VTT v13 (thanks `DukeVenator`!)
- Improvement: Ukrainian localization provided
  - Updated `createChatMessage` hook signature to match v13 API
  - Fixed Collection handling to use `game.messages.get()` for retrieving ChatMessage documents
  - Added guards against missing rolls and improved error handling
  - Improved ChatMessage document handling to support both wrapper objects and direct document access
  - Enhanced message retrieval to work correctly with v13's Collection system
- FIX: Opening crawl now works with Foundry VTT v13 (thanks `DukeVenator`!)
  - Migrated to ApplicationV2
  - Updated audio preloading
- Fix Actors.registerSheet deprecation callout for FoundryVTT v13+ (thanks `DukeVenator`!)
- FIX: Opening crawl speed multiplier and toolbar improvements ([#212](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/212)) (thanks `DukeVenator`!)
  - Fixes
    - Added crawl text speed multiplier setting to fix long text display issues
    - Fixed toolbar opening crawl menu button not being clickable
  - Improvements
    - Speed multiplier (default 1.0) allows independent control of text movement speed
    - Higher values (e.g., 1.3) make text move faster, allowing longer text to fully display
    - Works with duration setting: effective movement = duration ÷ speed
    - Updated all crawl-related tooltips with better explanations of duration and speed relationship
    - Enhanced tooltips provide guidance for when to use speed vs duration for long text issues
- FIX: Various shop fixes & enhancements ([#196](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/196))
  - Fixes
    - Correct shop table width
    - Correct shop table height
    - Correct GM-only label of "buy item" to correctly show "delete item"
    - Dice helper now works with Foundry VTT v13 (updated hook signatures, Collection handling, guard against missing rolls)
  - Enhancements
    - Shops can now keep inventory when regenerating
    - Add label to regenerate inventory button
    - Show GM stock item price (MSRP)
    - Added GM functionality to show shop to players (they must have access to the actor)
    - Add the ability to require the presence or absense of item tags when generating shop inventory
    - Add minimum and maximum price limits
    - Dice helper now provides suggestions for all skills, not just combat skills
- Fix: Added TokenMagic as an optional dependency (it already was, but was not declared)

`2.1.2` - 2025-06-15

-  FIX: Default compendiums for the shop cannot be found ([#213](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/213))
-  FIX: Update Spanish translation (thanks `@mcalduch`!)

`2.1.1` - 2024-06-15

-   IMPROVEMENT: Various title card improvements ([#203](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/203)) (thanks `KamiliaBlow!`)
    -   Font color can now be configured
    -   Text zoom amount and speed can now be configured
    -   You can now use 2 lines of text for the logo, instead of an image
-   FIX: Status Icons now work again ([#200](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/200))
-   FIX: Attack animations by items should stop being wacky when adding/removing entries ([#206](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/206))

`2.1.0` - 2024-05-26

-   COMPATABILITY: Module updated to work with FoundryVTT v12
-   NEW FEATURE: You can specify compendiums from which shops will auto-build inventories
-   NEW FEATURE: Attack animations can now be specified by item name
    -   For example, you can set custom animations for `*disrupter*` to change the behavior of all disruptor weapons on any actor
-   FIX: Correct Bounty CSS datapad breaking after editing
-   FIX: Attack animations are now properly aligned when the system is set to any language other than English

`2.0.6` - 2024-04-06

-   NEW FEATURE: Configurable Book of Boba Fett-style title cards can be played like the opening crawl (thanks `grafeisen`!)
-   IMPROVEMENT: Opening crawl timing can be configured in the settings (thanks `grafeisen`!
-   FIX: Module settings popup windows titles corrected
-   NEW FEATURE: Attack animations now take into account if the attack hit or not. Have fun watching blaster bolts go
    everywhere but your target!
-   NOTE: The generic slots feature now defaults to OFF as the system implements it natively (and better)

`2.0.5` - 2023-12-29

-   FIX: Minion group size should once again
    display ([#164](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/164))
-   IMPROVEMENT: Add large datapad (thanks `Spocky69`!)

`2.0.4` - 2023-10-09

-   Add Brazilian translation (thanks `neour#4842`!)
-   FIX: Correct Melee animation looking squished ([#102](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/102)) (
    thanks `tim-bersau` for reporting and `SourTarte` for providing a fix!)
-   IMPROVEMENT: Combat actors can now have custom images
    set ([#168](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/168))
-   FIX: Now verified against all v10 ([#171](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/171))

`2.0.3` - 2023-03-01

-   FIX: Break fix release build missing test files causing an
    error ([#162](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/162))

`2.0.2` - 2023-02-28

-   FIX: Fix for opening crawl improperly not including custom
    images ([#136](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/136))
-   FIX: Multiple fixes with attack animations not playing
    correctly ([#129](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/129), [#124](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/124))
-   NOTE: We have begun to add both integration and end-to-end tests. Hopefully, this leads to fewer regressions going
    forward.

`2.0.1` - 2023-02-12

-   FIX: Correct Dice Helper not working for Ranged
    Attacks ([#120](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/120))
-   FIX: Fix opening-crawl by removing wrapper p tag from template and parsing
    logic ([#136](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/136))

`2.0.0` - 2023-02-01

-   NEW FEATURE: stable Foundry v10 support
-   FIX: Alpha bug - Per-item attack animations now work again
-   REMOVED: Vehicle roller has been removed. Better support has been added in the system natively

`2.0.0alpha-1` - 2023-01-06

-   NEW FEATURE: alpha Foundry v10 support

`1.0.0` - 2022-06-05

-   IMPROVEMENT: Dice helper will now work with translations. English and French have been provided. (thanks for
    implementing it, `ercete#4836`!)
-   IMPROVEMENT: Minion quantity status icon refers now to 'actual' minion quantity instead of 'maximum' (thanks for
    implementing it, `ercete#4836`!)
-   Fixed double menu entry for 'Stimpack syncing status icon', the config menu as migrated in 'Talent Checker' submenu (
    thanks for implementing it, `ercete#4836`!)
-   New default status icons for Stimpacks, Minions and Minions at zero (thanks for implementing it, `ercete#4836`!)
-   Update French translation (thanks `ercete#4836`!)

`0.2.10` - 2022-04-25

-   Fix for scene buttons being removed ([#114](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/114))

`0.2.9` - 2022-04-24

-   NEW FEATURE: Convert tokens to Holograms! (thanks `Solos#0001` for the idea and code)
-   Fix for shop not including item attachments
-   Fix for vehicle roller failing under certain
    conditions ([#112](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/112))
-   Fix for dependencies requiring old versions ([#111](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/111))

`0.2.8` - 2022-02-13

-   NEW FEATURE: Add Stimpack tracking - auto-applies a status when healing items are used
-   IMPROVEMENT: Attack animation now allows specifying the number of times to play the animation on a per-item
    basis ([#103](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/103))
-   Fix for attack animations not working when crews are enabled (
    thanks `Szyna1988`!) ([#97](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/97))
-   Fix for module being available for non-SW worlds (
    thanks `esheyw`!) ([#99](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/99))
-   Fix for only one status being auto-applied when multiple are applicable (e.g. minion group + `Adversary` talent)

`0.2.7` - 2022-01-23

-   Fix for non-numeric rolls not working on Foundry v9

`0.2.6` - 2022-01-18

-   Partial fix for intro crawl ends before end of
    text ([#71](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/71))
-   Fix for foundry slowdown when included scenes are
    imported ([#92](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/92))
-   Fix for vehicle roller breaking on Foundry v9 (
    thanks `ProfessorKiz`!) ([#96](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/96))
-   Remove Mandar theme fix now that the theme has been updated

`0.2.5` - 2022-01-16

-   Bug fixes for Foundry v9 - see the [milestone](https://github.com/wrycu/StarWarsFFG-Enhancements/milestone/3?closed=1)
    for details

`0.2.4` - 2021-12-28

-   Fix for vehicle roller breaking empty roller (thanks `Dexcellence`!)

`0.2.3` - 2021-12-23

-   NEW FEATURE: Add ability to show minion group (max) size
-   NEW FEATURE: Add ability to use actor dice pool with vehicle weapon
    rolls ([#76](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/76))
-   NEW FEATURE: Hyperspace transitions! ([#12](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/12))
-   Fix for shop item finding pool being built incorrectly
-   Fix for non-working adversary status to apply
-   Fix for skills with special characters in the name (
    thanks `Theik`!) ([#80](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/80))
-   Fix for player being unable to spend dice results ([#81](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/81))
-   Improve attack animation: players no longer need to select their own token to play attack animations (if they only
    have one token on the canvas) ([#77](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/77))
-   Improve description of combat renamer in settings window

`0.2.2` - 2021-11-05

-   Fix for relative URLs (thanks `anthonyscorrea`!) ([#68](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/68))
-   Fix for actor renaming resetting on reload (thanks `@Bolts#9418`!)
-   Fix for inability to roll items added to sheets after enabling the
    module ([#72](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/72))
-   Fix for inability to select intro crawl music via
    GUI ([#73](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/73))

`0.2.1` - 2021-09-05

-   Fix for breaking `fxmaster` scene controls ([#60](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/60))
-   Fix for Intro Crawl audio delay not working ([#63](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/63))
-   Fix for dice result spender not working on non-item rolls... again (
    thanks `@Theik`!) ([#65](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/65))
-   Add triumph and despair in place of advantage and threat support for dice result spender (
    thanks `@Theik`!) ([#66](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/66))
-   Improve intro crawl text tilt ([#54](https://github.com/wrycu/StarWarsFFG-Enhancements/pull/54))
-   Add attack animation settings for grenades ([#46](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/46))

`0.2.0` - 2021-07-18

-   Support for Foundry `0.8.x` ([#52](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/52))
    -   All Foundry `0.9.x` warnings have been addressed; the move to that version should be faster
-   Shop improvements: shop settings are now
    remembered ([#56](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/56))
-   Allow players to use dice result spender ([#51](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/51))
-   Fix for dice result spender generating new buttons when scrolling through chat history

`0.1.11` - 2021-06-29

-   Fix for missing localizations ([#50](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/50))
    -   Thanks `@Belgarath` for translating to French and pointing out missing localizations
-   Fix for rolls of combat skills not from an item not working
    properly ([#48](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/48))
-   Add attack animation reset button ([#45](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/45))

`0.1.10` - 2021-05-30

-   Add count for Adversary status ([#40](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/40))
-   Intro crawl improvements ([#24](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/24))
    -   Add a setting for delay of music playback
    -   Add settings for moving the image left/right and up/down
    -   Add setting for font size
    -   Move settings into a sub-menu
-   Allow the removal of custom attack animations per
    item ([#39](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/39))
-   Fix for incomplete localization of dice spender (thanks `@prolice`!)
-   Add French localization (thanks `@prolice`!)
    -   Note that I don't speak French and this will require the community to be kept up-to-date
-   Fix for attack animation breaking rolling from skill (@thanks `@prolice!`)
-   Fix for default attack animations when jb2a_patreon is
    loaded ([#42](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/42))
-   Add support for non-combat dice result spending ([#25](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/25))

`0.1.9` - 2021-05-23

-   Fix for attack animation breaking rolling all dice except in my test instance :0

`0.1.8` - 2021-05-23

-   Added the ability to set attack animations per
    item ([#31](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/31))
-   Improve dependency management for JB2A Patreon
    module ([#27](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/27))
-   Fix for attack animations only working on English
    version ([#34](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/34))
-   Fix for dice helper only working on English
    version ([#34](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/34))
-   Fix for shop generator button not being localized ([#36](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/36))
-   Fix for `Mandar` theme mucking up actor sheet
    names ([#37](https://github.com/wrycu/StarWarsFFG-Enhancements/issues/37))

`0.1.7` - 2021-05-18

-   Initial alpha release
-   Planned features:
    -   Configurable, open source Hyperspace transition
