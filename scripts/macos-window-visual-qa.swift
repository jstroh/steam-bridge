#!/usr/bin/env swift

import AppKit
import CoreGraphics
import CoreMedia
import CoreVideo
import Dispatch
import Foundation
import ScreenCaptureKit

// Privacy boundary: this process never serializes pixels, window metadata,
// process identity, exact dimensions, titles, OCR, or spatial grids. Captures
// exist only long enough to produce the coarse normalized aggregates below.

private let schemaVersion = 1
private let allowedSlots: Set<String> = ["baseline", "overlay"]
private let planeLongEdge = 240
private let maximumNativeCaptureEdge = 4_096
private let maximumNativeCapturePixels = 18_000_000
private let comparisonWidth = 160
private let comparisonHeight = 100

private enum ClosedCode: String {
    case ok
    case invalidArguments = "invalid_arguments"
    case permissionMissing = "permission_missing"
    case windowUnavailable = "window_unavailable"
    case captureFailed = "capture_failed"
    case referenceMissing = "reference_missing"
}

private struct Pixel {
    let red: Double
    let green: Double
    let blue: Double
    let alpha: Double

    var luma: Double { 0.2126 * red + 0.7152 * green + 0.0722 * blue }
}

private struct PixelPlane {
    let width: Int
    let height: Int
    let pixels: [Pixel]

    func sample(_ u: Double, _ v: Double) -> Pixel {
        let x = min(width - 1, max(0, Int((u * Double(width)).rounded(.down))))
        let y = min(height - 1, max(0, Int((v * Double(height)).rounded(.down))))
        return pixels[y * width + x]
    }
}

private struct BoundarySignature {
    // Lane zero is the physical outer edge; the remaining lanes move inward.
    let right: [[Pixel]]
    let bottom: [[Pixel]]
}

private struct CapturedFrame {
    let plane: PixelPlane
    let boundary: BoundarySignature
}

private struct CapturedSample {
    let frame: CapturedFrame
    let source: [String: Any]
}

private struct FrameMetrics {
    let aspectRatio: Double
    let opaqueRatio: Double
    let lumaMean: Double
    let lumaStdDev: Double
    let blackRatio: Double
    let purpleRatio: Double
    let uniformRatio: Double
    let edgeDensity: Double
    let horizontalGradient: Double
    let verticalGradient: Double
    let structureAspect: Double
    let roundedCornerScore: Double
    let chromeBlackRatio: Double
    let chromePurpleRatio: Double
    let rightEdgeOpaqueRatio: Double
    let bottomEdgeOpaqueRatio: Double

    var blank: Bool {
        opaqueRatio > 0.78 && lumaStdDev < 0.022 && (blackRatio > 0.90 || lumaMean < 0.025)
    }

    var purpleCover: Bool {
        opaqueRatio > 0.78 && purpleRatio > 0.58 && uniformRatio > 0.35
    }

    var chromeCover: Bool {
        (chromeBlackRatio > 0.82 && blackRatio > 0.55 && lumaStdDev < 0.14)
            || (chromePurpleRatio > 0.78 && purpleRatio > 0.32)
    }

    func json() -> [String: Any] {
        [
            "aspectRatio": rounded(aspectRatio),
            "opaqueRatio": rounded(opaqueRatio),
            "lumaMean": rounded(lumaMean),
            "lumaStdDev": rounded(lumaStdDev),
            "blackRatio": rounded(blackRatio),
            "purpleRatio": rounded(purpleRatio),
            "uniformRatio": rounded(uniformRatio),
            "edgeDensity": rounded(edgeDensity),
            "horizontalGradient": rounded(horizontalGradient),
            "verticalGradient": rounded(verticalGradient),
            "structureAspect": rounded(structureAspect),
            "roundedCornerScore": rounded(roundedCornerScore),
            "chromeBlackRatio": rounded(chromeBlackRatio),
            "chromePurpleRatio": rounded(chromePurpleRatio),
            "rightEdgeOpaqueRatio": rounded(rightEdgeOpaqueRatio),
            "bottomEdgeOpaqueRatio": rounded(bottomEdgeOpaqueRatio),
        ]
    }
}

private struct DifferenceMetrics {
    let changedRatio: Double
    let meanDelta: Double
    let maxDelta: Double
    let coverageWidth: Double
    let coverageHeight: Double
    let coverageRightReach: Double
    let coverageBottomReach: Double
    let coverageTopStart: Double
    let chromeChangedRatio: Double
    let contentChangedRatio: Double
    let rightEdgeChangedRatio: Double
    let bottomEdgeChangedRatio: Double
    let aspectRatioDelta: Double
    let structureAspectDelta: Double
    let rightBoundaryChangedRatio: Double
    let rightInnerBoundaryChangedRatio: Double
    let rightBoundaryDrop: Double
    let bottomBoundaryChangedRatio: Double
    let bottomInnerBoundaryChangedRatio: Double
    let bottomBoundaryDrop: Double

    func json() -> [String: Any] {
        [
            "changedRatio": rounded(changedRatio),
            "meanDelta": rounded(meanDelta),
            "maxDelta": rounded(maxDelta),
            "coverageWidth": rounded(coverageWidth),
            "coverageHeight": rounded(coverageHeight),
            "coverageRightReach": rounded(coverageRightReach),
            "coverageBottomReach": rounded(coverageBottomReach),
            "coverageTopStart": rounded(coverageTopStart),
            "chromeChangedRatio": rounded(chromeChangedRatio),
            "contentChangedRatio": rounded(contentChangedRatio),
            "rightEdgeChangedRatio": rounded(rightEdgeChangedRatio),
            "bottomEdgeChangedRatio": rounded(bottomEdgeChangedRatio),
            "aspectRatioDelta": rounded(aspectRatioDelta),
            "structureAspectDelta": rounded(structureAspectDelta),
            "rightBoundaryChangedRatio": rounded(rightBoundaryChangedRatio),
            "rightInnerBoundaryChangedRatio": rounded(rightInnerBoundaryChangedRatio),
            "rightBoundaryDrop": rounded(rightBoundaryDrop),
            "bottomBoundaryChangedRatio": rounded(bottomBoundaryChangedRatio),
            "bottomInnerBoundaryChangedRatio": rounded(bottomInnerBoundaryChangedRatio),
            "bottomBoundaryDrop": rounded(bottomBoundaryDrop),
        ]
    }
}

private func rounded(_ value: Double, decimals: Double = 1_000) -> Double {
    guard value.isFinite else { return 0 }
    return (value * decimals).rounded() / decimals
}

private func clamp(_ value: Double, _ lower: Double = 0, _ upper: Double = 1) -> Double {
    min(upper, max(lower, value))
}

private func pixelDistance(_ left: Pixel, _ right: Pixel) -> Double {
    // Compare visible premultiplied color. Straight RGB is undefined at fully
    // transparent rounded edges, where unpremultiplication can amplify a
    // one-byte rounding difference into a false full-color flash.
    let red = left.red * left.alpha - right.red * right.alpha
    let green = left.green * left.alpha - right.green * right.alpha
    let blue = left.blue * left.alpha - right.blue * right.alpha
    let alpha = left.alpha - right.alpha
    return clamp(sqrt((red * red + green * green + blue * blue + alpha * alpha) / 4))
}

private func cursorDifference(
    withoutCursor: PixelPlane,
    withCursor: PixelPlane,
    normalizedX: Double,
    normalizedY: Double
) -> (changedRatio: Double, meanDelta: Double, maxDelta: Double) {
    guard withoutCursor.width == withCursor.width,
          withoutCursor.height == withCursor.height else {
        return (0, 0, 0)
    }
    let centerX = min(
        withoutCursor.width - 1,
        max(0, Int((clamp(normalizedX) * Double(withoutCursor.width)).rounded(.down)))
    )
    let centerY = min(
        withoutCursor.height - 1,
        max(0, Int((clamp(normalizedY) * Double(withoutCursor.height)).rounded(.down)))
    )
    // The normalized analysis plane intentionally keeps no native-resolution
    // pixels. A 48-point neighborhood is still large enough to contain every
    // supported system pointer at the app's tested scales.
    let radiusX = max(3, Int(ceil(Double(withoutCursor.width) * 48 / 640)))
    let radiusY = max(3, Int(ceil(Double(withoutCursor.height) * 48 / 480)))
    let minX = max(0, centerX - radiusX)
    let maxX = min(withoutCursor.width - 1, centerX + radiusX)
    let minY = max(0, centerY - radiusY)
    let maxY = min(withoutCursor.height - 1, centerY + radiusY)
    var changed = 0
    var count = 0
    var total = 0.0
    var maximum = 0.0
    for y in minY...maxY {
        for x in minX...maxX {
            let index = y * withoutCursor.width + x
            let delta = pixelDistance(withoutCursor.pixels[index], withCursor.pixels[index])
            if delta >= 0.045 { changed += 1 }
            total += delta
            maximum = max(maximum, delta)
            count += 1
        }
    }
    return (
        Double(changed) / Double(max(1, count)),
        total / Double(max(1, count)),
        maximum
    )
}

