const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const source = readFileSync(join(__dirname, "..", "scripts", "macos-window-visual-qa.swift"), "utf8");

test("macOS visual helper emits only closed numeric aggregates", () => {
  assert.match(source, /private func emit\(_ object: \[String: Any\]\)/);
  assert.match(source, /JSONSerialization\.data\(withJSONObject:/);
  assert.match(source, /FileHandle\.standardOutput\.write/);
  assert.doesNotMatch(
    source,
    /"(?:pid|processID|windowID|title|account|pixels|ocr|grid|width|height|dimensions)"\s*:/,
  );
  assert.doesNotMatch(source, /FileHandle\.standardError|CGImageDestination|VNRecognizeTextRequest/i);
  assert.doesNotMatch(source, /\.png\b|\.jpe?g\b|write\(to:|\.title\b/i);
});

test("ScreenCaptureKit one-shot and continuous captures stay in memory and include the attached child", () => {
  assert.match(source, /SCScreenshotManager\.captureImage/);
  assert.match(source, /SCStream\(filter:/);
  assert.match(source, /stream\.addStreamOutput/);
  assert.match(source, /configuration\.minimumFrameInterval/);
  assert.match(source, /configuration\.queueDepth = 5/);
  assert.match(source, /SCFrameStatus/);
  assert.match(source, /SCContentFilter\(desktopIndependentWindow:/);
  assert.match(source, /configuration\.showsCursor = false/);
  assert.match(source, /configuration\.shouldBeOpaque = false/);
  assert.match(source, /configuration\.ignoreShadowsSingleWindow = true/);
  assert.match(source, /configuration\.includeChildWindows = true/);
  assert.match(source, /Double\(filter\.contentRect\.width\) \* pointPixelScale/);
  assert.match(source, /Double\(filter\.contentRect\.height\) \* pointPixelScale/);
  assert.match(source, /configuration\.scalesToFit = false/);
  assert.equal(source.match(/configuration\.preservesAspectRatio = true/g)?.length, 2);
  assert.doesNotMatch(source, /configuration\.preservesAspectRatio = false/);
  assert.match(source, /attachments\[\.contentRect\]/);
  assert.match(source, /attachments\[\.contentScale\]/);
  assert.match(source, /attachments\[\.scaleFactor\]/);
  assert.match(source, /width: contentRect\.width \* scaleFactor/);
  assert.match(source, /height: contentRect\.height \* scaleFactor/);
  assert.match(source, /CVPixelBufferLockBaseAddress/);
  assert.match(source, /CVPixelBufferGetBytesPerRow/);
  assert.match(source, /CVPixelBufferGetPixelFormatType/);
  assert.doesNotMatch(source, /CIContext|CIImage/);
  assert.match(source, /configuration\.colorSpaceName = CGColorSpace\.sRGB/g);
  assert.match(source, /CGColorSpace\(name: CGColorSpace\.sRGB\)/g);
  assert.doesNotMatch(source, /CGColorSpaceCreateDeviceRGB/);
  assert.match(source, /context\.interpolationQuality = \.none/);
  assert.doesNotMatch(source, /interpolationQuality = \.medium/);
  assert.match(source, /maximumNativeCaptureEdge = 4_096/);
  assert.match(source, /maximumNativeCapturePixels = 18_000_000/);
});

test("continuous timing uses WindowServer display time instead of callback wall time", () => {
  assert.match(source, /attachments\[\.displayTime\] as\? UInt64/);
  assert.match(source, /CMClockMakeHostTimeFromSystemUnits\(end\)/);
  assert.match(source, /CMClockMakeHostTimeFromSystemUnits\(start\)/);
  assert.match(source, /recordStatus\(status, displayTime: displayTime\)/);
  assert.match(source, /record\([\s\S]*displayTime: displayTime/);
  const accumulator = source.slice(
    source.indexOf("private final class SeriesAccumulator"),
    source.indexOf("private final class StreamSeriesCollector"),
  );
  assert.doesNotMatch(accumulator, /DispatchTime\.now\(\)\.uptimeNanoseconds/);
});

test("visual deltas compare premultiplied color at transparent edges", () => {
  const distance = source.match(/private func pixelDistance[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(distance, /left\.red \* left\.alpha - right\.red \* right\.alpha/);
  assert.match(distance, /left\.green \* left\.alpha - right\.green \* right\.alpha/);
  assert.match(distance, /left\.blue \* left\.alpha - right\.blue \* right\.alpha/);
});

test("continuous comparison caches frame metrics instead of reanalyzing each pair", () => {
  assert.match(source, /private let referenceMetrics: FrameMetrics\?/);
  assert.match(source, /private var previousMetrics: FrameMetrics\?/);
  assert.match(source, /currentMetrics: metrics/);
  assert.match(source, /referenceMetrics: previousMetrics/);
});

test("status-only suspension stays auditable without inventing a missing IOSurface", () => {
  const suspendedCase = source.match(/case \.suspended:([\s\S]*?)case \.stopped:/)?.[1] ?? "";
  assert.match(suspendedCase, /suspendedStatusFrames \+= 1/);
  assert.doesNotMatch(suspendedCase, /recordUnavailableLocked/);
  assert.match(source, /minimum-complete-frame gate/);
});

test("ordinary parent selection is pinned internally and identity is never serialized", () => {
  assert.match(source, /private var pinnedWindowID: CGWindowID\?/);
  assert.match(source, /candidates\.first\(where: \{ \$0\.windowID == pinnedWindowID \}\)/);
  assert.match(source, /pinnedWindowID = selected\.windowID/);
  assert.doesNotMatch(source, /"windowID"\s*:/);
});

test("native edge proof reads the physical right and bottom lanes", () => {
  assert.match(source, /let laneCount = 4/);
  assert.match(source, /width - 1 - lane/);
  assert.match(source, /height - 1 - lane/);
  assert.match(source, /"rightBoundaryChangedRatio"/);
  assert.match(source, /"bottomBoundaryChangedRatio"/);
  assert.match(source, /rightInner - rightOuter/);
  assert.match(source, /bottomInner - bottomOuter/);
});

test("overlay series detects healthy-looking baseline dropout and coverage loss", () => {
  assert.match(source, /let overlayReference = mode == "overlay" \? references\["overlay"\] : nil/);
  assert.match(source, /referenceDelta\.meanDelta \+ 0\.025 < \$0\.meanDelta/);
  assert.match(source, /overlaySupportRatio\(current: frame, baseline: reference, overlay: \$0\)/);
  assert.match(source, /signatureSupport < 0\.35/);
  assert.match(source, /overlayDropoutFrames \+= 1/);
  assert.match(source, /overlayCoverageFailureFrames \+= 1/);
  assert.match(source, /coverageWidthFailureFrames \+= 1/);
  assert.match(source, /coverageHeightFailureFrames \+= 1/);
  assert.match(source, /coverageRightReachFailureFrames \+= 1/);
  assert.match(source, /coverageBottomReachFailureFrames \+= 1/);
  assert.match(source, /rightBoundaryFailureFrames \+= 1/);
  assert.match(source, /bottomBoundaryFailureFrames \+= 1/);
  assert.match(source, /referenceDelta\.rightBoundaryChangedRatio < 0\.50/);
  assert.match(source, /referenceDelta\.bottomBoundaryChangedRatio < 0\.50/);
});

test("scaled transition coverage stays coarse while native one-shots own exact edge proof", () => {
  const gate = source.match(/let coverageFailure =[\s\S]*?\/\/ Fixed-output SCStream frames/)?.[0] ?? "";
  assert.match(gate, /widthFailure/);
  assert.match(gate, /heightFailure/);
  assert.match(gate, /rightReachFailure/);
  assert.match(gate, /bottomReachFailure/);
  assert.doesNotMatch(gate, /\|\| rightBoundaryFailure|\|\| bottomBoundaryFailure/);
  assert.match(source, /reserve exact one-pixel gating[\s\S]*native scalesToFit=false captures/);
});

test("continuous receipts expose normalized content-rect offsets for crop diagnosis", () => {
  assert.match(source, /let xOffsetRatio = clamp\(Double\(contentRect\.minX\)/);
  assert.match(source, /let yOffsetRatio = clamp\(Double\(contentRect\.minY\)/);
  assert.match(source, /maximumContentXOffsetRatio = max\(maximumContentXOffsetRatio, xOffsetRatio\)/);
  assert.match(source, /maximumContentYOffsetRatio = max\(maximumContentYOffsetRatio, yOffsetRatio\)/);
  assert.match(source, /"maximumContentXOffsetRatio": rounded\(maximumContentXOffsetRatio\)/);
  assert.match(source, /"maximumContentYOffsetRatio": rounded\(maximumContentYOffsetRatio\)/);
  assert.match(source, /"maximumContentRightInsetRatio": rounded\(maximumContentRightInsetRatio\)/);
  assert.match(source, /"maximumContentBottomInsetRatio": rounded\(maximumContentBottomInsetRatio\)/);
});

test("direct BGRA sampling honors the Core Video vertical origin", () => {
  assert.match(source, /let originUpperLeft = CVImageBufferIsFlipped\(pixelBuffer\)/);
  assert.match(source, /y: Double\(bufferHeight\) - metadataContentRect\.maxY/);
  assert.match(source, /cropMaxY - 1 - \(ascending - cropMinY\)/);
  assert.match(source, /let bottomY = originUpperLeft[\s\S]*cropMaxY - 1 - lane[\s\S]*cropMinY \+ lane/);
  assert.match(source, /"upperLeftOriginFrames": upperLeftOriginFrames/);
  assert.match(source, /"lowerLeftOriginFrames": lowerLeftOriginFrames/);
});

test("title-bar cursor proof compares in-memory ScreenCaptureKit frames without exposing pointer coordinates", () => {
  assert.match(source, /configuration\.showsCursor = showsCursor/);
  assert.match(source, /captureImage\(window: window, showsCursor: false\)/);
  assert.match(source, /captureImage\(window: window, showsCursor: true\)/);
  assert.match(source, /private func cursorDifference/);
  assert.match(source, /pointerInTitleBand/);
  assert.match(source, /"cursorVisible": cursorVisible/);
  assert.doesNotMatch(source, /"(?:pointerX|pointerY|normalizedX|normalizedY)"\s*:/);
});

test("helper command and reference names are closed allowlists", () => {
  assert.match(source, /allowedSlots: Set<String> = \["baseline", "overlay"\]/);
  assert.match(source, /\["health", "overlay"\]\.contains\(mode\)/);
  for (const command of ["capture", "compare", "begin-series", "end-series", "visibility", "cursor", "clear", "quit"]) {
    assert.match(source, new RegExp(`case "${command}"`));
  }
  assert.match(source, /default:\s*throw ClosedCode\.invalidArguments/);
});
