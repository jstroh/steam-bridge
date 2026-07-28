#!/usr/bin/env swift

import AppKit
import ApplicationServices
import CoreGraphics
import Darwin
import Foundation

private enum InputError: Error, CustomStringConvertible {
    case usage(String)
    case failure(String)

    var description: String {
        switch self {
        case let .usage(message), let .failure(message): return message
        }
    }
}

private struct Options {
    var pid: pid_t?
    var bundleId: String?
    var titleContains: String?
    var kind: String?
    var shortcut: String?
    var action: String?
    var menu: String?
    var item: String?
    var dx = 0.0
    var dy = 0.0
    var durationMs = 500.0
    var steps = 30
    var edgeOffset = -1.0
    var frame: CGRect?
    var minimized: Bool?
    var restorePointer = true
    var xFromRight = 24.0
    var yFromTop = 24.0
}

// AppKit enters its synchronous title-bar move loop only after it has consumed
// the mouse-down.  Posting the first rapid drag event in the same instant can
// leave an otherwise valid 80-120 ms QA gesture unlatched.  Keep the measured
// motion duration unchanged and give only title drags one bounded latch window.
private let titleDragMouseDownLatchSeconds = 0.08
// Window Server does not reliably enter AppKit's title-bar tracking loop when
// a synthetic slow drag begins with sub-hysteresis motion.  Cross the latch
// distance once, then preserve the requested duration and remaining cadence.
private let titleDragMinimumLatchDistance = 8.0

private func usage() -> String {
    """
    Usage:
      macos-window-input.swift preflight
      macos-window-input.swift snapshot --pid PID [--title-contains TEXT]
      macos-window-input.swift drag --pid PID --kind title|right|bottom|bottom-right --dx N --dy N [--duration-ms N] [--steps N] [--edge-offset N]
      macos-window-input.swift click-child --pid PID [--x-from-right N] [--y-from-top N]
      macos-window-input.swift move-child --pid PID [--x-from-right N] [--y-from-top N]
      macos-window-input.swift move-title --pid PID
      macos-window-input.swift key --pid PID --shortcut cmd-m|cmd-h|cmd-tab|cmd-shift-o|escape|ctrl-cmd-f
      macos-window-input.swift focus --pid PID
      macos-window-input.swift focus-bundle --bundle-id ID
      macos-window-input.swift menu --pid PID --menu LABEL --item LABEL
      macos-window-input.swift window-action --pid PID --action zoom|minimize|close
      macos-window-input.swift set-minimized --pid PID --minimized true|false
      macos-window-input.swift set-frame --pid PID --frame X,Y,WIDTH,HEIGHT
      macos-window-input.swift pointer

    All app operations target an exact PID and its focused/main standard window.
    Genuine drags post a guaranteed mouse-up and restore the original pointer by
    default. The bounded move commands intentionally leave the pointer in the
    requested owned-window region; use move-title after move-child to return it
    to visible parent chrome. Accessibility permission is required; this tool
    never prompts or attempts to bypass macOS TCC.
    """
}

private func takeValue(_ arguments: [String], index: inout Int, option: String) throws -> String {
    index += 1
    guard index < arguments.count else { throw InputError.usage("missing value for \(option)") }
    return arguments[index]
}

private func parseBool(_ value: String, option: String) throws -> Bool {
    switch value.lowercased() {
    case "1", "true", "yes": return true
    case "0", "false", "no": return false
    default: throw InputError.usage("\(option) requires true or false")
    }
}

private func parseFrame(_ value: String) throws -> CGRect {
    let values = value.split(separator: ",", omittingEmptySubsequences: false).compactMap { Double($0) }
    guard values.count == 4, values[2] > 0, values[3] > 0 else {
        throw InputError.usage("--frame requires X,Y,WIDTH,HEIGHT")
    }
    return CGRect(x: values[0], y: values[1], width: values[2], height: values[3])
}

private func parseOptions(_ arguments: [String]) throws -> Options {
    var options = Options()
    var index = 0
    while index < arguments.count {
        let option = arguments[index]
        switch option {
        case "--pid":
            let value = try takeValue(arguments, index: &index, option: option)
            guard let parsed = pid_t(value), parsed > 0 else { throw InputError.usage("--pid requires a positive integer") }
            options.pid = parsed
        case "--bundle-id": options.bundleId = try takeValue(arguments, index: &index, option: option)
        case "--title-contains": options.titleContains = try takeValue(arguments, index: &index, option: option)
        case "--kind": options.kind = try takeValue(arguments, index: &index, option: option)
        case "--shortcut": options.shortcut = try takeValue(arguments, index: &index, option: option)
        case "--action": options.action = try takeValue(arguments, index: &index, option: option)
        case "--menu": options.menu = try takeValue(arguments, index: &index, option: option)
        case "--item": options.item = try takeValue(arguments, index: &index, option: option)
        case "--dx":
            guard let value = Double(try takeValue(arguments, index: &index, option: option)) else { throw InputError.usage("--dx requires a number") }
            options.dx = value
        case "--dy":
            guard let value = Double(try takeValue(arguments, index: &index, option: option)) else { throw InputError.usage("--dy requires a number") }
            options.dy = value
        case "--duration-ms":
            guard let value = Double(try takeValue(arguments, index: &index, option: option)), value >= 50, value <= 10_000 else {
                throw InputError.usage("--duration-ms must be in [50, 10000]")
            }
            options.durationMs = value
        case "--steps":
            guard let value = Int(try takeValue(arguments, index: &index, option: option)), value >= 2, value <= 1000 else {
                throw InputError.usage("--steps must be in [2, 1000]")
            }
            options.steps = value
        case "--edge-offset":
            guard let value = Double(try takeValue(arguments, index: &index, option: option)), value >= -8, value <= 8 else {
                throw InputError.usage("--edge-offset must be in [-8, 8]")
            }
            options.edgeOffset = value
        case "--frame": options.frame = try parseFrame(try takeValue(arguments, index: &index, option: option))
        case "--minimized": options.minimized = try parseBool(try takeValue(arguments, index: &index, option: option), option: option)
        case "--restore-pointer": options.restorePointer = try parseBool(try takeValue(arguments, index: &index, option: option), option: option)
        case "--x-from-right":
            guard let value = Double(try takeValue(arguments, index: &index, option: option)), value >= 1, value <= 32_768 else {
                throw InputError.usage("--x-from-right must be in [1, 32768]")
            }
            options.xFromRight = value
        case "--y-from-top":
            guard let value = Double(try takeValue(arguments, index: &index, option: option)), value >= 1, value <= 32_768 else {
                throw InputError.usage("--y-from-top must be in [1, 32768]")
            }
            options.yFromTop = value
        default: throw InputError.usage("unknown option: \(option)")
        }
        index += 1
    }
    return options
}

private func axValue(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute, &value) == .success else { return nil }
    return value
}

private func axString(_ element: AXUIElement, _ attribute: CFString) -> String? {
    axValue(element, attribute) as? String
}