private func isPurple(_ pixel: Pixel) -> Bool {
    let high = max(pixel.red, pixel.blue)
    let low = min(pixel.red, pixel.blue)
    return pixel.alpha > 0.45
        && high > 0.18
        && low > 0.10
        && (pixel.red + pixel.blue) * 0.5 > pixel.green * 1.22 + 0.025
        && high - pixel.green > 0.08
}

private func decodedPixel(_ bytes: [UInt8], _ offset: Int) -> Pixel {
    let alpha = Double(bytes[offset + 3]) / 255
    let divisor = max(alpha, 1.0 / 255)
    return Pixel(
        red: clamp(Double(bytes[offset]) / 255 / divisor),
        green: clamp(Double(bytes[offset + 1]) / 255 / divisor),
        blue: clamp(Double(bytes[offset + 2]) / 255 / divisor),
        alpha: alpha
    )
}

private func makePlane(image: CGImage, aspectRatio: Double) throws -> PixelPlane {
    let safeAspect = min(4, max(0.25, aspectRatio))
    let width: Int
    let height: Int
    if safeAspect >= 1 {
        width = planeLongEdge
        height = max(64, Int((Double(planeLongEdge) / safeAspect).rounded()))
    } else {
        height = planeLongEdge
        width = max(64, Int((Double(planeLongEdge) * safeAspect).rounded()))
    }

    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
        throw ClosedCode.captureFailed
    }
    let created = bytes.withUnsafeMutableBytes { storage -> Bool in
        guard let context = CGContext(
            data: storage.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return false }
        context.clear(CGRect(x: 0, y: 0, width: width, height: height))
        // Continuous SCStream planes use nearest-neighbour center samples.
        // Keep one-shot references on the same explicit kernel so comparison
        // deltas cannot be created solely by two different resamplers.
        context.interpolationQuality = .none
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
    }
    guard created else { throw ClosedCode.captureFailed }

    var pixels = [Pixel]()
    pixels.reserveCapacity(width * height)
    for offset in stride(from: 0, to: bytes.count, by: 4) {
        pixels.append(decodedPixel(bytes, offset))
    }
    // The raw byte buffer is released here and never crosses the process boundary.
    return PixelPlane(width: width, height: height, pixels: pixels)
}

private func makeBoundarySignature(image: CGImage) throws -> BoundarySignature {
    let width = image.width
    let height = image.height
    guard width >= 8, height >= 8 else { throw ClosedCode.captureFailed }
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
        throw ClosedCode.captureFailed
    }
    let created = bytes.withUnsafeMutableBytes { storage -> Bool in
        guard let context = CGContext(
            data: storage.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return false }
        context.clear(CGRect(x: 0, y: 0, width: width, height: height))
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
    }
    guard created else { throw ClosedCode.captureFailed }

    let laneCount = 4
    let samples = 256
    var right = Array(repeating: [Pixel](), count: laneCount)
    var bottom = Array(repeating: [Pixel](), count: laneCount)
    for lane in 0..<laneCount {
        right[lane].reserveCapacity(samples)
        bottom[lane].reserveCapacity(samples)
        for sample in 0..<samples {
            let y = min(height - 1, Int((Double(sample) + 0.5) * Double(height) / Double(samples)))
            let x = min(width - 1, Int((Double(sample) + 0.5) * Double(width) / Double(samples)))
            let rightOffset = (y * width + (width - 1 - lane)) * 4
            let bottomOffset = ((height - 1 - lane) * width + x) * 4
            right[lane].append(decodedPixel(bytes, rightOffset))
            bottom[lane].append(decodedPixel(bytes, bottomOffset))
        }
    }
    // The high-resolution byte buffer is discarded here. Only four edge lanes
    // sampled into private memory survive, and those never leave this process.
    return BoundarySignature(right: right, bottom: bottom)
}

private func analyze(_ plane: PixelPlane) -> FrameMetrics {
    let count = max(1, plane.pixels.count)
    var opaque = 0
    var black = 0
    var purple = 0
    var lumaTotal = 0.0
    var lumaSquared = 0.0
    var redTotal = 0.0
    var greenTotal = 0.0
    var blueTotal = 0.0
    var alphaTotal = 0.0
    for pixel in plane.pixels {
        if pixel.alpha > 0.90 { opaque += 1 }
        if pixel.alpha > 0.45 && pixel.luma < 0.055 { black += 1 }
        if isPurple(pixel) { purple += 1 }
        lumaTotal += pixel.luma
        lumaSquared += pixel.luma * pixel.luma
        redTotal += pixel.red
        greenTotal += pixel.green
        blueTotal += pixel.blue
        alphaTotal += pixel.alpha
    }
    let denominator = Double(count)
    let lumaMean = lumaTotal / denominator
    let variance = max(0, lumaSquared / denominator - lumaMean * lumaMean)
    let mean = Pixel(
        red: redTotal / denominator,
        green: greenTotal / denominator,
        blue: blueTotal / denominator,
        alpha: alphaTotal / denominator
    )
    let uniform = plane.pixels.reduce(0) { partial, pixel in
        partial + (pixelDistance(pixel, mean) < 0.045 ? 1 : 0)
    }

    var horizontalTotal = 0.0
    var verticalTotal = 0.0
    var horizontalPairs = 0
    var verticalPairs = 0
    for y in 0..<plane.height {
        for x in 0..<plane.width {
            let index = y * plane.width + x
            if x + 1 < plane.width {
                horizontalTotal += pixelDistance(plane.pixels[index], plane.pixels[index + 1])
                horizontalPairs += 1
            }
            if y + 1 < plane.height {
                verticalTotal += pixelDistance(plane.pixels[index], plane.pixels[index + plane.width])
                verticalPairs += 1
            }
        }
    }
    let horizontalGradient = horizontalTotal / Double(max(1, horizontalPairs))
    let verticalGradient = verticalTotal / Double(max(1, verticalPairs))
    let edgeDensity = (horizontalGradient + verticalGradient) * 0.5

    // The standard Electron/macOS title strip is roughly four percent of the
    // window in our supported sizes. Keeping this band narrow prevents normal
    // overlay content below the title bar from looking like chrome takeover.
    let chromeRows = max(1, Int(Double(plane.height) * 0.04))
    var chromeBlack = 0
    var chromePurple = 0
    for y in 0..<chromeRows {
        for x in 0..<plane.width {
            let pixel = plane.pixels[y * plane.width + x]
            if pixel.alpha > 0.45 && pixel.luma < 0.055 { chromeBlack += 1 }
            if isPurple(pixel) { chromePurple += 1 }
        }
    }
    let chromeCount = Double(max(1, chromeRows * plane.width))

    let edgeColumns = max(1, Int(Double(plane.width) * 0.025))
    let edgeRows = max(1, Int(Double(plane.height) * 0.025))
    var rightOpaque = 0
    var bottomOpaque = 0
    for y in 0..<plane.height {
        for x in (plane.width - edgeColumns)..<plane.width {
            if plane.pixels[y * plane.width + x].alpha > 0.9 { rightOpaque += 1 }
        }
    }
    for y in (plane.height - edgeRows)..<plane.height {
        for x in 0..<plane.width {
            if plane.pixels[y * plane.width + x].alpha > 0.9 { bottomOpaque += 1 }
        }
    }

    let radius = max(3, min(8, Int(Double(min(plane.width, plane.height)) * 0.028)))
    var cornerSamples = 0
    var transparentCorners = 0
    for yOffset in 0..<radius {
        for xOffset in 0..<radius where xOffset + yOffset < radius {
            let y = plane.height - 1 - yOffset
            for x in [xOffset, plane.width - 1 - xOffset] {
                cornerSamples += 1
                if plane.pixels[y * plane.width + x].alpha < 0.55 { transparentCorners += 1 }
            }
        }
    }

    return FrameMetrics(
        aspectRatio: Double(plane.width) / Double(plane.height),
        opaqueRatio: Double(opaque) / denominator,
        lumaMean: lumaMean,
        lumaStdDev: sqrt(variance),
        blackRatio: Double(black) / denominator,
        purpleRatio: Double(purple) / denominator,
        uniformRatio: Double(uniform) / denominator,
        edgeDensity: edgeDensity,
        horizontalGradient: horizontalGradient,
        verticalGradient: verticalGradient,
        structureAspect: clamp(horizontalGradient / max(verticalGradient, 0.000_1), 0, 10),
        roundedCornerScore: Double(transparentCorners) / Double(max(1, cornerSamples)),
        chromeBlackRatio: Double(chromeBlack) / chromeCount,
        chromePurpleRatio: Double(chromePurple) / chromeCount,
        rightEdgeOpaqueRatio: Double(rightOpaque) / Double(max(1, edgeColumns * plane.height)),
        bottomEdgeOpaqueRatio: Double(bottomOpaque) / Double(max(1, edgeRows * plane.width))
    )
}

