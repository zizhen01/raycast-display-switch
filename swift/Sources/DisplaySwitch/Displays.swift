// Enumerates online displays and reads their mirror / main / geometry state.
// Pure reads: nothing here changes the display configuration.

import AppKit
import CoreGraphics
import Foundation
import RaycastSwiftMacros

struct DisplayInfo: Encodable {
  let id: UInt32
  let name: String
  let isMain: Bool
  let isBuiltin: Bool
  /// True when the display belongs to a mirror set (either as source or as a mirror).
  let isMirroring: Bool
  /// Display id this one mirrors. 0 when it is the source of the set or not mirrored at all.
  let mirrorsDisplayId: UInt32
  let vendor: UInt32
  let model: UInt32
  let serial: UInt32
  /// Logical (points) bounds in the global desktop coordinate space.
  let x: Int
  let y: Int
  let width: Int
  let height: Int
  /// Native pixel size of the current mode.
  let pixelWidth: Int
  let pixelHeight: Int
  let refreshRate: Double
}

struct HelperError: Error, LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

func onlineDisplayIds() -> [CGDirectDisplayID] {
  var count: UInt32 = 0
  CGGetOnlineDisplayList(0, nil, &count)
  var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
  CGGetOnlineDisplayList(count, &ids, &count)
  return Array(ids.prefix(Int(count)))
}

/// Human readable names keyed by display id, from AppKit (System Settings shows the same string).
func displayNames() -> [CGDirectDisplayID: String] {
  var names: [CGDirectDisplayID: String] = [:]
  for screen in NSScreen.screens {
    if let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber {
      names[CGDirectDisplayID(number.uint32Value)] = screen.localizedName
    }
  }
  return names
}

func describe(_ id: CGDirectDisplayID, names: [CGDirectDisplayID: String], ioNames: [IOKitDisplayName]) -> DisplayInfo {
  let bounds = CGDisplayBounds(id)
  let mode = CGDisplayCopyDisplayMode(id)
  let fallbackName = CGDisplayIsBuiltin(id) != 0 ? "Built-in Display" : "Display \(id)"
  return DisplayInfo(
    id: id,
    name: names[id] ?? ioKitName(for: id, cache: ioNames) ?? fallbackName,
    isMain: CGDisplayIsMain(id) != 0,
    isBuiltin: CGDisplayIsBuiltin(id) != 0,
    isMirroring: CGDisplayIsInMirrorSet(id) != 0,
    mirrorsDisplayId: CGDisplayMirrorsDisplay(id),
    vendor: CGDisplayVendorNumber(id),
    model: CGDisplayModelNumber(id),
    serial: CGDisplaySerialNumber(id),
    x: Int(bounds.origin.x),
    y: Int(bounds.origin.y),
    width: Int(bounds.width),
    height: Int(bounds.height),
    pixelWidth: mode?.pixelWidth ?? 0,
    pixelHeight: mode?.pixelHeight ?? 0,
    refreshRate: mode?.refreshRate ?? 0
  )
}

/// Every online display, main display first.
@raycast func listDisplays() -> [DisplayInfo] {
  let names = displayNames()
  let ioNames = ioKitDisplayNames()
  return onlineDisplayIds()
    .map { describe($0, names: names, ioNames: ioNames) }
    .sorted { a, b in
      if a.isMain != b.isMain { return a.isMain }
      return a.id < b.id
    }
}
