// Default audio output device, so sound can follow the main display (public CoreAudio API).

import CoreAudio
import Foundation
import RaycastSwiftMacros

struct AudioOutput: Encodable {
  let id: UInt32
  let name: String
  /// Four-char transport code as text: "bltn" built-in, "dprt" DisplayPort, "hdmi", "usb ", "blue", "virt"…
  let transport: String
  let isDefault: Bool
}

private func address(_ selector: AudioObjectPropertySelector, _ scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal)
  -> AudioObjectPropertyAddress
{
  AudioObjectPropertyAddress(mSelector: selector, mScope: scope, mElement: kAudioObjectPropertyElementMain)
}

private func read<T>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal, default value: T) -> T {
  var addr = address(selector, scope)
  var size = UInt32(MemoryLayout<T>.size)
  var out = value
  return AudioObjectGetPropertyData(object, &addr, 0, nil, &size, &out) == noErr ? out : value
}

private func readString(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String {
  var addr = address(selector)
  var size = UInt32(MemoryLayout<CFString?>.size)
  var out: CFString?
  let status = withUnsafeMutablePointer(to: &out) { AudioObjectGetPropertyData(object, &addr, 0, nil, &size, $0) }
  return status == noErr ? (out as String? ?? "") : ""
}

private func hasOutputStreams(_ device: AudioObjectID) -> Bool {
  var addr = address(kAudioDevicePropertyStreams, kAudioObjectPropertyScopeOutput)
  var size: UInt32 = 0
  return AudioObjectGetPropertyDataSize(device, &addr, 0, nil, &size) == noErr && size > 0
}

private func fourCC(_ value: UInt32) -> String {
  let bytes = withUnsafeBytes(of: value.bigEndian) { Array($0) }
  return String(bytes: bytes, encoding: .macOSRoman) ?? String(value)
}

/// Every device that can play audio, with the current default flagged.
@raycast func listAudioOutputs() -> [AudioOutput] {
  let system = AudioObjectID(kAudioObjectSystemObject)
  var addr = address(kAudioHardwarePropertyDevices)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(system, &addr, 0, nil, &size) == noErr else { return [] }
  var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
  guard AudioObjectGetPropertyData(system, &addr, 0, nil, &size, &ids) == noErr else { return [] }
  let current: AudioObjectID = read(system, kAudioHardwarePropertyDefaultOutputDevice, default: 0)
  return ids.filter(hasOutputStreams).map { id in
    AudioOutput(
      id: id,
      name: readString(id, kAudioObjectPropertyName),
      transport: fourCC(read(id, kAudioDevicePropertyTransportType, default: UInt32(0))),
      isDefault: id == current
    )
  }
}

/// Route system sound (and alerts) to `id`.
@raycast func setDefaultAudioOutput(id: UInt32) throws {
  var device = AudioObjectID(id)
  let size = UInt32(MemoryLayout<AudioObjectID>.size)
  for selector in [kAudioHardwarePropertyDefaultOutputDevice, kAudioHardwarePropertyDefaultSystemOutputDevice] {
    var addr = address(selector)
    let status = AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, size, &device)
    guard status == noErr else { throw HelperError("Could not change the audio output (OSStatus \(status))") }
  }
}
