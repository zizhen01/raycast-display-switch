// State-oriented operations shared by the no-view commands and the menu bar.
// Each returns the HUD line describing the resulting state; each is idempotent.

import { showHUD, showToast, Toast } from "@raycast/api";
import {
  DisplayInfo,
  desiredMain,
  isMirrored,
  listDisplays,
  mirrorAll,
  mirrorSource,
  prefs,
  setMainDisplay,
  unmirrorAll,
} from "./display";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** WindowServer needs a moment after a mirror transaction before CGDisplayIsMain reflects reality. */
async function settle(): Promise<DisplayInfo[]> {
  await sleep(600);
  return listDisplays();
}

export async function mirrorDisplays(): Promise<string> {
  const displays = await listDisplays();
  if (displays.length < 2) return "Only one display connected";
  const source = mirrorSource(displays);
  if (!source) return "Could not pick a display to optimize for";
  const others = displays.filter((d) => d.id !== source.id);
  if (others.every((d) => d.mirrorsDisplayId === source.id)) return `Already mirroring · optimized for ${source.name}`;
  await mirrorAll(source.id);
  return `Mirroring · optimized for ${source.name}`;
}

export async function extendDisplays(): Promise<string> {
  let displays = await listDisplays();
  if (displays.length < 2) return "Only one display connected";
  const wantMain = desiredMain(displays);
  const mirrored = isMirrored(displays);
  if (!mirrored && (!wantMain || wantMain.isMain)) {
    return `Already extended · ${displays.find((d) => d.isMain)?.name ?? "?"} is main`;
  }
  if (mirrored) {
    await unmirrorAll();
    displays = await settle();
  }
  if (wantMain) {
    const fresh = displays.find((d) => d.id === wantMain.id);
    if (fresh && !fresh.isMain) {
      await setMainDisplay(fresh.id);
      displays = await settle();
    }
  }
  const main = displays.find((d) => d.isMain);
  return `Extended · ${main?.name ?? "?"} is main`;
}

export async function toggleDisplays(): Promise<string> {
  const displays = await listDisplays();
  return isMirrored(displays) ? extendDisplays() : mirrorDisplays();
}

export async function swapMainDisplay(): Promise<string> {
  const displays = await listDisplays();
  if (displays.length < 2) return "Only one display connected";
  if (isMirrored(displays)) return "Displays are mirrored · extend first";
  const current = displays.find((d) => d.isMain);
  // Prefer the other side of the builtin/external pair; with more displays, the next one by id.
  const other =
    displays.find((d) => !d.isMain && d.isBuiltin !== current?.isBuiltin) ?? displays.find((d) => !d.isMain);
  if (!other) return "No other display to make main";
  await setMainDisplay(other.id);
  return `${other.name} is now main`;
}

/** Run an operation from a no-view command: HUD on success, toast with the CGError on failure. */
export async function runCommand(op: () => Promise<string>) {
  try {
    const message = await op();
    if (prefs().showHUD !== false) await showHUD(message);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Display change failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