private func changedRatio(_ current: [Pixel], _ reference: [Pixel]) -> Double {
    let count = min(current.count, reference.count)
    guard count > 0 else { return 0 }
    var changed = 0
    for index in 0..<count where pixelDistance(current[index], reference[index]) > 0.075 {
        changed += 1
    }
    return Double(changed) / Double(count)
}

private func differenceBetween(
    _ currentFrame: CapturedFrame,
    _ referenceFrame: CapturedFrame,
    currentMetrics suppliedCurrentMetrics: FrameMetrics? = nil,
    referenceMetrics suppliedReferenceMetrics: FrameMetrics? = nil
) -> DifferenceMetrics {
    let current = currentFrame.plane
    let reference = referenceFrame.plane
    let currentMetrics = suppliedCurrentMetrics ?? analyze(current)
    let referenceMetrics = suppliedReferenceMetrics ?? analyze(reference)
    var changed = 0
    var deltaTotal = 0.0
    var maxDelta = 0.0
    var minimumX = comparisonWidth
    var minimumY = comparisonHeight
    var maximumX = -1
    var maximumY = -1
    var chromeChanged = 0
    var chromeSamples = 0
    var contentChanged = 0
    var contentSamples = 0
    var rightChanged = 0
    var rightSamples = 0
    var bottomChanged = 0
    var bottomSamples = 0

    for y in 0..<comparisonHeight {
        let v = (Double(y) + 0.5) / Double(comparisonHeight)
        for x in 0..<comparisonWidth {
            let u = (Double(x) + 0.5) / Double(comparisonWidth)
            let delta = pixelDistance(current.sample(u, v), reference.sample(u, v))
            deltaTotal += delta
            maxDelta = max(maxDelta, delta)
            let isChanged = delta > 0.075
            if isChanged {
                changed += 1
                minimumX = min(minimumX, x)
                minimumY = min(minimumY, y)
                maximumX = max(maximumX, x)
                maximumY = max(maximumY, y)
            }
            if v < 0.04 {
                chromeSamples += 1
                if isChanged { chromeChanged += 1 }
            } else {
                contentSamples += 1
                if isChanged { contentChanged += 1 }
            }
            if u >= 0.97 {
                rightSamples += 1
                if isChanged { rightChanged += 1 }
            }
            if v >= 0.97 {
                bottomSamples += 1
                if isChanged { bottomChanged += 1 }
            }
        }
    }
    let samples = Double(comparisonWidth * comparisonHeight)
    let hasChange = maximumX >= minimumX && maximumY >= minimumY
    let coverageWidth = hasChange ? Double(maximumX - minimumX + 1) / Double(comparisonWidth) : 0
    let coverageHeight = hasChange ? Double(maximumY - minimumY + 1) / Double(comparisonHeight) : 0
    let rightReach = hasChange ? Double(maximumX + 1) / Double(comparisonWidth) : 0
    let bottomReach = hasChange ? Double(maximumY + 1) / Double(comparisonHeight) : 0
    let topStart = hasChange ? Double(minimumY) / Double(comparisonHeight) : 1
    let rightOuter = changedRatio(currentFrame.boundary.right[0], referenceFrame.boundary.right[0])
    let rightInner = (1..<currentFrame.boundary.right.count).map { lane in
        changedRatio(currentFrame.boundary.right[lane], referenceFrame.boundary.right[lane])
    }.reduce(0, +) / Double(max(1, currentFrame.boundary.right.count - 1))
    let bottomOuter = changedRatio(currentFrame.boundary.bottom[0], referenceFrame.boundary.bottom[0])
    let bottomInner = (1..<currentFrame.boundary.bottom.count).map { lane in
        changedRatio(currentFrame.boundary.bottom[lane], referenceFrame.boundary.bottom[lane])
    }.reduce(0, +) / Double(max(1, currentFrame.boundary.bottom.count - 1))

    return DifferenceMetrics(
        changedRatio: Double(changed) / samples,
        meanDelta: deltaTotal / samples,
        maxDelta: maxDelta,
        coverageWidth: coverageWidth,
        coverageHeight: coverageHeight,
        coverageRightReach: rightReach,
        coverageBottomReach: bottomReach,
        coverageTopStart: topStart,
        chromeChangedRatio: Double(chromeChanged) / Double(max(1, chromeSamples)),
        contentChangedRatio: Double(contentChanged) / Double(max(1, contentSamples)),
        rightEdgeChangedRatio: Double(rightChanged) / Double(max(1, rightSamples)),
        bottomEdgeChangedRatio: Double(bottomChanged) / Double(max(1, bottomSamples)),
        aspectRatioDelta: abs(currentMetrics.aspectRatio - referenceMetrics.aspectRatio),
        structureAspectDelta: abs(currentMetrics.structureAspect - referenceMetrics.structureAspect),
        rightBoundaryChangedRatio: rightOuter,
        rightInnerBoundaryChangedRatio: rightInner,
        rightBoundaryDrop: max(0, rightInner - rightOuter),
        bottomBoundaryChangedRatio: bottomOuter,
        bottomInnerBoundaryChangedRatio: bottomInner,
        bottomBoundaryDrop: max(0, bottomInner - bottomOuter)
    )
}

private func overlaySupportRatio(
    current: CapturedFrame,
    baseline: CapturedFrame,
    overlay: CapturedFrame
) -> Double {
    var signatureSamples = 0
    var overlaySupported = 0
    for y in 0..<comparisonHeight {
        let v = (Double(y) + 0.5) / Double(comparisonHeight)
        for x in 0..<comparisonWidth {
            let u = (Double(x) + 0.5) / Double(comparisonWidth)
            let baselinePixel = baseline.plane.sample(u, v)
            let overlayPixel = overlay.plane.sample(u, v)
            guard pixelDistance(baselinePixel, overlayPixel) > 0.10 else { continue }
            signatureSamples += 1
            let currentPixel = current.plane.sample(u, v)
            if pixelDistance(currentPixel, overlayPixel) + 0.02
                < pixelDistance(currentPixel, baselinePixel) {
                overlaySupported += 1
            }
        }
    }
    guard signatureSamples > 0 else { return 0 }
    return Double(overlaySupported) / Double(signatureSamples)
}

private final class SeriesAccumulator {
    private let reference: CapturedFrame?
    private let overlayReference: CapturedFrame?
    private let referenceMetrics: FrameMetrics?
    private let overlayReferenceMetrics: FrameMetrics?
    private let mode: String
    private let intervalMs: Int
    private let lock = NSLock()
    private let firstCompleteSemaphore = DispatchSemaphore(value: 0)

