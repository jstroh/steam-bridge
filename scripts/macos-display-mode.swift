#!/usr/bin/env swift

import CoreGraphics
import Darwin
import Foundation

private let schemaVersion = 1
private let refreshTolerance = 0.06

private struct DisplayModeRecord: Codable, Equatable {
    let id: Int32
    let logicalWidth: Int
    let logicalHeight: Int
    let pixelWidth: Int
    let pixelHeight: Int
    let refreshRate: Double
    let usableForDesktopGui: Bool
    let ioFlags: UInt32

    init(_ mode: CGDisplayMode) {
        id = mode.ioDisplayModeID
        logicalWidth = mode.width
        logicalHeight = mode.height
        pixelWidth = mode.pixelWidth
        pixelHeight = mode.pixelHeight
        refreshRate = mode.refreshRate
        usableForDesktopGui = mode.isUsableForDesktopGUI()
        ioFlags = mode.ioFlags
    }
}

private struct DisplayRecord: Codable {
    let id: UInt32
    let main: Bool
    let builtIn: Bool
    let bounds: RectRecord
    let currentMode: DisplayModeRecord
    let modes: [DisplayModeRecord]
}

private struct RectRecord: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    init(_ rect: CGRect) {
        x = rect.origin.x
        y = rect.origin.y
        width = rect.size.width
        height = rect.size.height
    }
}

private struct InventoryRecord: Codable {
    let schemaVersion: Int
    let generatedAt: String
    let displays: [DisplayRecord]
}

private struct EnvironmentRecord: Codable {
    let schemaVersion: Int
    let displayId: UInt32
    let displayAsleep: Bool
}

private struct ControlRequest: Codable {
    let schemaVersion: Int
    let sequence: Int
    let token: String
    let modeId: Int32
}

private struct ControlResponse: Codable {
    let schemaVersion: Int
    let sequence: Int
    let token: String
    let requestedMode: DisplayModeRecord
    let observedMode: DisplayModeRecord
    let appliedAt: String
}

private struct JournalRecord: Codable {
    let schemaVersion: Int
    let state: String
    let updatedAt: String
    let helperPid: Int32
    let parentPid: Int32
    let displayId: UInt32
    let originalMode: DisplayModeRecord
    let requestedMode: DisplayModeRecord
    let observedMode: DisplayModeRecord?
    let childPid: Int32?
    let childExitCode: Int32?
    let displayRestored: Bool
    let failure: String?
}

private struct RunOptions {
    var display = "main"
    var logicalWidth: Int?
    var logicalHeight: Int?
    var pixelWidth: Int?
    var pixelHeight: Int?
    var refreshRate: Double?
    var modeId: Int32?
    var journalPath: String?
    var controlDirectory: String?
    var timeoutSeconds = 1800.0
    var command: [String] = []
}

private enum SupervisorError: Error, CustomStringConvertible {
    case usage(String)
    case coreGraphics(String, CGError)
    case failure(String)

    var description: String {
        switch self {
        case let .usage(message): return message
        case let .coreGraphics(operation, error): return "\(operation) failed with CGError \(error.rawValue)"
        case let .failure(message): return message
        }
    }
}

private let iso8601 = ISO8601DateFormatter()
private let encoder: JSONEncoder = {
    let value = JSONEncoder()
    value.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    return value
}()

private func usage() -> String {
    """
    Usage:
      macos-display-mode.swift list
      macos-display-mode.swift environment
      macos-display-mode.swift run [mode options] --journal PATH -- COMMAND [ARG ...]

    Mode options:
      --display main|ID
      --mode-id ID
      --logical WIDTHxHEIGHT
      --pixel WIDTHxHEIGHT
      --refresh HZ
      --control-directory PATH
      --timeout-seconds SECONDS

    The run command applies a public desktop-usable CGDisplayMode with an
    application-scoped CoreGraphics transaction, supervises COMMAND, restores
    the original mode, verifies restoration, and propagates COMMAND's status.
    When --control-directory is present, COMMAND may request temporary mode
    changes through the sequence-checked request/response protocol while this
    same helper remains the sole owner of the display transaction.
    """
}

