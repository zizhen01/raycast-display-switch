// Display names from the IOKit registry. NSScreen only lists *active* screens, so a display that is
// currently mirroring another one has no NSScreen and therefore no localizedName. IOKit still knows it:
// IOMobileFramebufferShim nodes carry DisplayAttributes.ProductAttributes with the same vendor/model/serial
// numbers CoreGraphics reports, plus the ProductName System Settings shows.

import CoreGraphics
import Foundation
import IOKit

struct IOKitDisplayName {
  let vendor: UInt32
  let model: UInt32
  let serial: UInt32
  let name: String
}

func ioKitDisplayNames() -> [IOKitDisplayName] {
  var result: [IOKitDisplayName] = []
  for className in ["IOMobileFramebufferShim", "IODisplay"] {
    guard let matching = IOServiceMatching(className) else { continue }
    var iterator: io_iterator_t = 0
    guard IOServiceGetMatchingServices(kIOMainPortDefault, matching, &iterator) == KERN_SUCCESS else { continue }
    defer { IOObjectRelease(iterator) }
    while true {
      let service = IOIteratorNext(iterator)
      if service == 0 { break }
      defer { IOObjectRelease(service) }
      var props: Unmanaged<CFMutableDictionary>?
      guard IORegistryEntryCreateCFProperties(service, &props, kCFAllocatorDefault, 0) == KERN_SUCCESS else { continue }
      guard
        let all = props?.takeRetainedValue() as? [String: Any],
        let attrs = all["DisplayAttributes"] as? [String: Any],
        let product = attrs["ProductAttributes"] as? [String: Any],
        let name = product["ProductName"] as? String, !name.isEmpty
      else { continue }
      let vendor = (product["LegacyManufacturerID"] as? NSNumber)?.uint32Value ?? 0
      let model = (product["ProductID"] as? NSNumber)?.uint32Value ?? 0
      let serial = (product["SerialNumber"] as? NSNumber)?.uint32Value ?? 0
      result.append(IOKitDisplayName(vendor: vendor, model: model, serial: serial, name: name))
    }
  }
  return result
}

/// Best-effort name for a display CoreGraphics knows but AppKit does not list.
func ioKitName(for id: CGDirectDisplayID, cache: [IOKitDisplayName]) -> String? {
  let vendor = CGDisplayVendorNumber(id)
  let model = CGDisplayModelNumber(id)
  let serial = CGDisplaySerialNumber(id)
  if let exact = cache.first(where: { $0.vendor == vendor && $0.model == model && $0.serial == serial }) {
    return exact.name
  }
  // Serial can be 0 on some panels; fall back to vendor+model when that pair is unique.
  let byModel = cache.filter { $0.vendor == vendor && $0.model == model }
  return byModel.count == 1 ? byModel[0].name : nil
}