    private var sampledFrames = 0
    private var unavailableFrames = 0
    private var unhealthyFrames = 0
    private var blankFrames = 0
    private var purpleCoverFrames = 0
    private var chromeCoverFrames = 0
    private var fullFrameFlashEvents = 0
    private var overlayDropoutFrames = 0
    private var baselineChangeDropoutFrames = 0
    private var baselineProximityDropoutFrames = 0
    private var overlaySignatureDropoutFrames = 0
    private var overlayCoverageFailureFrames = 0
    private var coverageWidthFailureFrames = 0
    private var coverageHeightFailureFrames = 0
    private var coverageRightReachFailureFrames = 0
    private var coverageBottomReachFailureFrames = 0
    private var rightBoundaryFailureFrames = 0
    private var bottomBoundaryFailureFrames = 0
    private var maximumConsecutiveOverlayDropoutMs = 0
    private var overlayDropoutStartedDisplayTime: UInt64?
    private var maximumConsecutiveUnhealthyMs = 0
    private var unhealthyStartedDisplayTime: UInt64?
    private var lastCompleteDisplayTime: UInt64?
    private var latestDisplayIntervalMs: Int
    private var completeStatusFrames = 0
    private var idleStatusFrames = 0
    private var startedStatusFrames = 0
    private var blankStatusFrames = 0
    private var suspendedStatusFrames = 0
    private var stoppedStatusFrames = 0
    private var invalidSampleFrames = 0
    private var decodeFailureFrames = 0
    private var streamErrorFrames = 0
    private var peakChromeBlackRatio = 0.0
    private var peakChromePurpleRatio = 0.0
    private var peakBlackRatio = 0.0
    private var lowestLumaStdDev: Double?
    private var contentRectInsetFrames = 0
    private var minimumContentWidthRatio = 1.0
    private var minimumContentHeightRatio = 1.0
    private var maximumContentXOffsetRatio = 0.0
    private var maximumContentYOffsetRatio = 0.0
    private var maximumContentRightInsetRatio = 0.0
    private var maximumContentBottomInsetRatio = 0.0
    private var upperLeftOriginFrames = 0
    private var lowerLeftOriginFrames = 0
    private var previous: CapturedFrame?
    private var previousMetrics: FrameMetrics?
    private var frameDeltas: [Double] = []
    private var referenceDeltas: [Double] = []

    init(reference: CapturedFrame?, overlayReference: CapturedFrame?, mode: String, intervalMs: Int) {
        self.reference = reference
        self.overlayReference = overlayReference
        self.referenceMetrics = reference.map { analyze($0.plane) }
        self.overlayReferenceMetrics = overlayReference.map { analyze($0.plane) }
        self.mode = mode
        self.intervalMs = intervalMs
        self.latestDisplayIntervalMs = intervalMs
    }

    private func displayMillisecondsLocked(from start: UInt64, to end: UInt64) -> Int? {
        guard end >= start else { return nil }
        let duration = CMTimeSubtract(
            CMClockMakeHostTimeFromSystemUnits(end),
            CMClockMakeHostTimeFromSystemUnits(start)
        )
        let seconds = CMTimeGetSeconds(duration)
        guard seconds.isFinite, seconds >= 0 else { return nil }
        return Int((seconds * 1_000).rounded())
    }

    private func markUnhealthyLocked(at displayTime: UInt64) {
        let started = unhealthyStartedDisplayTime ?? displayTime
        unhealthyStartedDisplayTime = started
        let observedMs = (displayMillisecondsLocked(from: started, to: displayTime) ?? 0)
            + latestDisplayIntervalMs
        maximumConsecutiveUnhealthyMs = max(maximumConsecutiveUnhealthyMs, observedMs)
    }

    private func recordUnavailableLocked(at displayTime: UInt64? = nil) {
        unavailableFrames += 1
        unhealthyFrames += 1
        if let displayTime {
            markUnhealthyLocked(at: displayTime)
        } else {
            unhealthyStartedDisplayTime = nil
            maximumConsecutiveUnhealthyMs = max(maximumConsecutiveUnhealthyMs, intervalMs)
        }
    }

    func recordStatus(_ status: SCFrameStatus, displayTime: UInt64) {
        lock.lock()
        defer { lock.unlock() }
        switch status {
        case .complete:
            completeStatusFrames += 1
        case .idle:
            // An idle status means WindowServer had no new pixels. It is not a
            // capture gap and must not turn an unchanged healthy frame red.
            idleStatusFrames += 1
        case .started:
            startedStatusFrames += 1
        case .blank:
            blankStatusFrames += 1
            recordUnavailableLocked(at: displayTime)
        case .suspended:
            // `suspended` is a status-only sample with no IOSurface, just like
            // `idle`; it is not itself evidence that the captured window
            // displayed an unavailable frame.  Keep it auditable, while the
            // minimum-complete-frame gate still fails a stream that remains
            // suspended instead of resuming promptly.
            suspendedStatusFrames += 1
        case .stopped:
            // SCStream emits this lifecycle marker during an intentional stop.
            stoppedStatusFrames += 1
        @unknown default:
            invalidSampleFrames += 1
            recordUnavailableLocked()
        }
    }

    func recordInvalidSample() {
        lock.lock()
        invalidSampleFrames += 1
        recordUnavailableLocked()
        lock.unlock()
    }

    func recordDecodeFailure() {
        lock.lock()
        decodeFailureFrames += 1
        recordUnavailableLocked()
        lock.unlock()
    }

    func recordStreamError() {
        lock.lock()
        streamErrorFrames += 1
        recordUnavailableLocked()
        lock.unlock()
    }

    func recordContentRect(
        bufferWidth: Int,
        bufferHeight: Int,
        contentRect: CGRect,
        originUpperLeft: Bool
    ) {
        let widthRatio = clamp(Double(contentRect.width) / Double(max(1, bufferWidth)))
        let heightRatio = clamp(Double(contentRect.height) / Double(max(1, bufferHeight)))
        let xOffsetRatio = clamp(Double(contentRect.minX) / Double(max(1, bufferWidth)))
        let yOffsetRatio = clamp(Double(contentRect.minY) / Double(max(1, bufferHeight)))
        let rightInsetRatio = clamp(
            (Double(bufferWidth) - Double(contentRect.maxX)) / Double(max(1, bufferWidth))
        )
        let bottomInsetRatio = clamp(
            (Double(bufferHeight) - Double(contentRect.maxY)) / Double(max(1, bufferHeight))
        )
        lock.lock()
        if widthRatio < 0.999 || heightRatio < 0.999
            || contentRect.minX > 0.5 || contentRect.minY > 0.5 {
            contentRectInsetFrames += 1
        }
        minimumContentWidthRatio = min(minimumContentWidthRatio, widthRatio)
        minimumContentHeightRatio = min(minimumContentHeightRatio, heightRatio)
        maximumContentXOffsetRatio = max(maximumContentXOffsetRatio, xOffsetRatio)
        maximumContentYOffsetRatio = max(maximumContentYOffsetRatio, yOffsetRatio)
        maximumContentRightInsetRatio = max(maximumContentRightInsetRatio, rightInsetRatio)
        maximumContentBottomInsetRatio = max(maximumContentBottomInsetRatio, bottomInsetRatio)
        if originUpperLeft { upperLeftOriginFrames += 1 }
        else { lowerLeftOriginFrames += 1 }
        lock.unlock()
    }