private func parseSize(_ value: String, option: String) throws -> (Int, Int) {
    let parts = value.lowercased().split(separator: "x", omittingEmptySubsequences: false)
    guard parts.count == 2,
          let width = Int(parts[0]), width > 0,
          let height = Int(parts[1]), height > 0 else {
        throw SupervisorError.usage("\(option) requires WIDTHxHEIGHT")
    }
    return (width, height)
}

private func takeValue(_ arguments: [String], _ index: inout Int, option: String) throws -> String {
    index += 1
    guard index < arguments.count else {
        throw SupervisorError.usage("missing value for \(option)")
    }
    return arguments[index]
}

private func parseRunOptions(_ arguments: [String]) throws -> RunOptions {
    var options = RunOptions()
    var index = 0
    while index < arguments.count {
        let argument = arguments[index]
        if argument == "--" {
            options.command = Array(arguments.dropFirst(index + 1))
            break
        }
        switch argument {
        case "--display":
            options.display = try takeValue(arguments, &index, option: argument)
        case "--mode-id":
            let value = try takeValue(arguments, &index, option: argument)
            guard let parsed = Int32(value), parsed >= 0 else {
                throw SupervisorError.usage("--mode-id requires a non-negative integer")
            }
            options.modeId = parsed
        case "--logical":
            let size = try parseSize(try takeValue(arguments, &index, option: argument), option: argument)
            options.logicalWidth = size.0
            options.logicalHeight = size.1
        case "--pixel":
            let size = try parseSize(try takeValue(arguments, &index, option: argument), option: argument)
            options.pixelWidth = size.0
            options.pixelHeight = size.1
        case "--refresh":
            let value = try takeValue(arguments, &index, option: argument)
            guard let parsed = Double(value), parsed > 0, parsed <= 1000 else {
                throw SupervisorError.usage("--refresh requires a positive number")
            }
            options.refreshRate = parsed
        case "--journal":
            options.journalPath = try takeValue(arguments, &index, option: argument)
        case "--control-directory":
            options.controlDirectory = try takeValue(arguments, &index, option: argument)
        case "--timeout-seconds":
            let value = try takeValue(arguments, &index, option: argument)
            guard let parsed = Double(value), parsed > 0, parsed <= 86_400 else {
                throw SupervisorError.usage("--timeout-seconds must be in (0, 86400]")
            }
            options.timeoutSeconds = parsed
        default:
            throw SupervisorError.usage("unknown option: \(argument)")
        }
        index += 1
    }

    guard !options.command.isEmpty else {
        throw SupervisorError.usage("run requires -- COMMAND [ARG ...]")
    }
    guard let journalPath = options.journalPath, journalPath.hasPrefix("/") else {
        throw SupervisorError.usage("run requires an absolute --journal PATH")
    }
    if let controlDirectory = options.controlDirectory, !controlDirectory.hasPrefix("/") {
        throw SupervisorError.usage("--control-directory requires an absolute PATH")
    }
    if options.modeId == nil && options.logicalWidth == nil && options.refreshRate == nil {
        throw SupervisorError.usage("run requires --mode-id or a logical/refresh selector")
    }
    return options
}

private func onlineDisplays() throws -> [CGDirectDisplayID] {
    var count: UInt32 = 0
    var status = CGGetOnlineDisplayList(0, nil, &count)
    guard status == .success else {
        throw SupervisorError.coreGraphics("CGGetOnlineDisplayList(count)", status)
    }
    var displays = [CGDirectDisplayID](repeating: 0, count: Int(count))
    status = CGGetOnlineDisplayList(count, &displays, &count)
    guard status == .success else {
        throw SupervisorError.coreGraphics("CGGetOnlineDisplayList(values)", status)
    }
    return Array(displays.prefix(Int(count)))
}