private func axBool(_ element: AXUIElement, _ attribute: CFString) -> Bool? {
    (axValue(element, attribute) as? NSNumber)?.boolValue
}

private func axElements(_ element: AXUIElement, _ attribute: CFString) -> [AXUIElement] {
    (axValue(element, attribute) as? [AXUIElement]) ?? []
}

private func axElementRead(_ element: AXUIElement, _ attribute: CFString) -> (element: AXUIElement?, error: AXError) {
    var raw: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute, &raw)
    guard error == .success,
          let raw,
          CFGetTypeID(raw) == AXUIElementGetTypeID() else {
        return (nil, error)
    }
    return ((raw as! AXUIElement), error)
}

private func axElement(_ element: AXUIElement, _ attribute: CFString) -> AXUIElement? {
    axElementRead(element, attribute).element
}

private func axElementPid(_ element: AXUIElement?) -> pid_t? {
    guard let element else { return nil }
    var pid: pid_t = 0
    guard AXUIElementGetPid(element, &pid) == .success, pid > 0 else { return nil }
    return pid
}

private func sameAxElement(_ left: AXUIElement?, _ right: AXUIElement) -> Bool {
    guard let left else { return false }
    return CFEqual(left, right)
}

private func axPoint(_ element: AXUIElement, _ attribute: CFString) -> CGPoint? {
    guard let raw = axValue(element, attribute), CFGetTypeID(raw) == AXValueGetTypeID() else { return nil }
    var value = CGPoint.zero
    guard AXValueGetValue(raw as! AXValue, .cgPoint, &value) else { return nil }
    return value
}

private func axSize(_ element: AXUIElement, _ attribute: CFString) -> CGSize? {
    guard let raw = axValue(element, attribute), CFGetTypeID(raw) == AXValueGetTypeID() else { return nil }
    var value = CGSize.zero
    guard AXValueGetValue(raw as! AXValue, .cgSize, &value) else { return nil }
    return value
}

private func setAxPoint(_ element: AXUIElement, _ attribute: CFString, _ point: CGPoint) throws {
    var value = point
    guard let wrapped = AXValueCreate(.cgPoint, &value) else { throw InputError.failure("could not encode AX point") }
    let result = AXUIElementSetAttributeValue(element, attribute, wrapped)
    guard result == .success else { throw InputError.failure("AX point write failed: \(result.rawValue)") }
}

private func setAxSize(_ element: AXUIElement, _ attribute: CFString, _ size: CGSize) throws {
    var value = size
    guard let wrapped = AXValueCreate(.cgSize, &value) else { throw InputError.failure("could not encode AX size") }
    let result = AXUIElementSetAttributeValue(element, attribute, wrapped)
    guard result == .success else { throw InputError.failure("AX size write failed: \(result.rawValue)") }
}

private func requireTrusted() throws {
    guard AXIsProcessTrusted() else {
        throw InputError.failure("Accessibility permission is not granted to the exact automation host")
    }
}

private func requireLivePid(_ pid: pid_t?) throws -> pid_t {
    guard let pid, Darwin.kill(pid, 0) == 0 else { throw InputError.failure("target PID is not running") }
    return pid
}

private func selectWindow(pid: pid_t, titleContains: String?) throws -> (AXUIElement, Int) {
    let app = AXUIElementCreateApplication(pid)
    let windows = axElements(app, kAXWindowsAttribute as CFString)
    guard !windows.isEmpty else { throw InputError.failure("target application has no AX windows") }

    let eligible = windows.enumerated().filter { _, window in
        if let titleContains {
            guard axString(window, kAXTitleAttribute as CFString)?.localizedCaseInsensitiveContains(titleContains) == true else {
                return false
            }
        }
        let subrole = axString(window, kAXSubroleAttribute as CFString)
        return subrole == nil || subrole == (kAXStandardWindowSubrole as String)
    }
    guard !eligible.isEmpty else { throw InputError.failure("no matching standard AX window for target PID") }

    if let focusedWindow = axElement(app, kAXFocusedWindowAttribute as CFString) {
        let focusedMatches = eligible.filter { sameAxElement(focusedWindow, $0.1) }
        if focusedMatches.count == 1 { return (focusedMatches[0].1, focusedMatches[0].0) }
        if focusedMatches.count > 1 { throw InputError.failure("focused AX window selection is ambiguous") }
    }

    let mainMatches = eligible.filter { _, window in axBool(window, kAXMainAttribute as CFString) == true }
    if mainMatches.count == 1 { return (mainMatches[0].1, mainMatches[0].0) }
    if mainMatches.count > 1 { throw InputError.failure("main AX window selection is ambiguous") }

    let ranked = eligible.map { entry -> (Int, AXUIElement, Double) in
        let size = axSize(entry.1, kAXSizeAttribute as CFString) ?? .zero
        return (entry.0, entry.1, size.width * size.height)
    }.sorted { $0.2 > $1.2 }
    guard let selected = ranked.first, selected.2 > 0 else {
        throw InputError.failure("target AX window has no unique positive-area candidate")
    }
    if ranked.count > 1, abs(ranked[1].2 - selected.2) < 0.5 {
        throw InputError.failure("target AX window selection is ambiguous")
    }
    return (selected.1, selected.0)
}

private func frameOf(_ window: AXUIElement) throws -> CGRect {
    guard let position = axPoint(window, kAXPositionAttribute as CFString),
          let size = axSize(window, kAXSizeAttribute as CFString) else {
        throw InputError.failure("target AX window has no readable position/size")
    }
    return CGRect(origin: position, size: size)
}

private func rectDictionary(_ rect: CGRect) -> [String: Double] {
    ["x": rect.origin.x, "y": rect.origin.y, "width": rect.size.width, "height": rect.size.height]
}

private struct OwnedWindowRecord {
    let number: Int
    let name: String
    let layer: Int
    let alpha: Double
    let onScreen: Bool
    let bounds: CGRect
}