    func record(frame: CapturedFrame, displayTime: UInt64) {
        let metrics = analyze(frame.plane)
        lock.lock()

        if let previousDisplayTime = lastCompleteDisplayTime {
            guard let elapsedMs = displayMillisecondsLocked(
                from: previousDisplayTime,
                to: displayTime
            ) else {
                decodeFailureFrames += 1
                recordUnavailableLocked()
                lock.unlock()
                return
            }
            if elapsedMs > 0 {
                latestDisplayIntervalMs = elapsedMs
            }
        }
        lastCompleteDisplayTime = displayTime

        sampledFrames += 1
        let shouldSignalFirstComplete = sampledFrames == 1
        if metrics.blank { blankFrames += 1 }
        if metrics.purpleCover { purpleCoverFrames += 1 }
        if metrics.chromeCover { chromeCoverFrames += 1 }
        peakChromeBlackRatio = max(peakChromeBlackRatio, metrics.chromeBlackRatio)
        peakChromePurpleRatio = max(peakChromePurpleRatio, metrics.chromePurpleRatio)
        peakBlackRatio = max(peakBlackRatio, metrics.blackRatio)
        lowestLumaStdDev = min(lowestLumaStdDev ?? metrics.lumaStdDev, metrics.lumaStdDev)

        let unhealthy = metrics.blank || metrics.purpleCover || metrics.chromeCover
        if unhealthy {
            unhealthyFrames += 1
            markUnhealthyLocked(at: displayTime)
        } else {
            if let started = unhealthyStartedDisplayTime,
               let observedMs = displayMillisecondsLocked(from: started, to: displayTime) {
                maximumConsecutiveUnhealthyMs = max(maximumConsecutiveUnhealthyMs, observedMs)
            }
            unhealthyStartedDisplayTime = nil
        }

        if let previous, let previousMetrics {
            let delta = differenceBetween(
                frame,
                previous,
                currentMetrics: metrics,
                referenceMetrics: previousMetrics
            )
            frameDeltas.append(delta.meanDelta)
            if delta.changedRatio > 0.72 && delta.meanDelta > 0.36 {
                fullFrameFlashEvents += 1
            }
        }

        if let reference, let referenceMetrics {
            let referenceDelta = differenceBetween(
                frame,
                reference,
                currentMetrics: metrics,
                referenceMetrics: referenceMetrics
            )
            referenceDeltas.append(referenceDelta.meanDelta)
            if mode == "overlay" {
                let overlayDelta = overlayReference.flatMap { overlay in
                    overlayReferenceMetrics.map { overlayMetrics in
                        differenceBetween(
                            frame,
                            overlay,
                            currentMetrics: metrics,
                            referenceMetrics: overlayMetrics
                        )
                    }
                }
                let closerToBaseline = overlayDelta.map {
                    referenceDelta.meanDelta + 0.025 < $0.meanDelta
                } ?? true
                let signatureSupport = overlayReference.map {
                    overlaySupportRatio(current: frame, baseline: reference, overlay: $0)
                } ?? 0
                let baselineChangeDropout = referenceDelta.changedRatio < 0.14
                    || referenceDelta.contentChangedRatio < 0.14
                let baselineProximityDropout = closerToBaseline
                    && referenceDelta.meanDelta < 0.22
                let overlaySignatureDropout = signatureSupport < 0.35
                let dropout = baselineChangeDropout
                    || baselineProximityDropout
                    || overlaySignatureDropout
                let widthFailure = referenceDelta.coverageWidth < 0.78
                let heightFailure = referenceDelta.coverageHeight < 0.62
                let rightReachFailure = referenceDelta.coverageRightReach < 0.96
                let bottomReachFailure = referenceDelta.coverageBottomReach < 0.94
                let rightBoundaryFailure = referenceDelta.rightBoundaryChangedRatio < 0.50
                let bottomBoundaryFailure = referenceDelta.bottomBoundaryChangedRatio < 0.50
                let coverageFailure = widthFailure
                    || heightFailure
                    || rightReachFailure
                    || bottomReachFailure
                // Fixed-output SCStream frames can resample a source-physical
                // edge while the window changes size. Keep the outer-lane
                // counters as diagnostics, but reserve exact one-pixel gating
                // for native scalesToFit=false captures bracketing the series.
                if dropout {
                    overlayDropoutFrames += 1
                    let started = overlayDropoutStartedDisplayTime ?? displayTime
                    overlayDropoutStartedDisplayTime = started
                    maximumConsecutiveOverlayDropoutMs = max(
                        maximumConsecutiveOverlayDropoutMs,
                        (displayMillisecondsLocked(from: started, to: displayTime) ?? 0)
                            + latestDisplayIntervalMs
                    )
                } else {
                    if let started = overlayDropoutStartedDisplayTime,
                       let observedMs = displayMillisecondsLocked(from: started, to: displayTime) {
                        maximumConsecutiveOverlayDropoutMs = max(
                            maximumConsecutiveOverlayDropoutMs,
                            observedMs
                        )
                    }
                    overlayDropoutStartedDisplayTime = nil
                }
                if baselineChangeDropout { baselineChangeDropoutFrames += 1 }
                if baselineProximityDropout { baselineProximityDropoutFrames += 1 }
                if overlaySignatureDropout { overlaySignatureDropoutFrames += 1 }
                if widthFailure { coverageWidthFailureFrames += 1 }
                if heightFailure { coverageHeightFailureFrames += 1 }
                if rightReachFailure { coverageRightReachFailureFrames += 1 }
                if bottomReachFailure { coverageBottomReachFailureFrames += 1 }
                if rightBoundaryFailure { rightBoundaryFailureFrames += 1 }
                if bottomBoundaryFailure { bottomBoundaryFailureFrames += 1 }
                if coverageFailure { overlayCoverageFailureFrames += 1 }
            }
        }
        previous = frame
        previousMetrics = metrics
        lock.unlock()
        if shouldSignalFirstComplete { firstCompleteSemaphore.signal() }
    }

    func waitForFirstComplete(timeoutMs: Int) -> Bool {
        firstCompleteSemaphore.wait(timeout: .now() + .milliseconds(timeoutMs)) == .success
    }

    private func percentile(_ values: [Double], _ fraction: Double) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let index = min(sorted.count - 1, max(0, Int(ceil(Double(sorted.count) * fraction)) - 1))
        return sorted[index]
    }

    func response() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        let meanFrameDelta = frameDeltas.isEmpty
            ? 0
            : frameDeltas.reduce(0, +) / Double(frameDeltas.count)
        let meanReferenceDelta = referenceDeltas.isEmpty
            ? 0
            : referenceDeltas.reduce(0, +) / Double(referenceDeltas.count)
        return [
            "schema": schemaVersion,
            "type": "series",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
            "series": [
                "sampledFrames": sampledFrames,
                "unavailableFrames": unavailableFrames,
                "unhealthyFrames": unhealthyFrames,
                "blankFrames": blankFrames,
                "purpleCoverFrames": purpleCoverFrames,
                "chromeCoverFrames": chromeCoverFrames,
                "fullFrameFlashEvents": fullFrameFlashEvents,
                "maxConsecutiveUnhealthyMs": maximumConsecutiveUnhealthyMs,
                "overlayDropoutFrames": overlayDropoutFrames,
                "baselineChangeDropoutFrames": baselineChangeDropoutFrames,
                "baselineProximityDropoutFrames": baselineProximityDropoutFrames,
                "overlaySignatureDropoutFrames": overlaySignatureDropoutFrames,
                "overlayCoverageFailureFrames": overlayCoverageFailureFrames,
                "coverageWidthFailureFrames": coverageWidthFailureFrames,
                "coverageHeightFailureFrames": coverageHeightFailureFrames,
                "coverageRightReachFailureFrames": coverageRightReachFailureFrames,
                "coverageBottomReachFailureFrames": coverageBottomReachFailureFrames,
                "rightBoundaryFailureFrames": rightBoundaryFailureFrames,
                "bottomBoundaryFailureFrames": bottomBoundaryFailureFrames,
                "maxConsecutiveOverlayDropoutMs": maximumConsecutiveOverlayDropoutMs,
                "meanFrameDelta": rounded(meanFrameDelta),
                "p95FrameDelta": rounded(percentile(frameDeltas, 0.95)),
                "maxFrameDelta": rounded(frameDeltas.max() ?? 0),
                "meanReferenceDelta": rounded(meanReferenceDelta),
                "p95ReferenceDelta": rounded(percentile(referenceDeltas, 0.95)),
                "completeStatusFrames": completeStatusFrames,
                "idleStatusFrames": idleStatusFrames,
                "startedStatusFrames": startedStatusFrames,
                "blankStatusFrames": blankStatusFrames,
                "suspendedStatusFrames": suspendedStatusFrames,
                "stoppedStatusFrames": stoppedStatusFrames,
                "invalidSampleFrames": invalidSampleFrames,
                "decodeFailureFrames": decodeFailureFrames,
                "streamErrorFrames": streamErrorFrames,
                "peakChromeBlackRatio": rounded(peakChromeBlackRatio),
                "peakChromePurpleRatio": rounded(peakChromePurpleRatio),
                "peakBlackRatio": rounded(peakBlackRatio),
                "lowestLumaStdDev": rounded(lowestLumaStdDev ?? 0),
                "contentRectInsetFrames": contentRectInsetFrames,
                "minimumContentWidthRatio": rounded(minimumContentWidthRatio),
                "minimumContentHeightRatio": rounded(minimumContentHeightRatio),
                "maximumContentXOffsetRatio": rounded(maximumContentXOffsetRatio),
                "maximumContentYOffsetRatio": rounded(maximumContentYOffsetRatio),
                "maximumContentRightInsetRatio": rounded(maximumContentRightInsetRatio),
                "maximumContentBottomInsetRatio": rounded(maximumContentBottomInsetRatio),
                "upperLeftOriginFrames": upperLeftOriginFrames,
                "lowerLeftOriginFrames": lowerLeftOriginFrames,
            ],
        ]
    }
}