private func allModes(_ display: CGDirectDisplayID) -> [CGDisplayMode] {
    let options = [kCGDisplayShowDuplicateLowResolutionModes: true] as CFDictionary
    return (CGDisplayCopyAllDisplayModes(display, options) as? [CGDisplayMode]) ?? []
}

private func currentMode(_ display: CGDirectDisplayID) throws -> CGDisplayMode {
    guard let mode = CGDisplayCopyDisplayMode(display) else {
        throw SupervisorError.failure("display \(display) has no current mode")
    }
    return mode
}

private func inventory() throws -> InventoryRecord {
    let records = try onlineDisplays().map { display -> DisplayRecord in
        let modes = allModes(display)
            .map(DisplayModeRecord.init)
            .sorted {
                ($0.logicalWidth, $0.logicalHeight, $0.pixelWidth, $0.pixelHeight, $0.refreshRate, $0.id)
                    < ($1.logicalWidth, $1.logicalHeight, $1.pixelWidth, $1.pixelHeight, $1.refreshRate, $1.id)
            }
        return DisplayRecord(
            id: display,
            main: CGDisplayIsMain(display) != 0,
            builtIn: CGDisplayIsBuiltin(display) != 0,
            bounds: RectRecord(CGDisplayBounds(display)),
            currentMode: DisplayModeRecord(try currentMode(display)),
            modes: modes
        )
    }
    return InventoryRecord(schemaVersion: schemaVersion, generatedAt: iso8601.string(from: Date()), displays: records)
}

private func resolveDisplay(_ selector: String) throws -> CGDirectDisplayID {
    let displays = try onlineDisplays()
    if selector == "main" {
        let display = CGMainDisplayID()
        guard displays.contains(display) else {
            throw SupervisorError.failure("main display is not online")
        }
        return display
    }
    guard let id = UInt32(selector), displays.contains(id) else {
        throw SupervisorError.failure("display \(selector) is not online")
    }
    return id
}

private func modeMatches(_ mode: CGDisplayMode, _ options: RunOptions) -> Bool {
    if !mode.isUsableForDesktopGUI() { return false }
    if let id = options.modeId, mode.ioDisplayModeID != id { return false }
    if let width = options.logicalWidth, mode.width != width { return false }
    if let height = options.logicalHeight, mode.height != height { return false }
    if let width = options.pixelWidth, mode.pixelWidth != width { return false }
    if let height = options.pixelHeight, mode.pixelHeight != height { return false }
    if let refresh = options.refreshRate, abs(mode.refreshRate - refresh) > refreshTolerance { return false }
    return true
}

private func resolveMode(_ display: CGDirectDisplayID, _ options: RunOptions) throws -> CGDisplayMode {
    let matches = allModes(display).filter { modeMatches($0, options) }
    guard matches.count == 1, let mode = matches.first else {
        let descriptions = matches.map { DisplayModeRecord($0) }
        let encoded = (try? String(data: encoder.encode(descriptions), encoding: .utf8)) ?? "[]"
        throw SupervisorError.failure("mode selector matched \(matches.count) modes: \(encoded)")
    }
    return mode
}

private func applyMode(_ display: CGDirectDisplayID, _ mode: CGDisplayMode) throws {
    var configuration: CGDisplayConfigRef?
    var status = CGBeginDisplayConfiguration(&configuration)
    guard status == .success, let configuration else {
        throw SupervisorError.coreGraphics("CGBeginDisplayConfiguration", status)
    }
    status = CGConfigureDisplayWithDisplayMode(configuration, display, mode, nil)
    guard status == .success else {
        CGCancelDisplayConfiguration(configuration)
        throw SupervisorError.coreGraphics("CGConfigureDisplayWithDisplayMode", status)
    }
    status = CGCompleteDisplayConfiguration(configuration, .forAppOnly)
    guard status == .success else {
        throw SupervisorError.coreGraphics("CGCompleteDisplayConfiguration(forAppOnly)", status)
    }
}

