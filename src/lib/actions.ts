// State-oriented operations shared by the no-view commands and the menu bar.
// Each returns the HUD line describing the resulting state; each is idempotent.

import { LocalStorage, showHUD, showToast, Toast } from "@raycast/api";
import {
  DisplayInfo,
  audioOutputFor,
  desiredMain,
  getBrightness,
  isMirrored,
  listAudioOutputs,
  listDisplays,
  mirrorAll,
  mirrorSource,
  prefs,
  setBrightness,
  setDefaultAudioOutput,
  setMainDisplay,
  unmirrorAll,
} from "./display";

const KEY_INTENDED_MIRROR = "intendedMirror"; // "1" while mirroring was set up by this extension
const KEY_SAVED_BRIGHTNESS = "builtinBrightness"; // brightness to restore after dimming

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** WindowServer needs a moment after a mirror transaction before CGDisplayIsMain reflects reality. */
async function settle(): Promise<DisplayInfo[]> {
  await sleep(600);
  return listDisplays();
}

/** Remember whether the current mirroring came from us, so Auto-Extend leaves it alone. */
export const markIntendedMirror = (on: boolean) => LocalStorage.setItem(KEY_INTENDED_MIRROR, on ? "1" : "0");

async function dimBuiltin(displays: DisplayInfo[], source: DisplayInfo) {
  if (!prefs().dimBuiltinWhileMirrored) return;
  const builtin = displays.find((d) => d.isBuiltin);
  if (!builtin || builtin.id === source.id) return;
  const current = await getBrightness(builtin.id);
  if (current < 0) return;
  if ((await LocalStorage.getItem<string>(KEY_SAVED_BRIGHTNESS)) === undefined) {
    await LocalStorage.setItem(KEY_SAVED_BRIGHTNESS, String(current));
  }
  await setBrightness(builtin.id, 0);
}

async function restoreBuiltinBrightness(displays: DisplayInfo[]) {
  const saved = await LocalStorage.getItem<string>(KEY_SAVED_BRIGHTNESS);
  if (saved === undefined) return;
  await LocalStorage.removeItem(KEY_SAVED_BRIGHTNESS);
  const builtin = displays.find((d) => d.isBuiltin);
  if (builtin) await setBrightness(builtin.id, Number(saved));
}

export async function mirrorDisplays(): Promise<string> {
  const displays = await listDisplays();
  if (displays.length < 2) return "Only one display connected";
  const source = mirrorSource(displays);
  if (!source) return "Could not pick a display to optimize for";
  const others = displays.filter((d) => d.id !== source.id);
  if (others.every((d) => d.mirrorsDisplayId === source.id)) {
    await markIntendedMirror(true);
    return `Already mirroring · optimized for ${source.name}`;
  }
  await mirrorAll(source.id);
  await markIntendedMirror(true);
  await dimBuiltin(displays, source);
  return `Mirroring · optimized for ${source.name}`;
}

export async function extendDisplays(): Promise<string> {
  let displays = await listDisplays();
  await markIntendedMirror(false);
  if (displays.length < 2) {
    await restoreBuiltinBrightness(displays);
    return "Only one display connected";
  }
  const wantMain = desiredMain(displays);
  const mirrored = isMirrored(displays);
  if (!mirrored && (!wantMain || wantMain.isMain)) {
    await restoreBuiltinBrightness(displays);
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
  await restoreBuiltinBrightness(displays);
  const main = displays.find((d) => d.isMain);
  return `Extended · ${main?.name ?? "?"} is main`;
}

export async function toggleDisplays(): Promise<string> {
  const displays = await listDisplays();
  return isMirrored(displays) ? extendDisplays() : mirrorDisplays();
}

/** Route sound to the device belonging to `display`. Returns a HUD suffix, or "" when nothing changed. */
async function followAudio(display: DisplayInfo): Promise<string> {
  if (!prefs().audioFollowsMain) return "";
  const output = audioOutputFor(display, await listAudioOutputs());
  if (!output || output.isDefault) return "";
  await setDefaultAudioOutput(output.id);
  return ` · audio on ${output.name}`;
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
  const audio = await followAudio(other);
  return `${other.name} is now main${audio}`;
}

/** For the menu bar's background refresh: undo mirroring this extension did not set up. */
export async function autoExtendIfNeeded(displays: DisplayInfo[]): Promise<string | undefined> {
  if (!prefs().autoExtend || !isMirrored(displays)) return undefined;
  if ((await LocalStorage.getItem<string>(KEY_INTENDED_MIRROR)) === "1") return undefined;
  return extendDisplays();
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