private func ownedWindowRecords(pid: pid_t) -> [OwnedWindowRecord] {
    let info = (CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]) ?? []
    return info.compactMap { item in
        guard (item[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid else { return nil }
        let rawBounds = item[kCGWindowBounds as String] as? [String: Any] ?? [:]
        let bounds = CGRect(
            x: (rawBounds["X"] as? NSNumber)?.doubleValue ?? 0,
            y: (rawBounds["Y"] as? NSNumber)?.doubleValue ?? 0,
            width: (rawBounds["Width"] as? NSNumber)?.doubleValue ?? 0,
            height: (rawBounds["Height"] as? NSNumber)?.doubleValue ?? 0
        )
        return OwnedWindowRecord(
            number: (item[kCGWindowNumber as String] as? NSNumber)?.intValue ?? 0,
            name: item[kCGWindowName as String] as? String ?? "",
            layer: (item[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 0,
            alpha: (item[kCGWindowAlpha as String] as? NSNumber)?.doubleValue ?? 0,
            onScreen: (item[kCGWindowIsOnscreen as String] as? NSNumber)?.boolValue ?? false,
            bounds: bounds
        )
    }
}

private func cgWindows(pid: pid_t) -> [[String: Any]] {
    ownedWindowRecords(pid: pid).map { record in
        return [
            "windowNumber": record.number,
            "name": record.name,
            "layer": record.layer,
            "alpha": record.alpha,
            "onScreen": record.onScreen,
            "bounds": rectDictionary(record.bounds),
        ]
    }
}

private struct WindowPairTracker {
    let parentNumber: Int
    let childNumber: Int
    let leftInset: Double
    let topInset: Double
    let rightInset: Double
    let bottomInset: Double
}

private struct WindowPairResult {
    var sampleCount = 0
    var missingSampleCount = 0
    var mismatchCount = 0
    var maxDelta = 0.0
}

private struct OwnedWindowPair {
    let tracker: WindowPairTracker
    let parent: OwnedWindowRecord
    let child: OwnedWindowRecord
}

private func rectDistance(_ left: CGRect, _ right: CGRect) -> Double {
    abs(left.minX - right.minX)
        + abs(left.minY - right.minY)
        + abs(left.width - right.width)
        + abs(left.height - right.height)
}

private func createWindowPairTracker(pid: pid_t, parentAxFrame: CGRect) -> WindowPairTracker? {
    let records = ownedWindowRecords(pid: pid)
    let children = records.filter {
        $0.name == "Steam Bridge Metal Overlay Host" && $0.layer == 0
    }
    guard children.count == 1, let child = children.first else { return nil }
    guard let parent = records
        .filter({ $0.number != child.number && $0.layer == 0 && $0.bounds.width > 0 && $0.bounds.height > 0 })
        .min(by: { rectDistance($0.bounds, parentAxFrame) < rectDistance($1.bounds, parentAxFrame) })
    else { return nil }
    return WindowPairTracker(
        parentNumber: parent.number,
        childNumber: child.number,
        leftInset: child.bounds.minX - parent.bounds.minX,
        topInset: child.bounds.minY - parent.bounds.minY,
        rightInset: parent.bounds.maxX - child.bounds.maxX,
        bottomInset: parent.bounds.maxY - child.bounds.maxY
    )
}

private func requireOwnedWindowPair(pid: pid_t, parentAxFrame: CGRect) throws -> OwnedWindowPair {
    guard let tracker = createWindowPairTracker(pid: pid, parentAxFrame: parentAxFrame) else {
        throw InputError.failure("exact attached Steam overlay child/parent pair is unavailable")
    }
    return try requireOwnedWindowPair(pid: pid, tracker: tracker)
}

private func requireOwnedWindowPair(pid: pid_t, tracker: WindowPairTracker) throws -> OwnedWindowPair {
    // ownedWindowRecords is already filtered to the exact target PID. Resolve
    // both original window numbers again so a stale/replaced pair fails closed.
    let records = ownedWindowRecords(pid: pid)
    guard let parent = records.first(where: { $0.number == tracker.parentNumber }),
          let child = records.first(where: { $0.number == tracker.childNumber }) else {
        throw InputError.failure("exact attached Steam overlay child/parent pair changed")
    }
    guard parent.number != child.number,
          parent.layer == 0,
          child.layer == 0,
          child.name == "Steam Bridge Metal Overlay Host",
          parent.onScreen,
          child.onScreen,
          parent.alpha > 0,
          child.alpha > 0,
          parent.bounds.width > 2,
          parent.bounds.height > 2,
          child.bounds.width > 2,
          child.bounds.height > 2 else {
        throw InputError.failure("exact attached Steam overlay child/parent pair is not safely targetable")
    }
    return OwnedWindowPair(tracker: tracker, parent: parent, child: child)
}

private func sampleWindowPair(pid: pid_t, tracker: WindowPairTracker?, result: inout WindowPairResult) {
    result.sampleCount += 1
    guard let tracker else {
        result.missingSampleCount += 1
        result.mismatchCount += 1
        return
    }
    let records = ownedWindowRecords(pid: pid)
    guard let parent = records.first(where: { $0.number == tracker.parentNumber }),
          let child = records.first(where: { $0.number == tracker.childNumber }) else {
        result.missingSampleCount += 1
        result.mismatchCount += 1
        return
    }
    let expected = CGRect(
        x: parent.bounds.minX + tracker.leftInset,
        y: parent.bounds.minY + tracker.topInset,
        width: max(0, parent.bounds.width - tracker.leftInset - tracker.rightInset),
        height: max(0, parent.bounds.height - tracker.topInset - tracker.bottomInset)
    )
    let delta = [
        abs(child.bounds.minX - expected.minX),
        abs(child.bounds.minY - expected.minY),
        abs(child.bounds.maxX - expected.maxX),
        abs(child.bounds.maxY - expected.maxY),
    ].max() ?? .infinity
    result.maxDelta = max(result.maxDelta, delta)
    if delta > 1.5 || !parent.onScreen || !child.onScreen || parent.alpha <= 0 || child.alpha <= 0 {
        result.mismatchCount += 1
    }
}

private func snapshot(pid: pid_t, titleContains: String?) throws -> [String: Any] {
    let applicationElement = AXUIElementCreateApplication(pid)
    let (window, index) = try selectWindow(pid: pid, titleContains: titleContains)
    let focusedWindow = axElement(applicationElement, kAXFocusedWindowAttribute as CFString)
    let focusedApplicationRead = axElementRead(
        AXUIElementCreateSystemWide(),
        kAXFocusedApplicationAttribute as CFString
    )
    let focusedApplication = focusedApplicationRead.element
    let focusedWindowMatchesSelected = axElementPid(focusedWindow) == pid && sameAxElement(focusedWindow, window)
    let applicationActive = NSRunningApplication(processIdentifier: pid)?.isActive ?? false
    let focusedApplicationMatchesPid = axElementPid(focusedApplication) == pid
    let frontmostApplicationPid = NSWorkspace.shared.frontmostApplication?.processIdentifier
    let frontmostApplicationMatchesPid = frontmostApplicationPid == pid
    let focusedApplicationCapability = focusedApplicationRead.error == .success
        ? "available"
        : focusedApplicationRead.error == .cannotComplete
            ? "cannot-complete"
            : focusedApplicationRead.error == .noValue ? "no-value" : "error"
    // Apple defines kAXErrorNoValue as the requested attribute having no value.
    // An attached Steam overlay can temporarily leave the system-wide focused-
    // application attribute empty even though the exact application is active,
    // frontmost, and owns the exact focused AX window. Treat that optional probe
    // as unavailable, never as a contradictory PID.
    let focusedApplicationProof = focusedApplicationMatchesPid
        || focusedApplicationCapability == "cannot-complete"
        || focusedApplicationCapability == "no-value"
    let main = axBool(window, kAXMainAttribute as CFString)
    let minimized = axBool(window, kAXMinimizedAttribute as CFString)
    let pointer = CGEvent(source: nil)?.location ?? .zero
    return [
        "schemaVersion": 1,
        "pid": pid,
        "selectedWindowIndex": index,
        "windowCount": axElements(applicationElement, kAXWindowsAttribute as CFString).count,
        "title": axString(window, kAXTitleAttribute as CFString) ?? "",
        "role": axString(window, kAXRoleAttribute as CFString) ?? "",
        "subrole": axString(window, kAXSubroleAttribute as CFString) ?? "",
        "focused": applicationActive
            && frontmostApplicationMatchesPid
            && focusedApplicationProof
            && focusedWindowMatchesSelected,
        "elementFocused": axBool(window, kAXFocusedAttribute as CFString) ?? false,
        "applicationActive": applicationActive,
        "frontmostApplicationReadable": frontmostApplicationPid != nil,
        "frontmostApplicationMatchesPid": frontmostApplicationMatchesPid,
        "focusedApplicationCapability": focusedApplicationCapability,
        "focusedApplicationError": focusedApplicationRead.error.rawValue,
        "focusedApplicationReadable": axElementPid(focusedApplication) != nil,
        "focusedApplicationMatchesPid": focusedApplicationMatchesPid,
        "focusedWindowReadable": axElementPid(focusedWindow) != nil,
        "focusedWindowMatchesSelected": focusedWindowMatchesSelected,
        "main": main ?? false,
        "mainReadable": main != nil,
        "minimized": minimized ?? false,
        "minimizedReadable": minimized != nil,
        "frame": rectDictionary(try frameOf(window)),
        "pointer": ["x": pointer.x, "y": pointer.y],
        "cgWindows": cgWindows(pid: pid),
    ]
}

private struct FocusObservation {
    let applicationActive: Bool
    let systemFocusedApplicationPidBefore: pid_t?
    let systemFocusedApplicationPidAfter: pid_t?
    let systemFocusedApplicationErrorBefore: AXError
    let systemFocusedApplicationErrorAfter: AXError
    let frontmostApplicationPidBefore: pid_t?
    let frontmostApplicationPidAfter: pid_t?
    let applicationFocusedWindowPid: pid_t?
    let selectedWindowPid: pid_t?
    let focusedWindowMatchesSelected: Bool
    let selectedWindowMinimized: Bool?
    let processAlive: Bool

    var systemFocusedApplicationCapability: String {
        if systemFocusedApplicationErrorBefore == .success,
           systemFocusedApplicationErrorAfter == .success {
            return "available"
        }
        if systemFocusedApplicationErrorBefore == .cannotComplete,
           systemFocusedApplicationErrorAfter == .cannotComplete {
            return "cannot-complete"
        }
        if systemFocusedApplicationErrorBefore == .noValue,
           systemFocusedApplicationErrorAfter == .noValue {
            return "no-value"
        }
        let beforeUsable = systemFocusedApplicationErrorBefore == .success
            || systemFocusedApplicationErrorBefore == .cannotComplete
            || systemFocusedApplicationErrorBefore == .noValue
        let afterUsable = systemFocusedApplicationErrorAfter == .success
            || systemFocusedApplicationErrorAfter == .cannotComplete
            || systemFocusedApplicationErrorAfter == .noValue
        if beforeUsable && afterUsable {
            return "partially-unavailable"
        }
        return "error"
    }

    var passed: Bool {
        let systemReadPassed: (AXError, pid_t?) -> Bool = { error, observedPid in
            if error == .success {
                return observedPid == selectedWindowPid
            }
            return error == .cannotComplete || error == .noValue
        }
        let systemFocusPassed = systemReadPassed(
            systemFocusedApplicationErrorBefore,
            systemFocusedApplicationPidBefore
        ) && systemReadPassed(
            systemFocusedApplicationErrorAfter,
            systemFocusedApplicationPidAfter
        )
        return processAlive
            && applicationActive
            && frontmostApplicationPidBefore == selectedWindowPid
            && frontmostApplicationPidAfter == selectedWindowPid
            && systemFocusPassed
            && applicationFocusedWindowPid == selectedWindowPid
            && focusedWindowMatchesSelected
            && selectedWindowMinimized == false
            && selectedWindowPid != nil
    }

    var json: [String: Any] {
        [
            "applicationActive": applicationActive,
            "systemFocusedApplicationPidBefore": Int(systemFocusedApplicationPidBefore ?? 0),
            "systemFocusedApplicationPidAfter": Int(systemFocusedApplicationPidAfter ?? 0),
            "systemFocusedApplicationErrorBefore": systemFocusedApplicationErrorBefore.rawValue,
            "systemFocusedApplicationErrorAfter": systemFocusedApplicationErrorAfter.rawValue,
            "systemFocusedApplicationCapability": systemFocusedApplicationCapability,
            "frontmostApplicationPidBefore": Int(frontmostApplicationPidBefore ?? 0),
            "frontmostApplicationPidAfter": Int(frontmostApplicationPidAfter ?? 0),
            "applicationFocusedWindowPid": Int(applicationFocusedWindowPid ?? 0),
            "selectedWindowPid": Int(selectedWindowPid ?? 0),
            "focusedWindowMatchesSelected": focusedWindowMatchesSelected,
            "selectedWindowMinimized": selectedWindowMinimized ?? false,
            "selectedWindowMinimizedReadable": selectedWindowMinimized != nil,
            "processAlive": processAlive,
            "passed": passed,
        ]
    }
}

private func observeFocus(pid: pid_t, application: NSRunningApplication, window: AXUIElement) -> FocusObservation {
    let system = AXUIElementCreateSystemWide()
    let systemReadBefore = axElementRead(system, kAXFocusedApplicationAttribute as CFString)
    let systemPidBefore = axElementPid(systemReadBefore.element)
    let frontmostPidBefore = NSWorkspace.shared.frontmostApplication?.processIdentifier
    let applicationActive = application.isActive
    let app = AXUIElementCreateApplication(pid)
    let focusedWindow = axElement(app, kAXFocusedWindowAttribute as CFString)
    let focusedWindowPid = axElementPid(focusedWindow)
    let selectedWindowPid = axElementPid(window)
    let minimized = axBool(window, kAXMinimizedAttribute as CFString)
    let frontmostPidAfter = NSWorkspace.shared.frontmostApplication?.processIdentifier
    let systemReadAfter = axElementRead(system, kAXFocusedApplicationAttribute as CFString)
    let systemPidAfter = axElementPid(systemReadAfter.element)
    return FocusObservation(
        applicationActive: applicationActive,
        systemFocusedApplicationPidBefore: systemPidBefore,
        systemFocusedApplicationPidAfter: systemPidAfter,
        systemFocusedApplicationErrorBefore: systemReadBefore.error,
        systemFocusedApplicationErrorAfter: systemReadAfter.error,
        frontmostApplicationPidBefore: frontmostPidBefore,
        frontmostApplicationPidAfter: frontmostPidAfter,
        applicationFocusedWindowPid: focusedWindowPid,
        selectedWindowPid: selectedWindowPid,
        focusedWindowMatchesSelected: sameAxElement(focusedWindow, window),
        selectedWindowMinimized: minimized,
        processAlive: Darwin.kill(pid, 0) == 0
    )
}

private func waitForStableFocus(
    pid: pid_t,
    application: NSRunningApplication,
    window: AXUIElement,
    timeout: TimeInterval
) -> (passed: Bool, stablePassingSamples: Int, observation: FocusObservation) {
    let deadline = ProcessInfo.processInfo.systemUptime + timeout
    var stablePassingSamples = 0
    var lastObservation = observeFocus(pid: pid, application: application, window: window)
    repeat {
        lastObservation = observeFocus(pid: pid, application: application, window: window)
        stablePassingSamples = lastObservation.passed ? stablePassingSamples + 1 : 0
        if stablePassingSamples >= 3 {
            return (true, stablePassingSamples, lastObservation)
        }
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    } while ProcessInfo.processInfo.systemUptime < deadline
    return (false, stablePassingSamples, lastObservation)
}

@discardableResult
private func activate(pid: pid_t, titleContains: String? = nil) throws -> [String: Any] {
    guard let application = NSRunningApplication(processIdentifier: pid) else {
        throw InputError.failure("target PID has no NSRunningApplication")
    }
    let (window, index) = try selectWindow(pid: pid, titleContains: titleContains)
    guard axElementPid(window) == pid else {
        throw InputError.failure("selected AX window PID does not match the exact target")
    }
    guard axBool(window, kAXMinimizedAttribute as CFString) != nil else {
        throw InputError.failure("selected AX window minimized state is unreadable")
    }
    let existing = waitForStableFocus(pid: pid, application: application, window: window, timeout: 0.4)
    if existing.passed {
        return [
            "requestAccepted": false,
            "raiseAXError": AXError.success.rawValue,
            "selectedWindowIndex": index,
            "stablePassingSamples": existing.stablePassingSamples,
            "requiredChecksPassed": true,
            "observed": existing.observation.json,
        ]
    }
    // This helper is an explicitly authorized unattended QA driver. Modern
    // AppKit cooperative activation can decline while another app is active,
    // so also request the exact target application's writable AXFrontmost
    // state. The observations below, not either request, remain the proof.
    let unhideAccepted = !application.isHidden || application.unhide()
    let requestAccepted = application.activate(options: [])
    let applicationElement = AXUIElementCreateApplication(pid)
    var frontmostSettable = DarwinBoolean(false)
    let frontmostSettableError = AXUIElementIsAttributeSettable(
        applicationElement,
        kAXFrontmostAttribute as CFString,
        &frontmostSettable
    )
    let frontmostSetError = frontmostSettableError == .success && frontmostSettable.boolValue
        ? AXUIElementSetAttributeValue(
            applicationElement,
            kAXFrontmostAttribute as CFString,
            kCFBooleanTrue
        )
        : AXError.attributeUnsupported
    let raiseResult = AXUIElementPerformAction(window, kAXRaiseAction as CFString)
    let activated = waitForStableFocus(pid: pid, application: application, window: window, timeout: 5)
    guard activated.passed else {
        throw InputError.failure(
            "target application/window did not reach stable exact focus "
                + "(unhideAccepted=\(unhideAccepted), requestAccepted=\(requestAccepted), "
                + "frontmostSettableError=\(frontmostSettableError.rawValue), "
                + "frontmostSettable=\(frontmostSettable.boolValue), "
                + "frontmostSetError=\(frontmostSetError.rawValue), "
                + "raiseAXError=\(raiseResult.rawValue)): "
                + "\(activated.observation.json)"
        )
    }
    return [
        "unhideAccepted": unhideAccepted,
        "requestAccepted": requestAccepted,
        "frontmostSettableError": frontmostSettableError.rawValue,
        "frontmostSettable": frontmostSettable.boolValue,
        "frontmostSetError": frontmostSetError.rawValue,
        "raiseAXError": raiseResult.rawValue,
        "selectedWindowIndex": index,
        "stablePassingSamples": activated.stablePassingSamples,
        "requiredChecksPassed": true,
        "observed": activated.observation.json,
    ]
}

private func loginSessionEventSource() throws -> CGEventSource {
    guard let source = CGEventSource(stateID: .combinedSessionState) else {
        throw InputError.failure("failed to create login-session mouse event source")
    }
    source.localEventsSuppressionInterval = 0
    return source
}

private func postMouse(
    _ type: CGEventType,
    point: CGPoint,
    source: CGEventSource? = nil
) throws {
    guard let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left) else {
        throw InputError.failure("failed to create mouse event \(type.rawValue)")
    }
    event.post(tap: .cghidEventTap)
}

private func postDistinctMouseMove(to target: CGPoint, inside bounds: CGRect) throws {
    let interior = bounds.insetBy(dx: 1, dy: 1)
    let candidates = [
        CGPoint(x: target.x - 32, y: target.y),
        CGPoint(x: target.x + 32, y: target.y),
        CGPoint(x: target.x, y: target.y - 32),
        CGPoint(x: target.x, y: target.y + 32),
    ]
    guard interior.contains(target),
          let staging = candidates.first(where: { interior.contains($0) }) else {
        throw InputError.failure("could not derive a distinct in-window pointer move")
    }
    try postMouse(.mouseMoved, point: staging)
    Thread.sleep(forTimeInterval: 0.12)
    guard let stagedPointer = CGEvent(source: nil)?.location,
          hypot(stagedPointer.x - staging.x, stagedPointer.y - staging.y) <= 1.5 else {
        throw InputError.failure("pointer did not settle at the distinct in-window staging point")
    }
    try postMouse(.mouseMoved, point: target)
}

private func gestureStart(kind: String, frame: CGRect, edgeOffset: Double) throws -> CGPoint {
    switch kind {
    case "title": return CGPoint(x: frame.midX, y: frame.minY + min(14, max(6, frame.height * 0.03)))
    case "right": return CGPoint(x: frame.maxX + edgeOffset, y: frame.midY)
    case "bottom": return CGPoint(x: frame.midX, y: frame.maxY + edgeOffset)
    case "bottom-right": return CGPoint(x: frame.maxX + edgeOffset, y: frame.maxY + edgeOffset)
    default: throw InputError.usage("--kind must be title, right, bottom, or bottom-right")
    }
}

private func postTimedDragLeg(
    pid: pid_t,
    tracker: WindowPairTracker?,
    source: CGEventSource,
    kind: String,
    start: CGPoint,
    finish: CGPoint,
    durationMs: Double,
    steps: Int
) throws -> WindowPairResult {
    var pairResult = WindowPairResult()
    let stepDelay = durationMs / 1000 / Double(steps)
    let distance = hypot(finish.x - start.x, finish.y - start.y)
    let titleLatchProgress = kind == "title" && distance > 0
        ? min(1, titleDragMinimumLatchDistance / distance)
        : 0
    let useTitleLatch = kind == "title"
        && distance > titleDragMinimumLatchDistance
        && steps > 1
    for step in 1...steps {
        let linearProgress = Double(step) / Double(steps)
        let progress = useTitleLatch
            ? titleLatchProgress
                + (1 - titleLatchProgress) * Double(step - 1) / Double(steps - 1)
            : linearProgress
        let point = CGPoint(
            x: start.x + (finish.x - start.x) * progress,
            y: start.y + (finish.y - start.y) * progress
        )
        try postMouse(
            .leftMouseDragged,
            point: point,
            source: source
        )
        Thread.sleep(forTimeInterval: stepDelay)
        sampleWindowPair(pid: pid, tracker: tracker, result: &pairResult)
    }
    return pairResult
}

private func runDrag(pid: pid_t, options: Options) throws -> [String: Any] {
    try activate(pid: pid, titleContains: options.titleContains)
    let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
    let before = try frameOf(window)
    let pairTracker = createWindowPairTracker(pid: pid, parentAxFrame: before)
    let start = try gestureStart(kind: options.kind ?? "", frame: before, edgeOffset: options.edgeOffset)
    let finish = CGPoint(x: start.x + options.dx, y: start.y + options.dy)
    let eventSource = try loginSessionEventSource()
    let originalPointer = CGEvent(source: nil)?.location
    var mouseDown = false
    var pointerRestoreCompleted = false
    defer {
        if mouseDown {
            try? postMouse(
                .leftMouseUp,
                point: finish,
                source: eventSource
            )
        }
        if options.restorePointer, !pointerRestoreCompleted, let originalPointer {
            try? postMouse(.mouseMoved, point: originalPointer, source: eventSource)
        }
    }

    try postMouse(.mouseMoved, point: start, source: eventSource)
    Thread.sleep(forTimeInterval: 0.08)
    try postMouse(
        .leftMouseDown,
        point: start,
        source: eventSource
    )
    mouseDown = true
    if options.kind == "title" {
        Thread.sleep(forTimeInterval: titleDragMouseDownLatchSeconds)
    }
    var pairResult = try postTimedDragLeg(
        pid: pid,
        tracker: pairTracker,
        source: eventSource,
        kind: options.kind ?? "",
        start: start,
        finish: finish,
        durationMs: options.durationMs,
        steps: options.steps
    )
    try postMouse(
        .leftMouseUp,
        point: finish,
        source: eventSource
    )
    mouseDown = false
    Thread.sleep(forTimeInterval: 0.3)
    sampleWindowPair(pid: pid, tracker: pairTracker, result: &pairResult)
    let after = try frameOf(window)
    var pointerRestored = !options.restorePointer
    if options.restorePointer, let originalPointer {
        try postMouse(.mouseMoved, point: originalPointer, source: eventSource)
        pointerRestoreCompleted = true
        Thread.sleep(forTimeInterval: 0.08)
        if let observedPointer = CGEvent(source: nil)?.location {
            pointerRestored = hypot(observedPointer.x - originalPointer.x, observedPointer.y - originalPointer.y) <= 1.5
        }
    }
    return [
        "schemaVersion": 1,
        "kind": options.kind ?? "",
        "before": rectDictionary(before),
        "after": rectDictionary(after),
        "start": ["x": start.x, "y": start.y],
        "finish": ["x": finish.x, "y": finish.y],
        "durationMs": options.durationMs,
        "steps": options.steps,
        "edgeOffset": options.edgeOffset,
        "mouseUpPosted": true,
        "pointerRestored": pointerRestored,
        "pairTrackingReady": pairTracker != nil,
        "pairSampleCount": pairResult.sampleCount,
        "pairMissingSampleCount": pairResult.missingSampleCount,
        "pairMismatchCount": pairResult.mismatchCount,
        "maxPairDelta": pairResult.maxDelta,
    ]
}

private func runChildClick(pid: pid_t, options: Options) throws -> [String: Any] {
    // Initialize AppKit for NSWindow's global mouse-down hit test without
    // activating this helper or changing the target application's focus.
    _ = NSApplication.shared
    let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
    guard let application = NSRunningApplication(processIdentifier: pid) else {
        throw InputError.failure("target PID has no NSRunningApplication")
    }
    let focused = waitForStableFocus(
        pid: pid,
        application: application,
        window: window,
        timeout: 0.2
    )
    guard focused.passed else {
        throw InputError.failure("target application/window is not already stably focused")
    }
    let pair = try requireOwnedWindowPair(pid: pid, parentAxFrame: try frameOf(window))
    let child = pair.child
    let point = CGPoint(
        x: child.bounds.maxX - options.xFromRight,
        y: child.bounds.minY + options.yFromTop
    )
    guard child.bounds.insetBy(dx: 1, dy: 1).contains(point) else {
        throw InputError.failure("requested click is outside the attached child")
    }

    let originalPointer = CGEvent(source: nil)?.location
    var mouseDown = false
    var pointerRestoreCompleted = false
    defer {
        if mouseDown { try? postMouse(.leftMouseUp, point: point) }
        if !pointerRestoreCompleted, let originalPointer { try? postMouse(.mouseMoved, point: originalPointer) }
    }
    try postMouse(.mouseMoved, point: point)
    Thread.sleep(forTimeInterval: 0.08)

    let currentPair = try requireOwnedWindowPair(pid: pid, tracker: pair.tracker)
    var pairResult = WindowPairResult()
    sampleWindowPair(pid: pid, tracker: pair.tracker, result: &pairResult)
    let pairStable = pairResult.missingSampleCount == 0 && pairResult.mismatchCount == 0
    guard pairStable else {
        throw InputError.failure("attached Steam overlay child/parent pair changed before click")
    }
    let currentTarget = CGPoint(
        x: currentPair.child.bounds.maxX - options.xFromRight,
        y: currentPair.child.bounds.minY + options.yFromTop
    )
    guard let observedPointerEvent = CGEvent(source: nil) else {
        throw InputError.failure("could not read pointer before attached-child click")
    }
    let observedPointer = observedPointerEvent.location
    let pointerAtTarget = hypot(
        observedPointer.x - currentTarget.x,
        observedPointer.y - currentTarget.y
    ) <= 1.5 && currentPair.child.bounds.insetBy(dx: 1, dy: 1).contains(observedPointer)
    guard pointerAtTarget else {
        throw InputError.failure("pointer did not reach the exact attached child click target")
    }
    let focusBeforeMouseDown = observeFocus(pid: pid, application: application, window: window)
    guard focusBeforeMouseDown.passed else {
        throw InputError.failure("target application/window lost focus before attached-child click")
    }
    let appKitPoint = observedPointerEvent.unflippedLocation
    let hitWindowNumber = NSWindow.windowNumber(
        at: appKitPoint,
        belowWindowWithWindowNumber: 0
    )
    let hitTestWindowNumberMatchesChild = hitWindowNumber == currentPair.child.number
    guard hitTestWindowNumberMatchesChild else {
        throw InputError.failure("attached Steam overlay child is not the mouse-down hit-test target")
    }

    try postMouse(.leftMouseDown, point: point)
    mouseDown = true
    Thread.sleep(forTimeInterval: 0.08)
    try postMouse(.leftMouseUp, point: point)
    mouseDown = false
    Thread.sleep(forTimeInterval: 0.2)

    var pointerRestored = false
    if let originalPointer {
        try postMouse(.mouseMoved, point: originalPointer)
        pointerRestoreCompleted = true
        Thread.sleep(forTimeInterval: 0.08)
        if let observedPointer = CGEvent(source: nil)?.location {
            pointerRestored = hypot(observedPointer.x - originalPointer.x, observedPointer.y - originalPointer.y) <= 1.5
        }
    }
    return [
        "schemaVersion": 1,
        "targetedAttachedChild": hitTestWindowNumberMatchesChild,
        "pairStable": pairStable,
        "pointerAtTarget": pointerAtTarget,
        "hitTestWindowNumberMatchesChild": hitTestWindowNumberMatchesChild,
        "leftMouseDownPosted": true,
        "leftMouseUpPosted": true,
        "pointerRestored": pointerRestored,
        "xFromRight": options.xFromRight,
        "yFromTop": options.yFromTop,
    ]
}

private func runChildMove(pid: pid_t, options: Options) throws -> [String: Any] {
    try activate(pid: pid, titleContains: options.titleContains)
    let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
    let pair = try requireOwnedWindowPair(pid: pid, parentAxFrame: try frameOf(window))
    let target = CGPoint(
        x: pair.child.bounds.maxX - options.xFromRight,
        y: pair.child.bounds.minY + options.yFromTop
    )
    guard pair.child.bounds.insetBy(dx: 1, dy: 1).contains(target) else {
        throw InputError.failure("requested relative move is outside the attached child")
    }

    var pairResult = WindowPairResult()
    sampleWindowPair(pid: pid, tracker: pair.tracker, result: &pairResult)
    guard pairResult.mismatchCount == 0 else {
        throw InputError.failure("attached Steam overlay child/parent pair was unstable before pointer move")
    }
    try postDistinctMouseMove(to: target, inside: pair.child.bounds)
    Thread.sleep(forTimeInterval: 0.12)

    let currentPair = try requireOwnedWindowPair(pid: pid, tracker: pair.tracker)
    sampleWindowPair(pid: pid, tracker: pair.tracker, result: &pairResult)
    guard pairResult.missingSampleCount == 0, pairResult.mismatchCount == 0 else {
        throw InputError.failure("attached Steam overlay child/parent pair changed during pointer move")
    }
    guard let observed = CGEvent(source: nil)?.location,
          hypot(observed.x - target.x, observed.y - target.y) <= 1.5,
          currentPair.child.bounds.insetBy(dx: 1, dy: 1).contains(observed) else {
        throw InputError.failure("pointer did not reach the exact attached child target")
    }
    return [
        "schemaVersion": 1,
        "target": "attached-child",
        "targetedAttachedChild": true,
        "pointerMoved": true,
        "pointerAtTarget": true,
        "pointerLeftInTargetRegion": true,
        "pairTrackingReady": true,
        "pairSampleCount": pairResult.sampleCount,
        "pairMissingSampleCount": pairResult.missingSampleCount,
        "pairMismatchCount": pairResult.mismatchCount,
        "xFromRight": options.xFromRight,
        "yFromTop": options.yFromTop,
    ]
}

private func runTitleMove(pid: pid_t, options: Options) throws -> [String: Any] {
    try activate(pid: pid, titleContains: options.titleContains)
    let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
    let pair = try requireOwnedWindowPair(pid: pid, parentAxFrame: try frameOf(window))

    // Use only the top band proven to belong to the parent and to sit above the
    // attached child. The horizontal center avoids macOS traffic-light controls.
    let topChromeHeight = pair.child.bounds.minY - pair.parent.bounds.minY
    guard topChromeHeight > 4 else {
        throw InputError.failure("parent has no safe title/chrome band above the attached child")
    }
    let target = CGPoint(
        x: pair.parent.bounds.midX,
        y: pair.parent.bounds.minY + topChromeHeight / 2
    )
    guard pair.parent.bounds.insetBy(dx: 1, dy: 1).contains(target),
          !pair.child.bounds.contains(target) else {
        throw InputError.failure("derived title/chrome move is not parent-only")
    }

    var pairResult = WindowPairResult()
    sampleWindowPair(pid: pid, tracker: pair.tracker, result: &pairResult)
    guard pairResult.mismatchCount == 0 else {
        throw InputError.failure("attached Steam overlay child/parent pair was unstable before pointer move")
    }
    try postDistinctMouseMove(to: target, inside: pair.parent.bounds)
    Thread.sleep(forTimeInterval: 0.12)

    let currentPair = try requireOwnedWindowPair(pid: pid, tracker: pair.tracker)
    sampleWindowPair(pid: pid, tracker: pair.tracker, result: &pairResult)
    guard pairResult.missingSampleCount == 0, pairResult.mismatchCount == 0 else {
        throw InputError.failure("attached Steam overlay child/parent pair changed during pointer move")
    }
    guard let observed = CGEvent(source: nil)?.location,
          hypot(observed.x - target.x, observed.y - target.y) <= 1.5,
          currentPair.parent.bounds.insetBy(dx: 1, dy: 1).contains(observed),
          !currentPair.child.bounds.contains(observed) else {
        throw InputError.failure("pointer did not reach the exact parent title/chrome target")
    }
    return [
        "schemaVersion": 1,
        "target": "parent-title",
        "targetedParentTitle": true,
        "pointerMoved": true,
        "pointerAtTarget": true,
        "pointerLeftInTargetRegion": true,
        "pairTrackingReady": true,
        "pairSampleCount": pairResult.sampleCount,
        "pairMissingSampleCount": pairResult.missingSampleCount,
        "pairMismatchCount": pairResult.mismatchCount,
    ]
}

private func keySequence(_ shortcut: String) throws -> [(CGKeyCode, Bool, CGEventFlags)] {
    let command = CGEventFlags.maskCommand
    let commandShift: CGEventFlags = [.maskCommand, .maskShift]
    let controlCommand: CGEventFlags = [.maskControl, .maskCommand]
    switch shortcut {
    case "cmd-m": return [(55, true, command), (46, true, command), (46, false, command), (55, false, [])]
    case "cmd-h": return [(55, true, command), (4, true, command), (4, false, command), (55, false, [])]
    case "cmd-tab": return [(55, true, command), (48, true, command), (48, false, command), (55, false, [])]
    case "cmd-shift-o":
        return [
            (56, true, .maskShift),
            (55, true, commandShift),
            (31, true, commandShift),
            (31, false, commandShift),
            (55, false, .maskShift),
            (56, false, []),
        ]
    case "escape": return [(53, true, []), (53, false, [])]
    case "ctrl-cmd-f":
        return [
            (59, true, .maskControl),
            (55, true, controlCommand),
            (3, true, controlCommand),
            (3, false, controlCommand),
            (55, false, .maskControl),
            (59, false, []),
        ]
    default: throw InputError.usage("unsupported shortcut: \(shortcut)")
    }
}

private func postShortcut(_ shortcut: String) throws {
    for (keyCode, keyDown, flags) in try keySequence(shortcut) {
        guard let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: keyDown) else {
            throw InputError.failure("failed to create keyboard event")
        }
        event.flags = flags
        event.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.04)
    }
}