private func modesMatch(_ actual: CGDisplayMode, _ expected: CGDisplayMode) -> Bool {
    actual.ioDisplayModeID == expected.ioDisplayModeID
        && actual.width == expected.width
        && actual.height == expected.height
        && actual.pixelWidth == expected.pixelWidth
        && actual.pixelHeight == expected.pixelHeight
        && abs(actual.refreshRate - expected.refreshRate) <= refreshTolerance
}

private func observedMode(
    _ display: CGDirectDisplayID,
    matching expected: CGDisplayMode,
    timeoutSeconds: Double = 8
) throws -> CGDisplayMode {
    let deadline = Date().addingTimeInterval(timeoutSeconds)
    repeat {
        let current = try currentMode(display)
        if modesMatch(current, expected) {
            return current
        }
        Thread.sleep(forTimeInterval: 0.1)
    } while Date() < deadline
    throw SupervisorError.failure(
        "display mode verification failed: expected \(DisplayModeRecord(expected)), observed \(DisplayModeRecord(try currentMode(display)))"
    )
}

private func ensureMode(_ display: CGDirectDisplayID, _ expected: CGDisplayMode) throws -> CGDisplayMode {
    let current = try currentMode(display)
    if modesMatch(current, expected) { return current }
    do {
        try applyMode(display, expected)
    } catch {
        // CoreGraphics can reject completion after the display has already
        // reached the requested mode. The observed public mode is authoritative
        // for restoration; accept only an exact identity match.
        if let observed = try? currentMode(display), modesMatch(observed, expected) {
            return observed
        }
        throw error
    }
    return try observedMode(display, matching: expected)
}

private func writeJournal(_ path: String, _ record: JournalRecord) throws {
    let url = URL(fileURLWithPath: path)
    let parent = url.deletingLastPathComponent()
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: parent.path, isDirectory: &isDirectory), isDirectory.boolValue else {
        throw SupervisorError.failure("journal parent directory does not exist: \(parent.path)")
    }
    if let attributes = try? FileManager.default.attributesOfItem(atPath: path),
       attributes[.type] as? FileAttributeType == .typeSymbolicLink {
        throw SupervisorError.failure("journal path must not be a symbolic link")
    }
    try encoder.encode(record).write(to: url, options: .atomic)
}

private func validateControlDirectory(_ path: String) throws {
    let attributes = try FileManager.default.attributesOfItem(atPath: path)
    guard attributes[.type] as? FileAttributeType == .typeDirectory else {
        throw SupervisorError.failure("control path must be a real directory")
    }
    guard try FileManager.default.contentsOfDirectory(atPath: path).isEmpty else {
        throw SupervisorError.failure("control directory must start empty")
    }
}

private func controlPath(_ directory: String, kind: String, sequence: Int) -> String {
    URL(fileURLWithPath: directory)
        .appendingPathComponent(String(format: "%@-%06d.json", kind, sequence))
        .path
}

private func readControlRequest(_ directory: String, sequence: Int) throws -> ControlRequest? {
    let path = controlPath(directory, kind: "request", sequence: sequence)
    guard FileManager.default.fileExists(atPath: path) else { return nil }
    let attributes = try FileManager.default.attributesOfItem(atPath: path)
    guard attributes[.type] as? FileAttributeType == .typeRegular else {
        throw SupervisorError.failure("control request must be a regular file")
    }
    let request = try JSONDecoder().decode(
        ControlRequest.self,
        from: Data(contentsOf: URL(fileURLWithPath: path))
    )
    let tokenIsHex = request.token.count == 32
        && request.token.allSatisfy { "0123456789abcdef".contains($0) }
    guard request.schemaVersion == schemaVersion,
          request.sequence == sequence,
          request.modeId >= 0,
          tokenIsHex else {
        throw SupervisorError.failure("invalid display control request")
    }
    return request
}

