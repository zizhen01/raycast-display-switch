# Design Notes

Why the extension is shaped the way it is, and what was learned while building it.

## Scenarios (MacBook + one external display)

| # | Situation | Wanted state | Pain without the extension |
|---|---|---|---|
| S1 | Everyday work | Extended, external display is main | — (default) |
| S2 | Showing the screen to someone, meeting room, screen recording | Mirrored | Three or four clicks in System Settings; ⌘F1 always makes the built-in display main |
| S3 | Video or games on the big screen, laptop as remote | Mirrored, optimized for the external display | Mirror direction and resolution are coupled; needs a second trip to settings |
| S4 | External display switched to another input (console, second computer) | Built-in display becomes main | Windows end up on an invisible screen |
| S5 | macOS enters mirroring by itself after sleep or replugging | Back to S1 | Two things to fix by hand |
| S6 | Presentation over | Back to S1 with arrangement and main display restored | Menu bar occasionally lands on the built-in display |

Three conclusions drove the design:

1. People think in **states** ("I want mirroring"), not in **actions** ("make B a mirror of A"). Commands are idempotent target states. Toggle exists only for the hotkey.
2. Mirroring has exactly one real variable: **which display to optimize for** (System Settings' own wording). It decides both the mirror source and the resolution. S2 and S3 differ only in this.
3. After returning to extended, **verify the main display**. macOS usually restores it, S5 and S6 show it does not always.

## Command semantics

```
Mirror Displays
  source  = display picked by "Mirror Optimized For"
  targets = every other online display
  already mirroring source → HUD "Already mirroring", stop
  one transaction: detach source if it is itself a mirror; attach each target to source

Extend Displays
  nothing mirrored and preferred main already main → HUD "Already extended", stop
  transaction 1: detach every mirror
  wait ~600 ms and re-read state (CGDisplayIsMain lags the transaction)
  transaction 2 (if needed): move preferred main display to origin (0,0)

Toggle Mirror      = anything mirrored ? Extend : Mirror
Swap Main Display  = refuse while mirrored; otherwise the other display gets origin (0,0)
```

With three or more displays: Mirror mirrors everything to the source, Extend detaches everything, and "External" resolves to the current main if it is external, otherwise the lowest-id external display. Per-display control lives in Manage Displays.

## How it talks to macOS

Only public CoreGraphics API, no private frameworks, no root, no Accessibility permission:

```
CGBeginDisplayConfiguration(&config)
CGConfigureDisplayMirrorOfDisplay(config, target, source)               // mirror
CGConfigureDisplayMirrorOfDisplay(config, target, kCGNullDirectDisplay) // extend
CGConfigureDisplayOrigin(config, id, 0, 0)                              // main display
CGCompleteDisplayConfiguration(config, .permanently)
```

State comes from `CGGetOnlineDisplayList`, `CGDisplayIsInMirrorSet`, `CGDisplayMirrorsDisplay`, `CGDisplayIsMain`, `CGDisplayIsBuiltin`. Names come from `NSScreen.localizedName` with an IOKit fallback (see below). The Swift code is compiled by `ray build` through [raycast/extensions-swift-tools](https://github.com/raycast/extensions-swift-tools) and called from TypeScript via `import ... from "swift:../../swift"`.

### Why not displayplacer

[displayplacer](https://github.com/jakehilborn/displayplacer) can do this, but as a backend it would need a separate `brew install`, its `list` output is free text, and it addresses displays by UUIDs that macOS reshuffles on wake (its two longest-running issues). Its mirror path is the same two CoreGraphics calls above, so embedding them costs nothing and removes the dependency. Full arrangement/resolution profiles remain displayplacer's territory and are out of scope here.

## Pitfalls found on the way

- **A mirrored display has no `NSScreen`.** AppKit lists only active screens, so `localizedName` is unavailable for the display that is currently a mirror. The IOKit registry still has it: `IOMobileFramebufferShim` entries carry `DisplayAttributes.ProductAttributes` with `ProductName`, `LegacyManufacturerID`, `ProductID`, `SerialNumber`, and those three numbers equal `CGDisplayVendorNumber` / `ModelNumber` / `SerialNumber`. Read the whole property dictionary with `IORegistryEntryCreateCFProperties`; fetching the single key returned nothing.
- **Never match displays by UUID.** Vendor, model and serial are stable; UUIDs are not.
- **Main display lags.** After a mirror transaction completes, `CGDisplayIsMain` takes a few hundred milliseconds to reflect reality. Changing the main display in the same transaction is ignored or fails, hence two transactions with a pause.
- **`swift:` import paths are relative to the importing file**, so a file in `src/lib` imports `swift:../../swift`.
- **Use `.permanently`** when completing the configuration, otherwise the change is lost on reboot or replug.
- **Not built:** disabling a display ("external only") needs the private `CGSConfigureDisplayEnabled` and re-enabling is unreliable; closing the lid covers most of that need.