private final class StreamSeriesCollector: NSObject, SCStreamOutput, SCStreamDelegate {
    private let accumulator: SeriesAccumulator

    init(accumulator: SeriesAccumulator) {
        self.accumulator = accumulator
    }

    private func makeStreamFrame(
        pixelBuffer: CVPixelBuffer,
        metadataContentRect: CGRect,
        originUpperLeft: Bool
    ) throws -> CapturedFrame {
        let bufferWidth = CVPixelBufferGetWidth(pixelBuffer)
        let bufferHeight = CVPixelBufferGetHeight(pixelBuffer)
        // ScreenCaptureKit's contentRect is top-left based. Core Video tells
        // consumers whether the pixel buffer's {0,0} is upper-left or lower-
        // left. Convert the ROI into that declared buffer coordinate system;
        // when the buffer is lower-left, sample rows in reverse so row zero of
        // the normalized plane is still the visual top of the window.
        let contentRect = originUpperLeft
            ? metadataContentRect
            : CGRect(
                x: metadataContentRect.minX,
                y: Double(bufferHeight) - metadataContentRect.maxY,
                width: metadataContentRect.width,
                height: metadataContentRect.height
            )
        let cropMinX = max(0, Int(floor(contentRect.minX)))
        let cropMinY = max(0, Int(floor(contentRect.minY)))
        let cropMaxX = min(bufferWidth, Int(ceil(contentRect.maxX)))
        let cropMaxY = min(bufferHeight, Int(ceil(contentRect.maxY)))
        let sourceWidth = cropMaxX - cropMinX
        let sourceHeight = cropMaxY - cropMinY
        guard bufferWidth >= 8,
              bufferHeight >= 8,
              sourceWidth >= 8,
              sourceHeight >= 8,
              CVPixelBufferGetPixelFormatType(pixelBuffer) == kCVPixelFormatType_32BGRA else {
            throw ClosedCode.captureFailed
        }
        let aspectRatio = max(0.25, min(4, Double(sourceWidth) / Double(sourceHeight)))
        let analysisWidth: Int
        let analysisHeight: Int
        if aspectRatio >= 1 {
            analysisWidth = planeLongEdge
            analysisHeight = max(64, Int((Double(planeLongEdge) / aspectRatio).rounded()))
        } else {
            analysisHeight = planeLongEdge
            analysisWidth = max(64, Int((Double(planeLongEdge) * aspectRatio).rounded()))
        }
        guard CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly) == kCVReturnSuccess else {
            throw ClosedCode.captureFailed
        }
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
            throw ClosedCode.captureFailed
        }
        let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        let pixelAt: (Int, Int) -> Pixel = { x, y in
            let offset = y * bytesPerRow + x * 4
            let alpha = Double(bytes[offset + 3]) / 255
            let divisor = max(alpha, 1.0 / 255)
            return Pixel(
                red: clamp(Double(bytes[offset + 2]) / 255 / divisor),
                green: clamp(Double(bytes[offset + 1]) / 255 / divisor),
                blue: clamp(Double(bytes[offset]) / 255 / divisor),
                alpha: alpha
            )
        }
        let sourceRow: (Int, Int) -> Int = { sample, sampleCount in
            let ascending = min(
                cropMaxY - 1,
                cropMinY + Int(
                    (Double(sample) + 0.5) * Double(sourceHeight) / Double(sampleCount)
                )
            )
            return originUpperLeft
                ? ascending
                : cropMaxY - 1 - (ascending - cropMinY)
        }

        var planePixels: [Pixel] = []
        planePixels.reserveCapacity(analysisWidth * analysisHeight)
        for y in 0..<analysisHeight {
            let sourceY = sourceRow(y, analysisHeight)
            for x in 0..<analysisWidth {
                let sourceX = min(
                    cropMaxX - 1,
                    cropMinX + Int((Double(x) + 0.5) * Double(sourceWidth) / Double(analysisWidth))
                )
                planePixels.append(pixelAt(sourceX, sourceY))
            }
        }

        let laneCount = 4
        let samples = 256
        var right = Array(repeating: [Pixel](), count: laneCount)
        var bottom = Array(repeating: [Pixel](), count: laneCount)
        for lane in 0..<laneCount {
            let rightX = max(cropMinX, cropMaxX - 1 - lane)
            let bottomY = originUpperLeft
                ? max(cropMinY, cropMaxY - 1 - lane)
                : min(cropMaxY - 1, cropMinY + lane)
            right[lane].reserveCapacity(samples)
            bottom[lane].reserveCapacity(samples)
            for sample in 0..<samples {
                let sourceY = sourceRow(sample, samples)
                let sourceX = min(
                    cropMaxX - 1,
                    cropMinX + Int((Double(sample) + 0.5) * Double(sourceWidth) / Double(samples))
                )
                right[lane].append(pixelAt(rightX, sourceY))
                bottom[lane].append(pixelAt(sourceX, bottomY))
            }
        }

        // Continuous transition proof reads only a normalized plane plus the
        // active content rectangle's output-raster edge lanes. Exact source-
        // physical edge proof remains the job of bracketed native one-shots.
        return CapturedFrame(
            plane: PixelPlane(width: analysisWidth, height: analysisHeight, pixels: planePixels),
            boundary: BoundarySignature(right: right, bottom: bottom)
        )
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .screen, sampleBuffer.isValid else {
            accumulator.recordInvalidSample()
            return
        }
        guard let attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(
            sampleBuffer,
            createIfNecessary: false
        ) as? [[SCStreamFrameInfo: Any]],
              let attachments = attachmentsArray.first,
              let statusValue = attachments[.status] as? Int,
              let status = SCFrameStatus(rawValue: statusValue),
              let displayTime = attachments[.displayTime] as? UInt64,
              displayTime > 0 else {
            accumulator.recordInvalidSample()
            return
        }
        // Apple defines displayTime as the time WindowServer displayed this
        // frame. Use that host clock for visible-run durations; callback wall
        // time also includes helper scheduling and analysis latency.
        accumulator.recordStatus(status, displayTime: displayTime)
        guard status == .complete else { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer),
              let contentRectDictionary = attachments[.contentRect] as? NSDictionary,
              let contentRect = CGRect(
                  dictionaryRepresentation: contentRectDictionary as CFDictionary
              ),
              let contentScale = attachments[.contentScale] as? CGFloat,
              let scaleFactor = attachments[.scaleFactor] as? CGFloat,
              contentScale.isFinite,
              contentScale > 0,
              scaleFactor.isFinite,
              scaleFactor > 0 else {
            accumulator.recordDecodeFailure()
            return
        }
        // SCStreamFrameInfo.contentRect is the content's size and location in
        // points in the surface. The IOSurface is pixel-backed, so apply
        // the frame's source scale factor before cropping.  contentScale is
        // intentionally not part of this conversion: it describes the
        // hardware fit applied to the source, while contentRect already
        // identifies that fitted region in output coordinates.
        let pixelContentRect = CGRect(
            x: contentRect.minX * scaleFactor,
            y: contentRect.minY * scaleFactor,
            width: contentRect.width * scaleFactor,
            height: contentRect.height * scaleFactor
        ).standardized
        let bufferBounds = CGRect(
            x: 0,
            y: 0,
            width: CVPixelBufferGetWidth(pixelBuffer),
            height: CVPixelBufferGetHeight(pixelBuffer)
        )
        // Tolerate only subpixel/rounding spill at the output boundary. A
        // materially out-of-bounds metadata rectangle would make clamped
        // analysis look complete while silently discarding source content.
        guard pixelContentRect.minX.isFinite,
              pixelContentRect.minY.isFinite,
              pixelContentRect.width.isFinite,
              pixelContentRect.height.isFinite,
              pixelContentRect.minX >= -1,
              pixelContentRect.minY >= -1,
              pixelContentRect.maxX <= bufferBounds.maxX + 1,
              pixelContentRect.maxY <= bufferBounds.maxY + 1 else {
            accumulator.recordDecodeFailure()
            return
        }
        let boundedContentRect = pixelContentRect.intersection(bufferBounds)
        guard !boundedContentRect.isNull,
              !boundedContentRect.isEmpty,
              boundedContentRect.width >= 8,
              boundedContentRect.height >= 8 else {
            accumulator.recordDecodeFailure()
            return
        }
        let originUpperLeft = CVImageBufferIsFlipped(pixelBuffer)
        accumulator.recordContentRect(
            bufferWidth: CVPixelBufferGetWidth(pixelBuffer),
            bufferHeight: CVPixelBufferGetHeight(pixelBuffer),
            contentRect: boundedContentRect,
            originUpperLeft: originUpperLeft
        )
        do {
            accumulator.record(
                frame: try makeStreamFrame(
                    pixelBuffer: pixelBuffer,
                    metadataContentRect: boundedContentRect,
                    originUpperLeft: originUpperLeft
                ),
                displayTime: displayTime
            )
        } catch {
            accumulator.recordDecodeFailure()
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        accumulator.recordStreamError()
    }
}