private func resolveMode(_ display: CGDirectDisplayID, modeId: Int32) throws -> CGDisplayMode {
    let matches = allModes(display).filter {
        $0.ioDisplayModeID == modeId && $0.isUsableForDesktopGUI()
    }
    guard matches.count == 1, let mode = matches.first else {
        throw SupervisorError.failure("display control mode ID matched \(matches.count) modes")
    }
    return mode
}

private func writeControlResponse(
    _ directory: String,
    request: ControlRequest,
    requested: CGDisplayMode,
    observed: CGDisplayMode
) throws {
    let path = controlPath(directory, kind: "response", sequence: request.sequence)
    guard !FileManager.default.fileExists(atPath: path) else {
        throw SupervisorError.failure("display control response already exists")
    }
    let response = ControlResponse(
        schemaVersion: schemaVersion,
        sequence: request.sequence,
        token: request.token,
        requestedMode: DisplayModeRecord(requested),
        observedMode: DisplayModeRecord(observed),
        appliedAt: iso8601.string(from: Date())
    )
    try encoder.encode(response).write(to: URL(fileURLWithPath: path), options: .atomic)
}

private func journal(
    state: String,
    parentPid: Int32,
    display: CGDirectDisplayID,
    original: CGDisplayMode,
    requested: CGDisplayMode,
    observed: CGDisplayMode? = nil,
    childPid: Int32? = nil,
    childExitCode: Int32? = nil,
    restored: Bool = false,
    failure: String? = nil
) -> JournalRecord {
    JournalRecord(
        schemaVersion: schemaVersion,
        state: state,
        updatedAt: iso8601.string(from: Date()),
        helperPid: getpid(),
        parentPid: parentPid,
        displayId: display,
        originalMode: DisplayModeRecord(original),
        requestedMode: DisplayModeRecord(requested),
        observedMode: observed.map(DisplayModeRecord.init),
        childPid: childPid,
        childExitCode: childExitCode,
        displayRestored: restored,
        failure: failure
    )
}

private func terminate(_ process: Process) {
    guard process.isRunning else { return }
    process.terminate()
    let deadline = Date().addingTimeInterval(3)
    while process.isRunning && Date() < deadline {
        Thread.sleep(forTimeInterval: 0.05)
    }
    if process.isRunning {
        Darwin.kill(process.processIdentifier, SIGKILL)
    }
}

