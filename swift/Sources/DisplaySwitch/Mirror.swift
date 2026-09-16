// Applies mirror / unmirror / main-display changes through CoreGraphics transactions.
// These are public APIs (CGDisplayConfiguration.h); no private frameworks, no root, no accessibility.

import CoreGraphics
import Foundation
import RaycastSwiftMacros

func requireOnline(_ id: CGDirectDisplayID) throws {
  guard onlineDisplayIds().contains(id) else {
    throw HelperError("Display \(id) is not online (unplugged, asleep, or lid closed)")
  }
}

/// Runs `body` inside Begin/Complete. Cancels the transaction on any failure so the desktop is left untouched.
func transaction(_ body: (CGDisplayConfigRef) throws -> Void) throws {
  var config: CGDisplayConfigRef?
  guard CGBeginDisplayConfiguration(&config) == .success, let config else {
    throw HelperError("Could not begin a display configuration")
  }
  do {
    try body(config)
  } catch {
    CGCancelDisplayConfiguration(config)
    throw error
  }
  let result = CGCompleteDisplayConfiguration(config, .permanently)
  guard result == .success else {
    CGCancelDisplayConfiguration(config)
    throw HelperError("Could not apply the display configuration (CGError \(result.rawValue))")
  }
}

func detach(_ id: CGDirectDisplayID, in config: CGDisplayConfigRef) throws {
  let r = CGConfigureDisplayMirrorOfDisplay(config, id, kCGNullDirectDisplay)
  guard r == .success else { throw HelperError("Could not stop mirroring on display \(id) (CGError \(r.rawValue))") }
}

func attach(_ id: CGDirectDisplayID, to source: CGDirectDisplayID, in config: CGDisplayConfigRef) throws {
  let r = CGConfigureDisplayMirrorOfDisplay(config, id, source)
  guard r == .success else { throw HelperError("Could not mirror display \(id) to \(source) (CGError \(r.rawValue))") }
}

/// Make `target` show a copy of `source`.
@raycast func setMirror(target: UInt32, source: UInt32) throws {
  guard target != source else { throw HelperError("A display cannot mirror itself") }
  try requireOnline(target)
  try requireOnline(source)
  try transaction { config in
    // A display that is itself a mirror cannot be a source; detach it inside the same transaction.
    if CGDisplayMirrorsDisplay(source) != kCGNullDirectDisplay { try detach(source, in: config) }
    try attach(target, to: source, in: config)
  }
}

/// Every other online display becomes a mirror of `source` ("optimize for" source).
@raycast func mirrorAll(source: UInt32) throws {
  try requireOnline(source)
  let others = onlineDisplayIds().filter { $0 != source }
  guard !others.isEmpty else { throw HelperError("Only one display is connected") }
  try transaction { config in
    if CGDisplayMirrorsDisplay(source) != kCGNullDirectDisplay { try detach(source, in: config) }
    for id in others where CGDisplayMirrorsDisplay(id) != source {
      try attach(id, to: source, in: config)
    }
  }
}

/// Return `target` to an independent (extended) display. macOS restores its previous arrangement and mode.
@raycast func unmirror(target: UInt32) throws {
  try requireOnline(target)
  try transaction { config in
    if CGDisplayMirrorsDisplay(target) != kCGNullDirectDisplay {
      try detach(target, in: config)
    } else if CGDisplayIsInMirrorSet(target) != 0 {
      // `target` is the source of the set: detach every display that mirrors it.
      for other in onlineDisplayIds() where CGDisplayMirrorsDisplay(other) == target {
        try detach(other, in: config)
      }
    }
  }
}

/// Dissolve every mirror set. No-op when nothing is mirrored.
@raycast func unmirrorAll() throws {
  let mirrored = onlineDisplayIds().filter { CGDisplayMirrorsDisplay($0) != kCGNullDirectDisplay }
  guard !mirrored.isEmpty else { return }
  try transaction { config in
    for id in mirrored { try detach(id, in: config) }
  }
}

/// Move the menu bar (main display) to `id` by placing its origin at (0,0).
@raycast func setMainDisplay(id: UInt32) throws {
  try requireOnline(id)
  guard CGDisplayIsMain(id) == 0 else { return }
  try transaction { config in
    let r = CGConfigureDisplayOrigin(config, id, 0, 0)
    guard r == .success else { throw HelperError("Could not set the main display (CGError \(r.rawValue))") }
  }
}
