import { getPreferenceValues } from "@raycast/api";
import {
  listDisplays as swiftListDisplays,
  setMirror as swiftSetMirror,
  mirrorAll as swiftMirrorAll,
  unmirror as swiftUnmirror,
  unmirrorAll as swiftUnmirrorAll,
  setMainDisplay as swiftSetMainDisplay,
  listAudioOutputs as swiftListAudioOutputs,
  setDefaultAudioOutput as swiftSetDefaultAudioOutput,
  getBrightness as swiftGetBrightness,
  setBrightness as swiftSetBrightness,
} from "swift:../../swift";

export interface DisplayInfo {
  id: number;
  name: string;
  isMain: boolean;
  isBuiltin: boolean;
  isMirroring: boolean;
  mirrorsDisplayId: number;
  vendor: number;
  model: number;
  serial: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  refreshRate: number;
}

export type DisplayChoice = "external" | "builtin" | "main";
export type MainChoice = "external" | "builtin" | "keep";

export interface Preferences {
  mirrorOptimizeFor: DisplayChoice;
  mainWhenExtended: MainChoice;
  showHUD: boolean;
  audioFollowsMain: boolean;
  dimBuiltinWhileMirrored: boolean;
  autoExtend: boolean;
}

export interface AudioOutput {
  id: number;
  name: string;
  transport: string;
  isDefault: boolean;
}

export const listDisplays = () => swiftListDisplays() as Promise<DisplayInfo[]>;
export const setMirror = (target: number, source: number) => swiftSetMirror(target, source) as Promise<void>;
export const mirrorAll = (source: number) => swiftMirrorAll(source) as Promise<void>;
export const unmirror = (target: number) => swiftUnmirror(target) as Promise<void>;
export const unmirrorAll = () => swiftUnmirrorAll() as Promise<void>;
export const setMainDisplay = (id: number) => swiftSetMainDisplay(id) as Promise<void>;
export const listAudioOutputs = () => swiftListAudioOutputs() as Promise<AudioOutput[]>;
export const setDefaultAudioOutput = (id: number) => swiftSetDefaultAudioOutput(id) as Promise<void>;
export const getBrightness = (display: number) => swiftGetBrightness(display) as Promise<number>;
export const setBrightness = (display: number, value: number) => swiftSetBrightness(display, value) as Promise<void>;

/** The audio device that belongs to `display`: built-in speakers for the built-in display, otherwise the
 *  display's own DisplayPort/HDMI device (matched by name first, then by transport). */
export function audioOutputFor(display: DisplayInfo, outputs: AudioOutput[]): AudioOutput | undefined {
  if (display.isBuiltin) return outputs.find((o) => o.transport === "bltn");
  const name = display.name.toLowerCase();
  return (
    outputs.find((o) => o.name.toLowerCase() === name) ??
    outputs.find((o) => o.transport === "dprt" || o.transport === "hdmi")
  );
}

export const prefs = () => getPreferenceValues<Preferences>();

/** Mirrors (copies of another display). The source of a mirror set is not in this list. */
export const mirrors = (displays: DisplayInfo[]) => displays.filter((d) => d.mirrorsDisplayId !== 0);
export const isMirrored = (displays: DisplayInfo[]) => mirrors(displays).length > 0;

/** "External" with several external displays: the current main if it is external, else the lowest id external. */
function externalDisplay(displays: DisplayInfo[]): DisplayInfo | undefined {
  const externals = displays.filter((d) => !d.isBuiltin);
  return externals.find((d) => d.isMain) ?? externals.sort((a, b) => a.id - b.id)[0];
}

export function resolveChoice(displays: DisplayInfo[], choice: DisplayChoice): DisplayInfo | undefined {
  const main = displays.find((d) => d.isMain) ?? displays[0];
  switch (choice) {
    case "external":
      return externalDisplay(displays) ?? main;
    case "builtin":
      return displays.find((d) => d.isBuiltin) ?? main;
    default:
      return main;
  }
}

/** The display every other one should copy when mirroring. */
export const mirrorSource = (displays: DisplayInfo[]) => resolveChoice(displays, prefs().mirrorOptimizeFor);

/** The display that should own the menu bar once extended, or undefined to leave it to macOS. */
export function desiredMain(displays: DisplayInfo[]): DisplayInfo | undefined {
  const choice = prefs().mainWhenExtended;
  return choice === "keep" ? undefined : resolveChoice(displays, choice);
}

export function describeMode(d: DisplayInfo, all: DisplayInfo[]): string {
  if (d.mirrorsDisplayId !== 0) {
    const src = all.find((s) => s.id === d.mirrorsDisplayId);
    return `Mirroring ${src?.name ?? d.mirrorsDisplayId}`;
  }
  if (d.isMirroring) return "Mirror source";
  return "Extended";
}

export function resolutionLabel(d: DisplayInfo): string {
  const hz = d.refreshRate > 0 ? ` @ ${Math.round(d.refreshRate)}Hz` : "";
  if (d.pixelWidth && (d.pixelWidth !== d.width || d.pixelHeight !== d.height)) {
    return `${d.width}×${d.height} (${d.pixelWidth}×${d.pixelHeight})${hz}`;
  }
  return `${d.width}×${d.height}${hz}`;
}