private func runSupervised(_ options: RunOptions) throws -> Int32 {
    let display = try resolveDisplay(options.display)
    let original = try currentMode(display)
    let requested = try resolveMode(display, options)
    let journalPath = options.journalPath!
    if let controlDirectory = options.controlDirectory {
        try validateControlDirectory(controlDirectory)
    }
    let parentPid = getppid()
    try writeJournal(journalPath, journal(
        state: "prepared",
        parentPid: parentPid,
        display: display,
        original: original,
        requested: requested
    ))

    var child: Process?
    var childExitCode: Int32?
    var operationFailure: Error?
    var restorationAttempted = false
    defer {
        if !restorationAttempted {
            if let child { terminate(child) }
            // Last-ditch best effort. The application-scoped configuration also
            // reverts when this helper exits, including SIGKILL/crash paths.
            _ = try? ensureMode(display, original)
        }
    }

    do {
        let applied = try ensureMode(display, requested)
        try writeJournal(journalPath, journal(
            state: "mode-applied",
            parentPid: parentPid,
            display: display,
            original: original,
            requested: requested,
            observed: applied
        ))

        let process = Process()
        process.executableURL = URL(fileURLWithPath: options.command[0])
        process.arguments = Array(options.command.dropFirst())
        process.standardInput = FileHandle.standardInput
        process.standardOutput = FileHandle.standardOutput
        process.standardError = FileHandle.standardError
        try process.run()
        child = process
        try writeJournal(journalPath, journal(
            state: "child-running",
            parentPid: parentPid,
            display: display,
            original: original,
            requested: requested,
            observed: applied,
            childPid: process.processIdentifier
        ))

        let deadline = Date().addingTimeInterval(options.timeoutSeconds)
        var terminationReason: String?
        var nextControlSequence = 1
        while process.isRunning {
            if getppid() != parentPid || Darwin.kill(parentPid, 0) != 0 {
                terminationReason = "supervisor parent exited"
                break
            }
            if Date() >= deadline {
                terminationReason = "supervised command timed out after \(options.timeoutSeconds) seconds"
                break
            }
            if let controlDirectory = options.controlDirectory,
               let request = try readControlRequest(controlDirectory, sequence: nextControlSequence) {
                let controlledMode = try resolveMode(display, modeId: request.modeId)
                let controlledObserved = try ensureMode(display, controlledMode)
                try writeControlResponse(
                    controlDirectory,
                    request: request,
                    requested: controlledMode,
                    observed: controlledObserved
                )
                nextControlSequence += 1
            }
            Thread.sleep(forTimeInterval: 0.05)
        }
        if let terminationReason {
            terminate(process)
            throw SupervisorError.failure(terminationReason)
        }
        process.waitUntilExit()
        childExitCode = process.terminationStatus
    } catch {
        operationFailure = error
    }

    if let child { terminate(child) }
    restorationAttempted = true
    do {
        let observed = try ensureMode(display, original)
        let state: String
        if operationFailure != nil {
            state = "failed"
        } else if childExitCode == 0 {
            state = "complete"
        } else {
            state = "child-failed"
        }
        try writeJournal(journalPath, journal(
            state: state,
            parentPid: parentPid,
            display: display,
            original: original,
            requested: requested,
            observed: observed,
            childPid: child?.processIdentifier,
            childExitCode: childExitCode,
            restored: true,
            failure: operationFailure.map(String.init(describing:))
        ))
    } catch {
        let combined = [operationFailure.map(String.init(describing:)), "restore failed: \(error)"]
            .compactMap { $0 }
            .joined(separator: "; ")
        try? writeJournal(journalPath, journal(
            state: "restore-failed",
            parentPid: parentPid,
            display: display,
            original: original,
            requested: requested,
            childPid: child?.processIdentifier,
            childExitCode: childExitCode,
            restored: false,
            failure: combined
        ))
        throw SupervisorError.failure(combined)
    }

    if let operationFailure { throw operationFailure }
    return childExitCode ?? 1
}

private func main() -> Int32 {
    do {
        let arguments = Array(CommandLine.arguments.dropFirst())
        guard let command = arguments.first else {
            throw SupervisorError.usage(usage())
        }
        switch command {
        case "list":
            guard arguments.count == 1 else {
                throw SupervisorError.usage("list takes no arguments")
            }
            FileHandle.standardOutput.write(try encoder.encode(inventory()))
            FileHandle.standardOutput.write(Data("\n".utf8))
            return 0
        case "environment":
            guard arguments.count == 1 else {
                throw SupervisorError.usage("environment takes no arguments")
            }
            let displayId = CGMainDisplayID()
            let record = EnvironmentRecord(
                schemaVersion: schemaVersion,
                displayId: displayId,
                displayAsleep: CGDisplayIsAsleep(displayId) != 0
            )
            FileHandle.standardOutput.write(try encoder.encode(record))
            FileHandle.standardOutput.write(Data("\n".utf8))
            return 0
        case "run":
            return try runSupervised(parseRunOptions(Array(arguments.dropFirst())))
        case "--help", "-h", "help":
            print(usage())
            return 0
        default:
            throw SupervisorError.usage("unknown command: \(command)\n\n\(usage())")
        }
    } catch {
        FileHandle.standardError.write(Data("macOS display supervisor: \(error)\n".utf8))
        return error is SupervisorError ? 2 : 1
    }
}

exit(main())