private final class ActiveVisualSeries {
    let stream: SCStream
    let collector: StreamSeriesCollector
    let accumulator: SeriesAccumulator
    let outputQueue: DispatchQueue

    init(
        stream: SCStream,
        collector: StreamSeriesCollector,
        accumulator: SeriesAccumulator,
        outputQueue: DispatchQueue
    ) {
        self.stream = stream
        self.collector = collector
        self.accumulator = accumulator
        self.outputQueue = outputQueue
    }
}

private final class CaptureSession {
    private let processID: pid_t
    private var references: [String: CapturedFrame] = [:]
    private var pinnedWindowID: CGWindowID?
    private var activeSeries: ActiveVisualSeries?

    init(processID: pid_t) {
        self.processID = processID
    }

    private func candidateWindows() async throws -> [SCWindow] {
        guard CGPreflightScreenCaptureAccess() else { throw ClosedCode.permissionMissing }
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
        return content.windows.filter { window in
            window.owningApplication?.processID == processID
                && window.windowLayer == 0
                && window.frame.width >= 160
                && window.frame.height >= 120
        }
    }

    private func targetWindow() async throws -> SCWindow {
        let candidates = try await candidateWindows()
        if let pinnedWindowID,
           let pinned = candidates.first(where: { $0.windowID == pinnedWindowID }) {
            return pinned
        }
        guard let selected = candidates.max(by: { left, right in
            let leftScore = (left.isOnScreen ? 1_000_000_000.0 : 0) + left.frame.width * left.frame.height
            let rightScore = (right.isOnScreen ? 1_000_000_000.0 : 0) + right.frame.width * right.frame.height
            return leftScore < rightScore
        }) else { throw ClosedCode.windowUnavailable }
        // The first ordinary-window capture happens before the overlay child is
        // shown. Pinning it prevents an equal-area child from winning an
        // unspecified SCWindow ordering during fullscreen or overlay stress.
        pinnedWindowID = selected.windowID
        return selected
    }

    private func captureImage(
        window: SCWindow,
        showsCursor: Bool
    ) async throws -> (image: CGImage, filter: SCContentFilter, pointPixelScale: Double) {
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let pointPixelScale = Double(filter.pointPixelScale)
        let nativeWidth = Int(ceil(Double(filter.contentRect.width) * pointPixelScale))
        let nativeHeight = Int(ceil(Double(filter.contentRect.height) * pointPixelScale))
        guard nativeWidth >= 1,
              nativeHeight >= 1,
              nativeWidth <= maximumNativeCaptureEdge,
              nativeHeight <= maximumNativeCaptureEdge,
              Int64(nativeWidth) * Int64(nativeHeight) <= Int64(maximumNativeCapturePixels) else {
            // Downsampling here would turn a one-physical-pixel DPI seam into a
            // fractional sample and create a false green. Unsupported capture
            // sizes therefore fail closed instead of being resized.
            throw ClosedCode.captureFailed
        }
        let configuration = SCStreamConfiguration()
        configuration.width = nativeWidth
        configuration.height = nativeHeight
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.colorSpaceName = CGColorSpace.sRGB
        configuration.scalesToFit = false
        configuration.preservesAspectRatio = true
        configuration.showsCursor = showsCursor
        configuration.shouldBeOpaque = false
        configuration.ignoreShadowsSingleWindow = true
        if #available(macOS 15.0, *) {
            configuration.includeChildWindows = true
        }
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
        return (image, filter, pointPixelScale)
    }

    private func capture() async throws -> CapturedSample {
        let window = try await targetWindow()
        let aspectRatio = max(0.25, min(4, window.frame.width / max(1, window.frame.height)))
        let captured = try await captureImage(window: window, showsCursor: false)
        return CapturedSample(
            frame: CapturedFrame(
                plane: try makePlane(image: captured.image, aspectRatio: aspectRatio),
                boundary: try makeBoundarySignature(image: captured.image)
            ),
            source: [
                "frameWidth": window.frame.width,
                "frameHeight": window.frame.height,
                "filterWidth": captured.filter.contentRect.width,
                "filterHeight": captured.filter.contentRect.height,
                "pointPixelScale": captured.pointPixelScale,
            ]
        )
    }

    func cursor() async throws -> [String: Any] {
        let window = try await targetWindow()
        guard let pointer = CGEvent(source: nil)?.location else {
            throw ClosedCode.captureFailed
        }
        let normalizedX = (pointer.x - window.frame.minX) / max(1, window.frame.width)
        let normalizedY = (pointer.y - window.frame.minY) / max(1, window.frame.height)
        let pointerInWindow = window.frame.contains(pointer)
        let titleBandHeight = min(64, max(24, window.frame.height * 0.10))
        let pointerInTitleBand = pointerInWindow
            && pointer.y >= window.frame.minY
            && pointer.y < window.frame.minY + titleBandHeight
        let aspectRatio = max(0.25, min(4, window.frame.width / max(1, window.frame.height)))
        let withoutCursor = try await captureImage(window: window, showsCursor: false)
        let withCursor = try await captureImage(window: window, showsCursor: true)
        let difference = cursorDifference(
            withoutCursor: try makePlane(image: withoutCursor.image, aspectRatio: aspectRatio),
            withCursor: try makePlane(image: withCursor.image, aspectRatio: aspectRatio),
            normalizedX: normalizedX,
            normalizedY: normalizedY
        )
        let cursorVisible = pointerInTitleBand
            && difference.changedRatio >= 0.003
            && difference.meanDelta >= 0.0005
            && difference.maxDelta >= 0.15
        return [
            "schema": schemaVersion,
            "type": "cursor",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
            "pointerInTargetWindow": pointerInWindow,
            "pointerInTitleBand": pointerInTitleBand,
            "cursorVisible": cursorVisible,
            "changedRatio": rounded(difference.changedRatio),
            "meanDelta": rounded(difference.meanDelta),
            "maxDelta": rounded(difference.maxDelta),
        ]
    }

    func capture(slot: String?) async throws -> [String: Any] {
        let sample = try await capture()
        if let slot { references[slot] = sample.frame }
        return [
            "schema": schemaVersion,
            "type": "capture",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
            "frame": analyze(sample.frame.plane).json(),
            "source": sample.source,
        ]
    }

    func compare(slot: String?, against: String) async throws -> [String: Any] {
        guard let reference = references[against] else { throw ClosedCode.referenceMissing }
        let sample = try await capture()
        if let slot { references[slot] = sample.frame }
        return [
            "schema": schemaVersion,
            "type": "comparison",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
            "frame": analyze(sample.frame.plane).json(),
            "difference": differenceBetween(sample.frame, reference).json(),
            "source": sample.source,
        ]
    }


    func visibility() async throws -> [String: Any] {
        let candidates = try await candidateWindows()
        let visible = min(16, candidates.filter(\.isOnScreen).count)
        return [
            "schema": schemaVersion,
            "type": "visibility",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
            "visibleCompositeCount": visible,
            "compositeVisible": visible > 0,
        ]
    }

    func beginSeries(against: String?, mode: String, intervalMs: Int) async throws -> [String: Any] {
        guard activeSeries == nil else { throw ClosedCode.invalidArguments }
        let reference = against.flatMap { references[$0] }
        let overlayReference = mode == "overlay" ? references["overlay"] : nil
        if mode == "overlay", (reference == nil || overlayReference == nil) {
            throw ClosedCode.referenceMissing
        }
        let window = try await targetWindow()
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let pointPixelScale = Double(filter.pointPixelScale)
        let nativeWidth = Int(ceil(Double(filter.contentRect.width) * pointPixelScale))
        let nativeHeight = Int(ceil(Double(filter.contentRect.height) * pointPixelScale))
        guard nativeWidth >= 1,
              nativeHeight >= 1,
              nativeWidth <= maximumNativeCaptureEdge,
              nativeHeight <= maximumNativeCaptureEdge,
              Int64(nativeWidth) * Int64(nativeHeight) <= Int64(maximumNativeCapturePixels) else {
            throw ClosedCode.captureFailed
        }

        let configuration = SCStreamConfiguration()
        configuration.width = nativeWidth
        configuration.height = nativeHeight
        configuration.minimumFrameInterval = CMTime(value: Int64(intervalMs), timescale: 1_000)
        configuration.queueDepth = 5
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.colorSpaceName = CGColorSpace.sRGB
        // A fixed output raster keeps one stream alive while WindowServer moves
        // and resizes the pinned parent. Normalized analysis already compares
        // every frame in relative coordinates; restarting single-frame capture
        // for each transient geometry was the source of target churn.
        configuration.scalesToFit = true
        // The persistent raster stays fixed while the source window changes,
        // but its pixels must never be stretched. ScreenCaptureKit reports the
        // fitted region through contentRect, which the collector crops before
        // normalized analysis.
        configuration.preservesAspectRatio = true
        configuration.showsCursor = false
        configuration.shouldBeOpaque = false
        configuration.ignoreShadowsSingleWindow = true
        if #available(macOS 15.0, *) {
            configuration.includeChildWindows = true
        }

        let accumulator = SeriesAccumulator(
            reference: reference,
            overlayReference: overlayReference,
            mode: mode,
            intervalMs: intervalMs
        )
        let collector = StreamSeriesCollector(accumulator: accumulator)
        let outputQueue = DispatchQueue(label: "steam-bridge.visual-qa.stream")
        let stream = SCStream(filter: filter, configuration: configuration, delegate: collector)
        try stream.addStreamOutput(collector, type: .screen, sampleHandlerQueue: outputQueue)
        do {
            try await stream.startCapture()
        } catch {
            try? stream.removeStreamOutput(collector, type: .screen)
            throw ClosedCode.captureFailed
        }
        guard accumulator.waitForFirstComplete(timeoutMs: 1_000) else {
            try? await stream.stopCapture()
            outputQueue.sync {}
            try? stream.removeStreamOutput(collector, type: .screen)
            throw ClosedCode.captureFailed
        }
        activeSeries = ActiveVisualSeries(
            stream: stream,
            collector: collector,
            accumulator: accumulator,
            outputQueue: outputQueue
        )
        return [
            "schema": schemaVersion,
            "type": "series-started",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
        ]
    }

    func endSeries() async throws -> [String: Any] {
        guard let activeSeries else { throw ClosedCode.invalidArguments }
        self.activeSeries = nil
        do {
            try await activeSeries.stream.stopCapture()
        } catch {
            activeSeries.accumulator.recordStreamError()
        }
        // stopCapture's completion and the dedicated serial queue together form
        // the evidence boundary: no late frame can mutate the returned receipt.
        activeSeries.outputQueue.sync {}
        try? activeSeries.stream.removeStreamOutput(activeSeries.collector, type: .screen)
        return activeSeries.accumulator.response()
    }

    func clear(slot: String) -> [String: Any] {
        references.removeValue(forKey: slot)
        return [
            "schema": schemaVersion,
            "type": "cleared",
            "status": "pass",
            "code": ClosedCode.ok.rawValue,
        ]
    }
}

