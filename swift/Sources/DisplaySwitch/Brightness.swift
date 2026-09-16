// Built-in display brightness through DisplayServices, loaded at runtime so nothing links against a private
// framework. Every call degrades gracefully: unavailable → -1 / no-op, never a crash.

import CoreGraphics
import Foundation
import RaycastSwiftMacros

private typealias GetFn = @convention(c) (CGDirectDisplayID, UnsafeMutablePointer<Float>) -> Int32
private typealias SetFn = @convention(c) (CGDirectDisplayID, Float) -> Int32

private let displayServices: (get: GetFn, set: SetFn)? = {
  guard
    let handle = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_LAZY),
    let get = dlsym(handle, "DisplayServicesGetBrightness"),
    let set = dlsym(handle, "DisplayServicesSetBrightness")
  else { return nil }
  return (unsafeBitCast(get, to: GetFn.self), unsafeBitCast(set, to: SetFn.self))
}()

/// 0…1, or -1 when the display has no software brightness control (most external monitors).
@raycast func getBrightness(display: UInt32) -> Double {
  guard let fns = displayServices else { return -1 }
  var value: Float = -1
  return fns.get(display, &value) == 0 ? Double(value) : -1
}

/// Set brightness 0…1. Throws only when the display supports brightness but the call fails.
@raycast func setBrightness(display: UInt32, value: Double) throws {
  guard let fns = displayServices else { return }
  var current: Float = -1
  guard fns.get(display, &current) == 0 else { return } // unsupported display: silently ignore
  let clamped = Float(min(max(value, 0), 1))
  let status = fns.set(display, clamped)
  guard status == 0 else { throw HelperError("Could not set brightness on display \(display) (error \(status))") }
}
