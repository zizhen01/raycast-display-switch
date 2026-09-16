# Display Switch

Raycast extension that flips an external display between **extended** and **mirrored** in one keystroke. No BetterDisplay, no displayplacer, no System Settings: it talks to CoreGraphics directly through Raycast's Swift bridge.

## Commands

| Command | Mode | What it does |
|---|---|---|
| **Toggle Mirror** | no-view | Flip between mirrored and extended. Bind it to a global hotkey. |
| **Mirror Displays** | no-view | Every display copies the one chosen in *Mirror Optimized For*. No-op if already mirrored. |
| **Extend Displays** | no-view | Stop mirroring, then put the menu bar back on the preferred main display. No-op if already extended. |
| **Swap Main Display** | no-view | Move the menu bar to the other display without touching mirroring. |
| **Manage Displays** | view | Lists every display with mode and resolution. Actions: mirror to a display, stop mirroring, set as main. |
| **Display Status** | menu-bar | Icon shows mirrored vs extended; menu has the two states with a check mark plus Swap Main. |

Every command reports the resulting state in a HUD, e.g. `Mirroring · optimized for Mi Monitor` or `Extended · Mi Monitor is main`.

## Preferences

- **Mirror Optimized For** – External display (default), Built-in display, or whichever is main now. Decides which display the others copy and therefore the resolution used while mirrored. *Built-in* reproduces macOS's ⌘F1 behaviour.
- **Main Display When Extended** – External display (default), Built-in display, or leave as macOS restores. Fixes the menu bar landing on the wrong display after sleep or replugging.
- **Feedback** – show the HUD.
- **Audio** (off by default) – Swap Main Display also routes sound to that display's speakers, or back to the built-in speakers.
- **Brightness** (off by default) – Mirror Displays dims the built-in display, Extend Displays restores it. Handy when watching the big screen.
- **Auto-Extend** (off by default) – Display Status checks about once a minute and undoes mirroring this extension did not set up, e.g. when macOS mirrors by itself after sleep. Mirroring you set through ⌘F1 or System Settings gets undone too, so leave it off if you use those.

Scenarios and the reasoning behind this model are in [docs/DESIGN.md](docs/DESIGN.md).

## How it works

`swift/Sources/DisplaySwitch` exports a handful of `@raycast` functions:

- `listDisplays()` – `CGGetOnlineDisplayList` + `CGDisplayIsInMirrorSet` / `CGDisplayMirrorsDisplay`, names from `NSScreen.localizedName` with an IOKit fallback.
- `mirrorAll(source)` / `unmirrorAll()` and the per-display `setMirror(target, source)` / `unmirror(target)` – one `CGBeginDisplayConfiguration` → `CGConfigureDisplayMirrorOfDisplay` → `CGCompleteDisplayConfiguration(.permanently)` transaction, cancelled on any error.
- `setMainDisplay(id)` – `CGConfigureDisplayOrigin(id, 0, 0)`.
- `listAudioOutputs()` / `setDefaultAudioOutput(id)` – CoreAudio default output device.
- `getBrightness(display)` / `setBrightness(display, value)` – DisplayServices loaded with `dlopen` at runtime; unsupported displays return -1 and are skipped.

Displays are identified by vendor, model and serial number, never by the UUIDs macOS reshuffles on wake.

## Development

```bash
npm install
npm run dev      # ray develop – hot reload inside Raycast
npm run build
npm run lint
```

Requires Xcode 16.3+ (Swift 6) for the Swift package. Design notes and pitfalls are in [docs/DESIGN.md](docs/DESIGN.md).