extension ClosedCode: Error {}

private func emit(_ object: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else {
        return
    }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
}

private func failure(_ code: ClosedCode) -> [String: Any] {
    [
        "schema": schemaVersion,
        "type": "error",
        "status": "fail",
        "code": code.rawValue,
    ]
}

private func closedCode(_ error: Error) -> ClosedCode {
    if let code = error as? ClosedCode { return code }
    return ClosedCode.captureFailed
}

private func validSlot(_ value: Any?) -> String? {
    guard let slot = value as? String, allowedSlots.contains(slot) else { return nil }
    return slot
}

private func runSession(processID: pid_t) async {
    guard CGPreflightScreenCaptureAccess() else {
        emit(failure(.permissionMissing))
        return
    }
    let session = CaptureSession(processID: processID)
    emit([
        "schema": schemaVersion,
        "type": "ready",
        "status": "pass",
        "code": ClosedCode.ok.rawValue,
    ])
    while let line = readLine(strippingNewline: true) {
        guard let data = line.data(using: .utf8),
              data.count <= 4_096,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let command = object["command"] as? String else {
            emit(failure(.invalidArguments))
            continue
        }
        do {
            switch command {
            case "capture":
                let slot: String?
                if object["slot"] == nil { slot = nil }
                else if let value = validSlot(object["slot"]) { slot = value }
                else { throw ClosedCode.invalidArguments }
                emit(try await session.capture(slot: slot))
            case "compare":
                guard let against = validSlot(object["against"]) else { throw ClosedCode.invalidArguments }
                let slot: String?
                if object["slot"] == nil { slot = nil }
                else if let value = validSlot(object["slot"]) { slot = value }
                else { throw ClosedCode.invalidArguments }
                emit(try await session.compare(slot: slot, against: against))
            case "begin-series":
                let against: String?
                if object["against"] == nil { against = nil }
                else if let value = validSlot(object["against"]) { against = value }
                else { throw ClosedCode.invalidArguments }
                guard let intervalMs = object["intervalMs"] as? Int,
                      let mode = object["mode"] as? String,
                      ["health", "overlay"].contains(mode),
                      (1...1_000).contains(intervalMs) else {
                    throw ClosedCode.invalidArguments
                }
                emit(try await session.beginSeries(
                    against: against,
                    mode: mode,
                    intervalMs: intervalMs
                ))
            case "end-series":
                emit(try await session.endSeries())
            case "visibility":
                emit(try await session.visibility())
            case "cursor":
                emit(try await session.cursor())
            case "clear":
                guard let slot = validSlot(object["slot"]) else { throw ClosedCode.invalidArguments }
                emit(session.clear(slot: slot))
            case "quit":
                _ = try? await session.endSeries()
                emit([
                    "schema": schemaVersion,
                    "type": "bye",
                    "status": "pass",
                    "code": ClosedCode.ok.rawValue,
                ])
                return
            default:
                throw ClosedCode.invalidArguments
            }
        } catch {
            emit(failure(closedCode(error)))
        }
    }
}

private func execute() async {
    let arguments = Array(CommandLine.arguments.dropFirst())
    if arguments == ["preflight"] {
        emit([
            "schema": schemaVersion,
            "type": "preflight",
            "status": CGPreflightScreenCaptureAccess() ? "pass" : "fail",
            "code": CGPreflightScreenCaptureAccess()
                ? ClosedCode.ok.rawValue
                : ClosedCode.permissionMissing.rawValue,
            "screenCaptureGranted": CGPreflightScreenCaptureAccess(),
        ])
        return
    }
    guard arguments.count == 3,
          arguments[0] == "session",
          arguments[1] == "--pid",
          let parsedPID = Int32(arguments[2]),
          parsedPID > 0 else {
        emit(failure(.invalidArguments))
        return
    }
    await runSession(processID: parsedPID)
}

// ScreenCaptureKit's desktop-independent window filter requires a WindowServer
// connection even for a noninteractive command-line helper. The prohibited
// activation policy initializes that connection without a Dock icon or focus.
_ = NSApplication.shared
NSApplication.shared.setActivationPolicy(.prohibited)

Task {
    await execute()
    exit(EXIT_SUCCESS)
}
dispatchMain()