private func descendants(_ element: AXUIElement, depth: Int = 0) -> [AXUIElement] {
    guard depth < 12 else { return [] }
    let children = axElements(element, kAXChildrenAttribute as CFString)
    return children + children.flatMap { descendants($0, depth: depth + 1) }
}

private func pressMenu(pid: pid_t, menuLabel: String, itemLabel: String) throws {
    try activate(pid: pid)
    let app = AXUIElementCreateApplication(pid)
    guard let menuBar = axValue(app, kAXMenuBarAttribute as CFString) as! AXUIElement? else {
        throw InputError.failure("target application has no AX menu bar")
    }
    guard let menu = descendants(menuBar).first(where: {
        axString($0, kAXRoleAttribute as CFString) == (kAXMenuBarItemRole as String)
            && axString($0, kAXTitleAttribute as CFString) == menuLabel
    }) else {
        throw InputError.failure("menu not found: \(menuLabel)")
    }
    guard AXUIElementPerformAction(menu, kAXPressAction as CFString) == .success else {
        throw InputError.failure("failed to open menu: \(menuLabel)")
    }
    let deadline = Date().addingTimeInterval(5)
    var item: AXUIElement?
    repeat {
        item = descendants(menu).first(where: {
            axString($0, kAXRoleAttribute as CFString) == (kAXMenuItemRole as String)
                && axString($0, kAXTitleAttribute as CFString) == itemLabel
        })
        if item == nil { Thread.sleep(forTimeInterval: 0.05) }
    } while item == nil && Date() < deadline
    guard let item else { throw InputError.failure("menu item not found: \(menuLabel) > \(itemLabel)") }
    guard AXUIElementPerformAction(item, kAXPressAction as CFString) == .success else {
        throw InputError.failure("failed to press menu item: \(menuLabel) > \(itemLabel)")
    }
}

