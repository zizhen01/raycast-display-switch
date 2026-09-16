// swift-tools-version: 5.10
// Executable target compiled by `ray build` through raycast/extensions-swift-tools.
// Global functions marked @raycast are exported to TypeScript as `import ... from "swift:../swift"`.
// Do NOT add main.swift or @main: the plugin generates the entry point.

import PackageDescription

let package = Package(
  name: "DisplaySwitch",
  platforms: [.macOS(.v13)],
  dependencies: [
    .package(url: "https://github.com/raycast/extensions-swift-tools", from: "1.1.0")
  ],
  targets: [
    .executableTarget(
      name: "DisplaySwitch",
      dependencies: [
        .product(name: "RaycastSwiftMacros", package: "extensions-swift-tools"),
        .product(name: "RaycastSwiftPlugin", package: "extensions-swift-tools"),
        .product(name: "RaycastTypeScriptPlugin", package: "extensions-swift-tools"),
      ]
    )
  ]
)