private func windowButton(_ window: AXUIElement, action: String) throws -> AXUIElement {
    let attribute: CFString
    switch action {
    case "zoom": attribute = kAXZoomButtonAttribute as CFString
    case "minimize": attribute = kAXMinimizeButtonAttribute as CFString
    case "close": attribute = kAXCloseButtonAttribute as CFString
    default: throw InputError.usage("--action must be zoom, minimize, or close")
    }
    guard let button = axValue(window, attribute) as! AXUIElement? else {
        throw InputError.failure("target window has no \(action) button")
    }
    return button
}

private func writeJson(_ value: Any) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

private func main() -> Int32 {
    do {
        let arguments = Array(CommandLine.arguments.dropFirst())
        guard let command = arguments.first else { throw InputError.usage(usage()) }
        if ["--help", "-h", "help"].contains(command) {
            print(usage())
            return 0
        }
        let options = try parseOptions(Array(arguments.dropFirst()))
        switch command {
        case "preflight":
            try writeJson([
                "schemaVersion": 1,
                "accessibilityTrusted": AXIsProcessTrusted(),
                "screenCaptureGranted": CGPreflightScreenCaptureAccess(),
            ])
        case "pointer":
            let point = CGEvent(source: nil)?.location ?? .zero
            try writeJson(["schemaVersion": 1, "pointer": ["x": point.x, "y": point.y]])
        case "snapshot":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            try writeJson(try snapshot(pid: pid, titleContains: options.titleContains))
        case "drag":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            try writeJson(try runDrag(pid: pid, options: options))
        case "click-child":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            try writeJson(try runChildClick(pid: pid, options: options))
        case "move-child":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            try writeJson(try runChildMove(pid: pid, options: options))
        case "move-title":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            try writeJson(try runTitleMove(pid: pid, options: options))
        case "key":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            try activate(pid: pid, titleContains: options.titleContains)
            guard let shortcut = options.shortcut else { throw InputError.usage("key requires --shortcut") }
            try postShortcut(shortcut)
            try writeJson(["schemaVersion": 1, "pid": pid, "shortcut": shortcut, "posted": true])
        case "focus":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            let activation = try activate(pid: pid, titleContains: options.titleContains)
            try writeJson(["schemaVersion": 1, "pid": pid, "activated": true, "activation": activation])
        case "focus-bundle":
            try requireTrusted()
            guard let bundleId = options.bundleId else {
                throw InputError.usage("focus-bundle requires --bundle-id")
            }
            let applications = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId)
            guard !applications.isEmpty else { throw InputError.failure("bundle is not running") }
            guard applications.count == 1, let application = applications.first else {
                throw InputError.failure("bundle maps to multiple running applications")
            }
            let activation = try activate(pid: application.processIdentifier, titleContains: options.titleContains)
            try writeJson(["schemaVersion": 1, "bundleId": bundleId, "activated": true, "activation": activation])
        case "menu":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            guard let menu = options.menu, let item = options.item else { throw InputError.usage("menu requires --menu and --item") }
            try pressMenu(pid: pid, menuLabel: menu, itemLabel: item)
            try writeJson(["schemaVersion": 1, "pid": pid, "menu": menu, "item": item, "pressed": true])
        case "window-action":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
            guard let action = options.action else { throw InputError.usage("window-action requires --action") }
            let button = try windowButton(window, action: action)
            guard AXUIElementPerformAction(button, kAXPressAction as CFString) == .success else {
                throw InputError.failure("failed to press \(action) window button")
            }
            try writeJson(["schemaVersion": 1, "pid": pid, "action": action, "pressed": true])
        case "set-minimized":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
            guard let minimized = options.minimized else { throw InputError.usage("set-minimized requires --minimized") }
            let result = AXUIElementSetAttributeValue(window, kAXMinimizedAttribute as CFString, minimized as CFBoolean)
            guard result == .success else { throw InputError.failure("failed to set minimized state: \(result.rawValue)") }
            try writeJson(["schemaVersion": 1, "pid": pid, "minimized": minimized])
        case "set-frame":
            try requireTrusted()
            let pid = try requireLivePid(options.pid)
            let (window, _) = try selectWindow(pid: pid, titleContains: options.titleContains)
            guard let frame = options.frame else { throw InputError.usage("set-frame requires --frame") }
            try setAxPoint(window, kAXPositionAttribute as CFString, frame.origin)
            try setAxSize(window, kAXSizeAttribute as CFString, frame.size)
            Thread.sleep(forTimeInterval: 0.25)
            try writeJson([
                "schemaVersion": 1,
                "pid": pid,
                "requested": rectDictionary(frame),
                "observed": rectDictionary(try frameOf(window)),
            ])
        default:
            throw InputError.usage("unknown command: \(command)\n\n\(usage())")
        }
        return 0
    } catch {
        FileHandle.standardError.write(Data("macOS window input: \(error)\n".utf8))
        return error is InputError ? 2 : 1
    }
}

exit(main())
