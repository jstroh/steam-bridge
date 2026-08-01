#import <Cocoa/Cocoa.h>
#import <CoreFoundation/CoreFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Metal/Metal.h>
#import <MetalKit/MetalKit.h>
#import <QuartzCore/CAMetalLayer.h>
#import <QuartzCore/CATransaction.h>
#include <atomic>
#include <cmath>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <memory>

static uint64_t SteamBridgeMonotonicMicroseconds(void) {
    CFTimeInterval seconds = CACurrentMediaTime();
    if (!std::isfinite(seconds) || seconds <= 0.0) {
        return 0;
    }

    return (uint64_t)llround(seconds * 1000000.0);
}

static id SteamBridgeNullableTimestamp(uint64_t timestamp) {
    return timestamp == 0 ? [NSNull null] : @(timestamp);
}

static bool SteamBridgeValidDisplayRefreshRate(double refreshRate) {
    return std::isfinite(refreshRate) && refreshRate >= 1.0 && refreshRate <= 1000.0;
}

static NSInteger SteamBridgePreferredFramesPerSecond(double refreshRate) {
    if (!SteamBridgeValidDisplayRefreshRate(refreshRate)) {
        return 60;
    }
    return MAX(1, MIN(1000, (NSInteger)llround(refreshRate)));
}

static bool SteamBridgeValidRect(NSRect rect) {
    return std::isfinite(rect.origin.x) && std::isfinite(rect.origin.y) &&
           std::isfinite(rect.size.width) && std::isfinite(rect.size.height) &&
           rect.size.width > 0.0 && rect.size.height > 0.0;
}

static NSDictionary *SteamBridgeRectDictionary(NSRect rect) {
    return @{
        @"x": @(rect.origin.x),
        @"y": @(rect.origin.y),
        @"width": @(rect.size.width),
        @"height": @(rect.size.height)
    };
}

static bool SteamBridgeRectsAligned(NSRect left, NSRect right, CGFloat tolerance) {
    return fabs(left.origin.x - right.origin.x) <= tolerance &&
           fabs(left.origin.y - right.origin.y) <= tolerance &&
           fabs(left.size.width - right.size.width) <= tolerance &&
           fabs(left.size.height - right.size.height) <= tolerance;
}

static CGDirectDisplayID SteamBridgeDisplayIDForScreen(NSScreen *screen) {
    NSNumber *screenNumber = screen.deviceDescription[@"NSScreenNumber"];
    return screenNumber ? (CGDirectDisplayID)screenNumber.unsignedIntValue : kCGNullDirectDisplay;
}

static double SteamBridgeCurrentDisplayModeRefreshRate(CGDirectDisplayID displayID) {
    if (displayID == kCGNullDirectDisplay) {
        return 0.0;
    }

    CGDisplayModeRef mode = CGDisplayCopyDisplayMode(displayID);
    if (!mode) {
        return 0.0;
    }

    double refreshRate = CGDisplayModeGetRefreshRate(mode);
    CGDisplayModeRelease(mode);
    return SteamBridgeValidDisplayRefreshRate(refreshRate) ? refreshRate : 0.0;
}

struct SteamBridgeMetalDiagnostics {
    SteamBridgeMetalDiagnostics()
        : createdMonotonicUs(SteamBridgeMonotonicMicroseconds()) {}

    const uint64_t createdMonotonicUs;
    std::atomic<uint64_t> pumpCount{0};
    std::atomic<uint64_t> uploadAttemptCount{0};
    std::atomic<uint64_t> uploadCount{0};
    std::atomic<uint64_t> uploadFailureCount{0};
    std::atomic<uint64_t> drawCount{0};
    std::atomic<uint64_t> drawWithTextureCount{0};
    std::atomic<uint64_t> noDrawableCount{0};
    std::atomic<uint64_t> noRenderPassDescriptorCount{0};
    std::atomic<uint64_t> commandBufferCount{0};
    std::atomic<uint64_t> commandBufferCompletedCount{0};
    std::atomic<uint64_t> commandBufferFailureCount{0};
    std::atomic<uint64_t> encoderFailureCount{0};
    std::atomic<uint64_t> presentScheduledCount{0};
    std::atomic<uint64_t> presentedCount{0};
    std::atomic<uint64_t> notPresentedCount{0};
    std::atomic<uint64_t> drawableSizeChangeCount{0};
    std::atomic<uint64_t> failureCount{0};
    std::atomic<uint64_t> lastPumpMonotonicUs{0};
    std::atomic<uint64_t> lastUploadMonotonicUs{0};
    std::atomic<uint64_t> lastDrawMonotonicUs{0};
    std::atomic<uint64_t> lastPresentScheduledMonotonicUs{0};
    std::atomic<uint64_t> firstPresentedMonotonicUs{0};
    std::atomic<uint64_t> lastPresentedMonotonicUs{0};
    std::atomic<uint64_t> lastCommandBufferCompletedMonotonicUs{0};
    std::atomic<uint64_t> lastFailureMonotonicUs{0};
};

static void SteamBridgeRecordFailure(
    const std::shared_ptr<SteamBridgeMetalDiagnostics> &diagnostics,
    std::atomic<uint64_t> &specificCounter) {
    specificCounter.fetch_add(1, std::memory_order_relaxed);
    diagnostics->lastFailureMonotonicUs.store(
        SteamBridgeMonotonicMicroseconds(),
        std::memory_order_relaxed);
    diagnostics->failureCount.fetch_add(1, std::memory_order_release);
}

@interface SteamBridgeMetalOverlayWindow : NSWindow
@property(nonatomic, assign) uint64_t steamBridgeLeftMouseDownCount;
@property(nonatomic, assign) uint64_t steamBridgeLeftMouseUpCount;
@end

@implementation SteamBridgeMetalOverlayWindow
- (BOOL)canBecomeKeyWindow {
    return NO;
}

- (BOOL)canBecomeMainWindow {
    return NO;
}

- (void)sendEvent:(NSEvent *)event {
    if (event.type == NSEventTypeLeftMouseDown) {
        self.steamBridgeLeftMouseDownCount += 1;
    } else if (event.type == NSEventTypeLeftMouseUp) {
        self.steamBridgeLeftMouseUpCount += 1;
    }
    [super sendEvent:event];
}
@end

@interface SteamBridgeMetalSurface : NSObject <MTKViewDelegate>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, weak) NSWindow *parentWindow;
@property(nonatomic, strong) MTKView *view;
@property(nonatomic, strong) id<MTLDevice> device;
@property(nonatomic, strong) id<MTLCommandQueue> commandQueue;
@property(nonatomic, strong) id<MTLTexture> texture;
@property(nonatomic, strong) id<MTLRenderPipelineState> pipelineState;
@property(nonatomic, strong) id<MTLBuffer> vertexBuffer;
@property(nonatomic, strong) id<MTLSamplerState> samplerState;
@property(nonatomic, assign) BOOL destroyed;
@property(nonatomic, assign) BOOL attachedAsChild;
@property(nonatomic, assign) BOOL opaqueBackground;
@property(nonatomic, assign) BOOL inputPassthrough;
@property(nonatomic, assign) BOOL managedContinuousPresent;
@property(nonatomic, assign) BOOL roundedBottomCorners;
@property(nonatomic, assign) CGFloat windowCornerRadius;
@property(nonatomic, strong) NSMutableArray<id> *displayObserverTokens;
@property(nonatomic, assign) CGDirectDisplayID displayID;
@property(nonatomic, assign) double currentDisplayModeRefreshRate;
@property(nonatomic, assign) double displayRefreshRate;
@property(nonatomic, assign) double requestedFramesPerSecond;
@property(nonatomic, assign) NSInteger configuredFramesPerSecond;
@property(nonatomic, assign) NSInteger screenMaximumFramesPerSecond;
@property(nonatomic, assign) BOOL drawableResizeDeferred;
@property(nonatomic, assign) uint64_t deferredDrawableResizeCount;
@property(nonatomic, assign) uint64_t drawableResizeCommitCount;
@property(nonatomic, copy) NSString *displayRefreshRateSource;
@property(nonatomic, assign) uint64_t displayConfigurationUpdateCount;
@property(nonatomic, assign) uint64_t displayClockRebindCount;
@property(nonatomic, copy) MTLCommandBufferHandler commandBufferCompletionHandler;
@property(nonatomic, copy) MTLDrawablePresentedHandler drawablePresentedHandler;
@end

@implementation SteamBridgeMetalSurface
{
    std::shared_ptr<SteamBridgeMetalDiagnostics> _diagnostics;
}

- (BOOL)usesTransparentFullscreenBackground {
    if (!_parentWindow) {
        return NO;
    }
    BOOL titled = (_parentWindow.styleMask & NSWindowStyleMaskTitled) == NSWindowStyleMaskTitled;
    BOOL nativeFullScreen =
        (_parentWindow.styleMask & NSWindowStyleMaskFullScreen) == NSWindowStyleMaskFullScreen;
    NSRect contentLayoutRect = _parentWindow.contentLayoutRect;
    BOOL titlebarConsumesFrame = SteamBridgeValidRect(contentLayoutRect) &&
        NSMaxY(contentLayoutRect) < NSHeight(_parentWindow.frame) - 0.5;
    return nativeFullScreen || !titled || !titlebarConsumesFrame;
}

- (BOOL)effectiveOpaqueBackground {
    return _opaqueBackground && ![self usesTransparentFullscreenBackground];
}

- (instancetype)initWithX:(double)x
                        y:(double)y
                    width:(double)width
                   height:(double)height
                    title:(NSString *)title {
    self = [super init];
    if (!self) {
        return nil;
    }

    _diagnostics = std::make_shared<SteamBridgeMetalDiagnostics>();
    std::shared_ptr<SteamBridgeMetalDiagnostics> completionDiagnostics = _diagnostics;
    self.commandBufferCompletionHandler = ^(id<MTLCommandBuffer> completedCommandBuffer) {
        if (completedCommandBuffer.status == MTLCommandBufferStatusCompleted) {
            completionDiagnostics->lastCommandBufferCompletedMonotonicUs.store(
                SteamBridgeMonotonicMicroseconds(),
                std::memory_order_relaxed);
            completionDiagnostics->commandBufferCompletedCount.fetch_add(
                1,
                std::memory_order_release);
        } else {
            SteamBridgeRecordFailure(
                completionDiagnostics,
                completionDiagnostics->commandBufferFailureCount);
        }
    };

    std::shared_ptr<SteamBridgeMetalDiagnostics> presentationDiagnostics = _diagnostics;
    self.drawablePresentedHandler = ^(id<MTLDrawable> presentedDrawable) {
        // Apple reports presentedTime == 0 when this drawable was not actually
        // presented. Never substitute callback time: doing so would turn a
        // dropped drawable into false presentation evidence and inflate FPS.
        CFTimeInterval presentedTime = presentedDrawable.presentedTime;
        if (!std::isfinite(presentedTime) || presentedTime <= 0.0) {
            presentationDiagnostics->notPresentedCount.fetch_add(
                1,
                std::memory_order_release);
            return;
        }
        uint64_t presentedMonotonicUs = (uint64_t)llround(presentedTime * 1000000.0);
        if (presentedMonotonicUs == 0) {
            presentationDiagnostics->notPresentedCount.fetch_add(
                1,
                std::memory_order_release);
            return;
        }
        uint64_t expectedFirst = 0;
        presentationDiagnostics->firstPresentedMonotonicUs.compare_exchange_strong(
            expectedFirst,
            presentedMonotonicUs,
            std::memory_order_relaxed);
        presentationDiagnostics->lastPresentedMonotonicUs.store(
            presentedMonotonicUs,
            std::memory_order_relaxed);
        presentationDiagnostics->presentedCount.fetch_add(1, std::memory_order_release);
    };

    _device = MTLCreateSystemDefaultDevice();
    if (!_device) {
        NSLog(@"[Steam Bridge] Metal is not available on this macOS device");
        return nil;
    }

    _commandQueue = [_device newCommandQueue];
    if (!_commandQueue) {
        NSLog(@"[Steam Bridge] Failed to create Metal command queue");
        return nil;
    }

    NSRect frame = NSMakeRect(x, y, MAX(width, 1.0), MAX(height, 1.0));
    _window = [[SteamBridgeMetalOverlayWindow alloc] initWithContentRect:frame
                                                               styleMask:NSWindowStyleMaskBorderless
                                                                 backing:NSBackingStoreBuffered
                                                                   defer:NO];
    if (!_window) {
        NSLog(@"[Steam Bridge] Failed to create Metal overlay window");
        return nil;
    }

    [_window setTitle:title ?: @"Steam Bridge Metal Overlay"];
    [_window setReleasedWhenClosed:NO];
    [_window setOpaque:NO];
    [_window setBackgroundColor:[NSColor clearColor]];
    [_window setHasShadow:NO];
    [_window setIgnoresMouseEvents:YES];
    [_window setAcceptsMouseMovedEvents:NO];
    _inputPassthrough = YES;
    [_window setLevel:NSNormalWindowLevel + 1];
    [_window setCollectionBehavior:NSWindowCollectionBehaviorCanJoinAllSpaces |
                                   NSWindowCollectionBehaviorFullScreenAuxiliary];

    _view = [[MTKView alloc] initWithFrame:NSMakeRect(0, 0, frame.size.width, frame.size.height)
                                    device:_device];
    if (!_view) {
        NSLog(@"[Steam Bridge] Failed to create MTKView");
        return nil;
    }

    _view.delegate = self;
    _view.paused = NO;
    _view.enableSetNeedsDisplay = NO;
    // Seed MetalKit with a safe rate before the display-specific policy below
    // resolves the selected CoreGraphics mode. MTKView owns both passive and
    // active presentation timing; JavaScript never adds another draw clock.
    _view.preferredFramesPerSecond = 60;
    // Keep the last complete drawable alive while AppKit performs a live
    // resize. CAMetalLayer can scale a drawable whose pixel size differs from
    // its bounds; replacing it at every pointer step instead retires a burst
    // of not-yet-presented drawables and briefly exposes the Chromium surface
    // below this attached child. We commit the exact backing-pixel size once
    // AppKit ends live resize (and immediately for noninteractive changes).
    _view.autoResizeDrawable = NO;
    _view.clearColor = MTLClearColorMake(0.0, 0.0, 0.0, 0.0);
    _view.colorPixelFormat = MTLPixelFormatBGRA8Unorm;
    _view.layer.opaque = NO;
    _managedContinuousPresent = NO;
    _requestedFramesPerSecond = 0.0;

    CAMetalLayer *layer = (CAMetalLayer *)_view.layer;
    layer.opaque = NO;
    layer.pixelFormat = MTLPixelFormatBGRA8Unorm;

    [_window setContentView:_view];

    if (![self setupRenderPipeline]) {
        return nil;
    }

    [self installDisplayObservers];
    [self updateDisplayConfiguration];
    [self updateDrawableSize];
    [_window orderFront:nil];

    return self;
}

- (BOOL)setupRenderPipeline {
    const float vertices[] = {
        -1.0f,  1.0f, 0.0f, 0.0f,
         1.0f,  1.0f, 1.0f, 0.0f,
        -1.0f, -1.0f, 0.0f, 1.0f,
         1.0f, -1.0f, 1.0f, 1.0f,
    };

    _vertexBuffer = [_device newBufferWithBytes:vertices
                                         length:sizeof(vertices)
                                        options:MTLResourceStorageModeShared];
    if (!_vertexBuffer) {
        NSLog(@"[Steam Bridge] Failed to create Metal vertex buffer");
        return NO;
    }

    MTLSamplerDescriptor *samplerDescriptor = [MTLSamplerDescriptor new];
    samplerDescriptor.minFilter = MTLSamplerMinMagFilterLinear;
    samplerDescriptor.magFilter = MTLSamplerMinMagFilterLinear;
    samplerDescriptor.sAddressMode = MTLSamplerAddressModeClampToEdge;
    samplerDescriptor.tAddressMode = MTLSamplerAddressModeClampToEdge;
    _samplerState = [_device newSamplerStateWithDescriptor:samplerDescriptor];
    if (!_samplerState) {
        NSLog(@"[Steam Bridge] Failed to create Metal sampler");
        return NO;
    }

    NSString *shaderSource = @
        "#include <metal_stdlib>\n"
        "using namespace metal;\n"
        "struct VertexIn { float2 position; float2 texCoord; };\n"
        "struct VertexOut { float4 position [[position]]; float2 texCoord; };\n"
        "vertex VertexOut vertexShader(device VertexIn *vertices [[buffer(0)]], uint vid [[vertex_id]]) {\n"
        "  VertexOut out;\n"
        "  out.position = float4(vertices[vid].position, 0.0, 1.0);\n"
        "  out.texCoord = vertices[vid].texCoord;\n"
        "  return out;\n"
        "}\n"
        "fragment float4 fragmentShader(VertexOut in [[stage_in]], texture2d<float> texture [[texture(0)]], sampler textureSampler [[sampler(0)]]) {\n"
        "  return texture.sample(textureSampler, in.texCoord);\n"
        "}\n";

    NSError *error = nil;
    id<MTLLibrary> library = [_device newLibraryWithSource:shaderSource options:nil error:&error];
    if (!library) {
        NSLog(@"[Steam Bridge] Failed to compile Metal shaders: %@", error);
        return NO;
    }

    MTLRenderPipelineDescriptor *descriptor = [MTLRenderPipelineDescriptor new];
    descriptor.vertexFunction = [library newFunctionWithName:@"vertexShader"];
    descriptor.fragmentFunction = [library newFunctionWithName:@"fragmentShader"];
    descriptor.colorAttachments[0].pixelFormat = _view.colorPixelFormat;

    _pipelineState = [_device newRenderPipelineStateWithDescriptor:descriptor error:&error];
    if (!_pipelineState) {
        NSLog(@"[Steam Bridge] Failed to create Metal pipeline: %@", error);
        return NO;
    }

    return YES;
}

- (NSScreen *)targetScreen {
    if (_attachedAsChild && _parentWindow.screen) {
        return _parentWindow.screen;
    }

    return _window.screen ?: [NSScreen mainScreen];
}

- (void)installDisplayObservers {
    if (_displayObserverTokens) {
        return;
    }

    _displayObserverTokens = [NSMutableArray array];
    NSNotificationCenter *notificationCenter = [NSNotificationCenter defaultCenter];
    __weak SteamBridgeMetalSurface *weakSelf = self;

    id screenParametersToken = [notificationCenter
        addObserverForName:NSApplicationDidChangeScreenParametersNotification
                    object:nil
                     queue:[NSOperationQueue mainQueue]
                usingBlock:^(NSNotification *notification) {
                    (void)notification;
                    SteamBridgeMetalSurface *surface = weakSelf;
                    if (!surface || surface.destroyed) {
                        return;
                    }

                    [surface updateDisplayConfigurationRebindingViewClock:YES];
                    [surface updateDrawableSize];
                }];
    [_displayObserverTokens addObject:screenParametersToken];

    NSArray<NSNotificationName> *windowNotificationNames = @[
        NSWindowDidChangeScreenNotification,
        NSWindowDidChangeBackingPropertiesNotification,
        NSWindowDidEndLiveResizeNotification
    ];
    for (NSNotificationName notificationName in windowNotificationNames) {
        id token = [notificationCenter
            addObserverForName:notificationName
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *notification) {
                        SteamBridgeMetalSurface *surface = weakSelf;
                        if (!surface || surface.destroyed) {
                            return;
                        }

                        NSWindow *changedWindow = notification.object;
                        if (changedWindow != surface.window &&
                            changedWindow != surface.parentWindow) {
                            return;
                        }

                        BOOL rebindViewClock = ![notificationName
                            isEqualToString:NSWindowDidEndLiveResizeNotification];
                        [surface updateDisplayConfigurationRebindingViewClock:rebindViewClock];
                        [surface updateDrawableSize];
                    }];
        [_displayObserverTokens addObject:token];
    }
}

- (void)removeDisplayObservers {
    if (!_displayObserverTokens) {
        return;
    }

    NSNotificationCenter *notificationCenter = [NSNotificationCenter defaultCenter];
    for (id token in _displayObserverTokens) {
        [notificationCenter removeObserver:token];
    }
    [_displayObserverTokens removeAllObjects];
    _displayObserverTokens = nil;
}

- (void)updateDisplayConfiguration {
    [self updateDisplayConfigurationRebindingViewClock:NO];
}

- (void)updateDisplayConfigurationRebindingViewClock:(BOOL)rebindViewClock {
    if (_destroyed || !_view) {
        return;
    }

    NSScreen *screen = [self targetScreen];
    CGDirectDisplayID displayID = SteamBridgeDisplayIDForScreen(screen);
    double currentModeRefreshRate = SteamBridgeCurrentDisplayModeRefreshRate(displayID);
    NSInteger maximumFramesPerSecond = 0;
    if (@available(macOS 12.0, *)) {
        maximumFramesPerSecond = screen.maximumFramesPerSecond;
    }

    double selectedRefreshRate = currentModeRefreshRate;
    NSString *source = @"core-graphics-current-mode";
    if (!SteamBridgeValidDisplayRefreshRate(selectedRefreshRate) &&
        maximumFramesPerSecond > 0 && maximumFramesPerSecond <= 1000) {
        selectedRefreshRate = (double)maximumFramesPerSecond;
        source = @"ns-screen-maximum";
    }
    if (!SteamBridgeValidDisplayRefreshRate(selectedRefreshRate)) {
        selectedRefreshRate = 60.0;
        source = @"fallback-60";
    }

    _displayID = displayID;
    _currentDisplayModeRefreshRate = currentModeRefreshRate;
    _displayRefreshRate = selectedRefreshRate;
    double requestedRefreshRate = SteamBridgeValidDisplayRefreshRate(
        _requestedFramesPerSecond)
        ? MIN(_requestedFramesPerSecond, selectedRefreshRate)
        : selectedRefreshRate;
    // Passive presentation is only a discovery heartbeat for Steam's attached
    // surface; Chromium owns the game clock. Cap that heartbeat at 60 FPS so a
    // high-refresh display does not double idle Metal work. Active Steam
    // presentation still follows the requested rate up to the selected mode.
    double preferredRefreshRate = _managedContinuousPresent
        ? requestedRefreshRate
        : MIN(60.0, selectedRefreshRate);
    NSInteger preferredFramesPerSecond = SteamBridgePreferredFramesPerSecond(
        preferredRefreshRate);
    BOOL viewWasPaused = _view.paused;
    if (rebindViewClock) {
        // Retarget MetalKit's existing display clock without replacing either
        // the MTKView or its attached child window. Reapplying the preference
        // while paused makes same-rate screen changes deterministic too.
        _view.paused = YES;
    }
    if (rebindViewClock || _view.preferredFramesPerSecond != preferredFramesPerSecond) {
        _view.preferredFramesPerSecond = preferredFramesPerSecond;
    }
    if (rebindViewClock) {
        _view.paused = viewWasPaused;
        _displayClockRebindCount += 1;
    }
    _configuredFramesPerSecond = preferredFramesPerSecond;
    _screenMaximumFramesPerSecond = maximumFramesPerSecond;
    _displayRefreshRateSource = source;
    _displayConfigurationUpdateCount += 1;
}

- (void)attachToParentWindow:(NSWindow *)parentWindow {
    if (_destroyed || !_window || !parentWindow) {
        return;
    }

    if (_attachedAsChild && _parentWindow == parentWindow) {
        return;
    }

    if (_attachedAsChild && _parentWindow) {
        [_parentWindow removeChildWindow:_window];
    }

    _parentWindow = parentWindow;
    _attachedAsChild = YES;
    [_window setLevel:parentWindow.level];
    [parentWindow addChildWindow:_window ordered:NSWindowAbove];
    [self updateParentCornerMask];
    [self updateDisplayConfiguration];
    [self updateDrawableSize];
    [_window orderFront:nil];
}

- (CGFloat)resolvedParentCornerRadius {
    if (!_parentWindow) {
        return 0.0;
    }

    // AppKit does not expose an NSWindow corner-radius property. Prefer a
    // public Core Animation radius already applied by the parent's view tree;
    // standard titled windows otherwise use the system's 10-point content
    // corner radius. Reading the hierarchy is non-mutating and avoids private
    // NSThemeFrame API.
    for (NSView *candidate = _parentWindow.contentView;
         candidate != nil;
         candidate = candidate.superview) {
        CGFloat radius = candidate.layer.cornerRadius;
        if (std::isfinite(radius) && radius > 0.0 && radius <= 64.0) {
            return radius;
        }
    }
    return 10.0;
}

- (void)updateParentCornerMask {
    if (_destroyed || !_view) {
        return;
    }

    BOOL titled = _parentWindow &&
        (_parentWindow.styleMask & NSWindowStyleMaskTitled) == NSWindowStyleMaskTitled;
    BOOL nativeFullScreen = _parentWindow &&
        (_parentWindow.styleMask & NSWindowStyleMaskFullScreen) == NSWindowStyleMaskFullScreen;
    NSRect contentLayoutRect = _parentWindow ? _parentWindow.contentLayoutRect : NSZeroRect;
    BOOL titlebarConsumesFrame = _parentWindow && SteamBridgeValidRect(contentLayoutRect) &&
        NSMaxY(contentLayoutRect) < NSHeight(_parentWindow.frame) - 0.5;
    BOOL rounded = _attachedAsChild && titled && !nativeFullScreen && titlebarConsumesFrame;
    CGFloat radius = rounded ? [self resolvedParentCornerRadius] : 0.0;

    CALayer *layer = _view.layer;
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    layer.maskedCorners = kCALayerMinXMinYCorner | kCALayerMaxXMinYCorner;
    layer.cornerRadius = radius;
    layer.masksToBounds = rounded;
    if (@available(macOS 10.15, *)) {
        layer.cornerCurve = kCACornerCurveContinuous;
    }
    [CATransaction commit];

    _roundedBottomCorners = rounded;
    _windowCornerRadius = radius;

    // The borderless child window itself must remain a transparent rectangle;
    // otherwise its background fills the pixels clipped from the Metal view
    // and squares off the parent's bottom corners. Only advertise the Metal
    // layer as fully opaque when no corner mask is active.
    [_window setOpaque:NO];
    [_window setBackgroundColor:[NSColor clearColor]];
    BOOL effectiveOpaque = [self effectiveOpaqueBackground];
    layer.opaque = effectiveOpaque && !rounded;
    _view.clearColor = effectiveOpaque
        ? MTLClearColorMake(0.0, 0.0, 0.0, 1.0)
        : MTLClearColorMake(0.0, 0.0, 0.0, 0.0);
}

- (void)updateDrawableSize {
    if (_parentWindow && _parentWindow.inLiveResize) {
        _drawableResizeDeferred = YES;
        _deferredDrawableResizeCount += 1;
        return;
    }

    NSSize backingSize = [_view convertSizeToBacking:_view.bounds.size];
    NSSize drawableSize = NSMakeSize(
        MAX(std::isfinite(backingSize.width) ? backingSize.width : 1.0, 1.0),
        MAX(std::isfinite(backingSize.height) ? backingSize.height : 1.0, 1.0));
    if (fabs(_view.drawableSize.width - drawableSize.width) > 0.5 ||
        fabs(_view.drawableSize.height - drawableSize.height) > 0.5) {
        _view.drawableSize = drawableSize;
        _drawableResizeCommitCount += 1;
    }
    _drawableResizeDeferred = NO;
}

- (BOOL)windowCanPresent {
    if (_destroyed || !_window || !_view || !_window.visible || NSApp.hidden) {
        return NO;
    }
    CGDirectDisplayID displayID = _displayID != kCGNullDirectDisplay
        ? _displayID
        : CGMainDisplayID();
    if (CGDisplayIsAsleep(displayID)) {
        return NO;
    }
    if (!_attachedAsChild) {
        return YES;
    }
    return _parentWindow != nil && _parentWindow.visible && !_parentWindow.miniaturized;
}

- (void)updateDrawingPausedState {
    if (_view) {
        _view.paused = ![self windowCanPresent];
    }
}

- (void)setFrameX:(double)x y:(double)y width:(double)width height:(double)height {
    if (_destroyed || !_window) {
        return;
    }

    NSRect frame = NSMakeRect(x, y, MAX(width, 1.0), MAX(height, 1.0));
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [_window setFrame:frame display:NO animate:NO];
    [_view setFrame:NSMakeRect(0, 0, frame.size.width, frame.size.height)];
    [CATransaction commit];
    [self updateParentCornerMask];
    CGDirectDisplayID displayID = SteamBridgeDisplayIDForScreen([self targetScreen]);
    if (displayID != _displayID) {
        [self updateDisplayConfiguration];
    }
    [self updateDrawableSize];
}

- (void)show {
    if (!_destroyed) {
        if (_attachedAsChild && _parentWindow) {
            [_parentWindow addChildWindow:_window ordered:NSWindowAbove];
        }
        [_window orderFront:nil];
        [self updateDrawingPausedState];
    }
}

- (void)hide {
    if (!_destroyed) {
        [_window orderOut:nil];
        [self updateDrawingPausedState];
    }
}

- (void)renderBytes:(const void *)bytes width:(uint32_t)width height:(uint32_t)height {
    std::shared_ptr<SteamBridgeMetalDiagnostics> diagnostics = _diagnostics;
    if (diagnostics) {
        diagnostics->uploadAttemptCount.fetch_add(1, std::memory_order_relaxed);
    }

    if (_destroyed || !bytes || width == 0 || height == 0) {
        if (diagnostics) {
            SteamBridgeRecordFailure(diagnostics, diagnostics->uploadFailureCount);
        }
        return;
    }

    if (!_texture || _texture.width != width || _texture.height != height) {
        MTLTextureDescriptor *descriptor =
            [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm
                                                               width:width
                                                              height:height
                                                           mipmapped:NO];
        descriptor.usage = MTLTextureUsageShaderRead;
        descriptor.storageMode = MTLStorageModeShared;
        _texture = [_device newTextureWithDescriptor:descriptor];
    }

    if (!_texture) {
        SteamBridgeRecordFailure(diagnostics, diagnostics->uploadFailureCount);
        return;
    }

    MTLRegion region = MTLRegionMake2D(0, 0, width, height);
    [_texture replaceRegion:region mipmapLevel:0 withBytes:bytes bytesPerRow:width * 4];
    diagnostics->lastUploadMonotonicUs.store(
        SteamBridgeMonotonicMicroseconds(),
        std::memory_order_relaxed);
    diagnostics->uploadCount.fetch_add(1, std::memory_order_release);
    [_view setNeedsDisplay:YES];
}

- (void)pump {
    if (!_destroyed && _view) {
        // AppKit removes the attached parent and child from the screen list
        // when the parent is hidden or miniaturized, but MetalKit's timed loop
        // otherwise keeps running. Pause at that lifecycle boundary so it does
        // not allocate and retire invisible CAMetalDrawables. Electron's
        // restore/show pump re-enables the same MTKView; no surface is rebuilt.
        [self updateDrawingPausedState];
        _diagnostics->lastPumpMonotonicUs.store(
            SteamBridgeMonotonicMicroseconds(),
            std::memory_order_relaxed);
        _diagnostics->pumpCount.fetch_add(1, std::memory_order_release);
        // MTKView's timed loop is the sole Metal presentation clock. The
        // JavaScript pump owns lifecycle, geometry, and Steam callbacks only;
        // it must never add a second explicit draw clock at high refresh rates.
    }
}

- (void)setManagedContinuousPresentEnabled:(BOOL)enabled
                        requestedFrameRate:(double)requestedFrameRate {
    double normalizedFrameRate = SteamBridgeValidDisplayRefreshRate(requestedFrameRate)
        ? requestedFrameRate
        : 0.0;
    if (_destroyed || !_view ||
        (_managedContinuousPresent == enabled &&
         fabs(_requestedFramesPerSecond - normalizedFrameRate) <= 0.01)) {
        return;
    }
    _managedContinuousPresent = enabled;
    _requestedFramesPerSecond = normalizedFrameRate;
    [self updateDisplayConfiguration];
    [self updateDrawingPausedState];
}

- (NSString *)diagnosticsJSON {
    std::shared_ptr<SteamBridgeMetalDiagnostics> diagnostics = _diagnostics;
    if (!diagnostics || !_window || !_view) {
        return nil;
    }

    NSRect windowFrame = _window.frame;
    SteamBridgeMetalOverlayWindow *overlayWindow = (SteamBridgeMetalOverlayWindow *)_window;
    NSRect viewBounds = _view.bounds;
    NSSize drawableSize = _view.drawableSize;
    CGFloat backingScaleFactor = _window.backingScaleFactor;
    NSRect parentContentLayoutFrame = NSZeroRect;
    BOOL parentContentLayoutFrameValid = NO;
    if (_parentWindow) {
        NSRect contentLayoutRect = _parentWindow.contentLayoutRect;
        if (SteamBridgeValidRect(contentLayoutRect)) {
            parentContentLayoutFrame = [_parentWindow convertRectToScreen:contentLayoutRect];
            parentContentLayoutFrameValid = SteamBridgeValidRect(parentContentLayoutFrame);
        }
    }
    BOOL frameMatchesParentContentLayout =
        parentContentLayoutFrameValid &&
        SteamBridgeRectsAligned(windowFrame, parentContentLayoutFrame, 0.75);

    BOOL attached = _attachedAsChild && _parentWindow && _window.parentWindow == _parentWindow;
    BOOL windowVisible = _window.visible;
    BOOL parentVisible = _parentWindow ? _parentWindow.visible : NO;
    BOOL occlusionVisible =
        (_window.occlusionState & NSWindowOcclusionStateVisible) == NSWindowOcclusionStateVisible;

    uint64_t presentedCount = diagnostics->presentedCount.load(std::memory_order_acquire);
    uint64_t pumpCount = diagnostics->pumpCount.load(std::memory_order_acquire);
    uint64_t frameUploadCount = diagnostics->uploadCount.load(std::memory_order_acquire);
    uint64_t drawCount = diagnostics->drawCount.load(std::memory_order_acquire);
    uint64_t noDrawableCount =
        diagnostics->noDrawableCount.load(std::memory_order_relaxed);
    uint64_t noRenderPassDescriptorCount =
        diagnostics->noRenderPassDescriptorCount.load(std::memory_order_relaxed);
    uint64_t notPresentedCount =
        diagnostics->notPresentedCount.load(std::memory_order_relaxed);
    uint64_t renderFailureCount = diagnostics->failureCount.load(std::memory_order_acquire);
    uint64_t firstPresentedMonotonicUs =
        diagnostics->firstPresentedMonotonicUs.load(std::memory_order_relaxed);
    uint64_t lastPresentedMonotonicUs =
        diagnostics->lastPresentedMonotonicUs.load(std::memory_order_relaxed);
    uint64_t presentedSpanUs =
        lastPresentedMonotonicUs > firstPresentedMonotonicUs
            ? lastPresentedMonotonicUs - firstPresentedMonotonicUs
            : 0;

    NSDictionary *payload = @{
        @"platform": @"macos",
        @"backend": @"macos-metal",
        @"owner": @"attached-child-window",
        @"hostStyle": @"attached-child",
        @"destroyed": @(_destroyed),
        @"visible": @(windowVisible),
        @"occlusionVisible": @(occlusionVisible),
        @"attached": @(attached),
        @"attachedAsChildRequested": @(_attachedAsChild),
        @"parentPresent": @(_parentWindow != nil),
        @"parentVisible": @(parentVisible),
        @"parentMiniaturized": @(_parentWindow ? _parentWindow.miniaturized : NO),
        @"displayAsleep": @(CGDisplayIsAsleep(
            _displayID != kCGNullDirectDisplay ? _displayID : CGMainDisplayID())),
        @"parentKeyWindow": @(_parentWindow ? _parentWindow.keyWindow : NO),
        @"inputPassthrough": @(_inputPassthrough),
        @"opaque": @([self effectiveOpaqueBackground]),
        @"roundedBottomCorners": @(_roundedBottomCorners),
        @"windowCornerRadius": @(_windowCornerRadius),
        @"windowNumber": @(_window.windowNumber),
        @"surfaceCreatedMonotonicUs": @(diagnostics->createdMonotonicUs),
        @"leftMouseDownCount": @(overlayWindow.steamBridgeLeftMouseDownCount),
        @"leftMouseUpCount": @(overlayWindow.steamBridgeLeftMouseUpCount),
        @"frameCoordinateSpace": @"cocoa-screen-points-bottom-left",
        @"frame": SteamBridgeRectDictionary(windowFrame),
        @"parentContentLayoutFrame": parentContentLayoutFrameValid
            ? SteamBridgeRectDictionary(parentContentLayoutFrame)
            : [NSNull null],
        @"frameMatchesParentContentLayout": @(frameMatchesParentContentLayout),
        @"boundsCoordinateSpace": @"local-points",
        @"bounds": @{
            @"x": @(viewBounds.origin.x),
            @"y": @(viewBounds.origin.y),
            @"width": @(viewBounds.size.width),
            @"height": @(viewBounds.size.height)
        },
        @"drawableSizeUnits": @"physical-pixels",
        @"drawableSize": @{
            @"width": @(drawableSize.width),
            @"height": @(drawableSize.height)
        },
        @"textureSize": @{
            @"width": @(_texture ? _texture.width : 0),
            @"height": @(_texture ? _texture.height : 0)
        },
        @"backingScaleFactor": @(backingScaleFactor),
        @"displayId": @(_displayID),
        @"displayRefreshRate": @(_displayRefreshRate),
        @"currentDisplayModeRefreshRate": SteamBridgeValidDisplayRefreshRate(
            _currentDisplayModeRefreshRate) ? @(_currentDisplayModeRefreshRate) : [NSNull null],
        @"displayRefreshRateSource": _displayRefreshRateSource ?: @"unknown",
        @"requestedFramesPerSecond": SteamBridgeValidDisplayRefreshRate(
            _requestedFramesPerSecond) ? @(_requestedFramesPerSecond) : [NSNull null],
        @"configuredFramesPerSecond": @(_configuredFramesPerSecond),
        @"preferredFramesPerSecond": @(_view.preferredFramesPerSecond),
        @"managedContinuousPresent": @(_managedContinuousPresent),
        @"viewPaused": @(_view.paused),
        @"presentationDriver": _managedContinuousPresent
            ? @"mtkview-display-synchronized"
            : @"mtkview-display-synchronized-passive",
        @"screenMaximumFramesPerSecond": @(_screenMaximumFramesPerSecond),
        @"displayConfigurationUpdateCount": @(_displayConfigurationUpdateCount),
        @"displayClockRebindCount": @(_displayClockRebindCount),
        @"parentLiveResize": @(_parentWindow ? _parentWindow.inLiveResize : NO),
        @"drawableResizeDeferred": @(_drawableResizeDeferred),
        @"deferredDrawableResizeCount": @(_deferredDrawableResizeCount),
        @"drawableResizeCommitCount": @(_drawableResizeCommitCount),
        @"snapshotMonotonicUs": @(SteamBridgeMonotonicMicroseconds()),
        @"pumpCount": @(pumpCount),
        @"frameUploadCount": @(frameUploadCount),
        @"drawCount": @(drawCount),
        @"presentCount": @(presentedCount),
        @"noDrawableCount": @(noDrawableCount),
        @"noRenderPassDescriptorCount": @(noRenderPassDescriptorCount),
        @"notPresentedCount": @(notPresentedCount),
        @"renderFailureCount": @(renderFailureCount),
        @"firstPresentMonotonicUs": SteamBridgeNullableTimestamp(firstPresentedMonotonicUs),
        @"lastPresentMonotonicUs": SteamBridgeNullableTimestamp(lastPresentedMonotonicUs),
        @"counters": @{
            @"pump": @(pumpCount),
            @"uploadAttempt": @(diagnostics->uploadAttemptCount.load(std::memory_order_relaxed)),
            @"upload": @(frameUploadCount),
            @"uploadFailure": @(diagnostics->uploadFailureCount.load(std::memory_order_relaxed)),
            @"draw": @(drawCount),
            @"drawWithTexture": @(diagnostics->drawWithTextureCount.load(std::memory_order_relaxed)),
            @"noDrawable": @(noDrawableCount),
            @"noRenderPassDescriptor": @(diagnostics->noRenderPassDescriptorCount.load(std::memory_order_relaxed)),
            @"commandBuffer": @(diagnostics->commandBufferCount.load(std::memory_order_relaxed)),
            @"commandBufferCompleted": @(diagnostics->commandBufferCompletedCount.load(std::memory_order_relaxed)),
            @"commandBufferFailure": @(diagnostics->commandBufferFailureCount.load(std::memory_order_relaxed)),
            @"encoderFailure": @(diagnostics->encoderFailureCount.load(std::memory_order_relaxed)),
            @"presentScheduled": @(diagnostics->presentScheduledCount.load(std::memory_order_relaxed)),
            @"presented": @(presentedCount),
            @"notPresented": @(notPresentedCount),
            @"drawableSizeChange": @(diagnostics->drawableSizeChangeCount.load(std::memory_order_relaxed)),
            @"failure": @(renderFailureCount)
        },
        @"timestamps": @{
            @"clock": @"CACurrentMediaTime-microseconds",
            @"snapshotMonotonicUs": @(SteamBridgeMonotonicMicroseconds()),
            @"createdMonotonicUs": @(diagnostics->createdMonotonicUs),
            @"lastPumpMonotonicUs": SteamBridgeNullableTimestamp(
                diagnostics->lastPumpMonotonicUs.load(std::memory_order_relaxed)),
            @"lastUploadMonotonicUs": SteamBridgeNullableTimestamp(
                diagnostics->lastUploadMonotonicUs.load(std::memory_order_relaxed)),
            @"lastDrawMonotonicUs": SteamBridgeNullableTimestamp(
                diagnostics->lastDrawMonotonicUs.load(std::memory_order_relaxed)),
            @"lastPresentScheduledMonotonicUs": SteamBridgeNullableTimestamp(
                diagnostics->lastPresentScheduledMonotonicUs.load(std::memory_order_relaxed)),
            @"firstPresentedMonotonicUs": SteamBridgeNullableTimestamp(firstPresentedMonotonicUs),
            @"lastPresentedMonotonicUs": SteamBridgeNullableTimestamp(lastPresentedMonotonicUs),
            @"presentedSpanUs": @(presentedSpanUs),
            @"lastCommandBufferCompletedMonotonicUs": SteamBridgeNullableTimestamp(
                diagnostics->lastCommandBufferCompletedMonotonicUs.load(std::memory_order_relaxed)),
            @"lastFailureMonotonicUs": SteamBridgeNullableTimestamp(
                diagnostics->lastFailureMonotonicUs.load(std::memory_order_relaxed))
        }
    };

    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&error];
    if (!data) {
        return nil;
    }

    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (void)destroy {
    if (_destroyed) {
        return;
    }

    _destroyed = YES;
    [self removeDisplayObservers];
    _view.paused = YES;
    _view.delegate = nil;
    self.commandBufferCompletionHandler = nil;
    self.drawablePresentedHandler = nil;
    if (_attachedAsChild && _parentWindow) {
        [_parentWindow removeChildWindow:_window];
        _attachedAsChild = NO;
        _parentWindow = nil;
    }
    [_window orderOut:nil];
    [_window close];

    _texture = nil;
    _pipelineState = nil;
    _vertexBuffer = nil;
    _samplerState = nil;
    _commandQueue = nil;
    _view = nil;
    _window = nil;
    _device = nil;
}

- (void)dealloc {
    [self removeDisplayObservers];
}

- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {
    (void)view;
    (void)size;
    _diagnostics->drawableSizeChangeCount.fetch_add(1, std::memory_order_relaxed);
}

- (void)drawInMTKView:(MTKView *)view {
    std::shared_ptr<SteamBridgeMetalDiagnostics> diagnostics = _diagnostics;
    if (diagnostics) {
        diagnostics->lastDrawMonotonicUs.store(
            SteamBridgeMonotonicMicroseconds(),
            std::memory_order_relaxed);
        diagnostics->drawCount.fetch_add(1, std::memory_order_release);
    }

    if (_destroyed || !_commandQueue || ![self windowCanPresent]) {
        return;
    }

    // Asking MTKView for the render-pass descriptor obtains the current
    // drawable. Follow MetalKit's documented order and fetch that drawable
    // only immediately before encoding so it is held for the shortest window.
    MTLRenderPassDescriptor *pass = view.currentRenderPassDescriptor;
    id<CAMetalDrawable> drawable = view.currentDrawable;
    if (!drawable || !pass) {
        if (!drawable) {
            diagnostics->noDrawableCount.fetch_add(1, std::memory_order_relaxed);
        }
        if (!pass) {
            diagnostics->noRenderPassDescriptorCount.fetch_add(1, std::memory_order_relaxed);
        }
        return;
    }
    pass.colorAttachments[0].loadAction = MTLLoadActionClear;
    pass.colorAttachments[0].clearColor = [self effectiveOpaqueBackground]
        ? MTLClearColorMake(0.0, 0.0, 0.0, 1.0)
        : MTLClearColorMake(0.0, 0.0, 0.0, 0.0);

    id<MTLCommandBuffer> commandBuffer = [_commandQueue commandBuffer];
    if (!commandBuffer) {
        SteamBridgeRecordFailure(diagnostics, diagnostics->commandBufferFailureCount);
        return;
    }
    diagnostics->commandBufferCount.fetch_add(1, std::memory_order_relaxed);

    id<MTLRenderCommandEncoder> encoder = [commandBuffer renderCommandEncoderWithDescriptor:pass];
    if (!encoder) {
        SteamBridgeRecordFailure(diagnostics, diagnostics->encoderFailureCount);
        return;
    }

    if (_texture && _pipelineState) {
        diagnostics->drawWithTextureCount.fetch_add(1, std::memory_order_relaxed);
        [encoder setRenderPipelineState:_pipelineState];
        [encoder setVertexBuffer:_vertexBuffer offset:0 atIndex:0];
        [encoder setFragmentTexture:_texture atIndex:0];
        [encoder setFragmentSamplerState:_samplerState atIndex:0];
        [encoder drawPrimitives:MTLPrimitiveTypeTriangleStrip vertexStart:0 vertexCount:4];
    }

    [encoder endEncoding];

    [commandBuffer addCompletedHandler:_commandBufferCompletionHandler];
    [drawable addPresentedHandler:_drawablePresentedHandler];

    diagnostics->lastPresentScheduledMonotonicUs.store(
        SteamBridgeMonotonicMicroseconds(),
        std::memory_order_relaxed);
    diagnostics->presentScheduledCount.fetch_add(1, std::memory_order_release);
    [commandBuffer presentDrawable:drawable];
    [commandBuffer commit];
}

@end

extern "C" void *steam_bridge_metal_surface_create(double x,
                                                    double y,
                                                    double width,
                                                    double height,
                                                    const char *title) {
    @autoreleasepool {
        NSString *windowTitle = title ? [NSString stringWithUTF8String:title] : @"Steam Bridge Metal Overlay";
        SteamBridgeMetalSurface *surface = [[SteamBridgeMetalSurface alloc] initWithX:x
                                                                                    y:y
                                                                                width:width
                                                                               height:height
                                                                                title:windowTitle];
        if (!surface) {
            return nullptr;
        }

        return (__bridge_retained void *)surface;
    }
}

extern "C" void steam_bridge_metal_surface_set_frame(void *surface,
                                                       double x,
                                                       double y,
                                                       double width,
                                                       double height) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface setFrameX:x y:y width:width height:height];
    }
}

extern "C" void steam_bridge_metal_surface_attach_to_parent(void *surface, void *parentWindow) {
    if (!surface || !parentWindow) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        NSWindow *window = (__bridge NSWindow *)parentWindow;
        [metalSurface attachToParentWindow:window];
    }
}

extern "C" void steam_bridge_metal_surface_show(void *surface) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface show];
    }
}

extern "C" void steam_bridge_metal_surface_hide(void *surface) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface hide];
    }
}

extern "C" void steam_bridge_metal_surface_set_input_passthrough(void *surface, bool passThrough) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface.window setIgnoresMouseEvents:passThrough ? YES : NO];
        [metalSurface.window setAcceptsMouseMovedEvents:passThrough ? NO : YES];
        metalSurface.inputPassthrough = passThrough ? YES : NO;
    }
}

extern "C" void steam_bridge_metal_surface_set_opaque(void *surface, bool opaque) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        // Keep pixels outside the masked Metal content transparent. Marking
        // the whole child NSWindow opaque would reveal a black rectangle at
        // the rounded parent corners.
        [metalSurface.window setOpaque:NO];
        [metalSurface.window setBackgroundColor:[NSColor clearColor]];
        metalSurface.opaqueBackground = opaque ? YES : NO;
        [metalSurface updateParentCornerMask];
    }
}

extern "C" void steam_bridge_metal_surface_render_frame(void *surface,
                                                         const void *bytes,
                                                         uint32_t width,
                                                         uint32_t height) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface renderBytes:bytes width:width height:height];
    }
}

extern "C" void steam_bridge_metal_surface_pump(void *surface) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface pump];
    }
}

extern "C" void steam_bridge_metal_surface_set_continuous_present(void *surface,
                                                                    bool continuous,
                                                                    double frameRate) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        [metalSurface setManagedContinuousPresentEnabled:continuous ? YES : NO
                                                       requestedFrameRate:frameRate];
    }
}

extern "C" char *steam_bridge_metal_surface_diagnostics_json(void *surface) {
    if (!surface) {
        return nullptr;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge SteamBridgeMetalSurface *)surface;
        NSString *json = [metalSurface diagnosticsJSON];
        return json ? strdup(json.UTF8String) : nullptr;
    }
}

extern "C" void steam_bridge_metal_surface_destroy(void *surface) {
    if (!surface) {
        return;
    }

    @autoreleasepool {
        SteamBridgeMetalSurface *metalSurface = (__bridge_transfer SteamBridgeMetalSurface *)surface;
        [metalSurface destroy];
    }
}

extern "C" char *steam_bridge_macos_window_snapshot_json(uint32_t app_id) {
    @autoreleasepool {
        CFArrayRef windowInfo = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly,
                                                           kCGNullWindowID);
        NSArray *windows = CFBridgingRelease(windowInfo);
        NSMutableArray *matches = [NSMutableArray array];
        NSString *appIdText = [NSString stringWithFormat:@"%u", app_id];

        for (NSDictionary *window in windows) {
            NSString *owner = window[(id)kCGWindowOwnerName] ?: @"";
            NSString *name = window[(id)kCGWindowName] ?: @"";
            NSString *haystack = [[NSString stringWithFormat:@"%@ %@", owner, name] lowercaseString];
            BOOL interesting = [haystack containsString:@"steam"] ||
                               [haystack containsString:@"overlay"] ||
                               [haystack containsString:@"purchase"] ||
                               (app_id != 0 && [haystack containsString:appIdText]);
            if (!interesting) {
                continue;
            }

            CGRect rect = CGRectZero;
            NSDictionary *boundsDictionary = window[(id)kCGWindowBounds];
            if (boundsDictionary) {
                CGRectMakeWithDictionaryRepresentation((CFDictionaryRef)boundsDictionary, &rect);
            }

            [matches addObject:@{
                @"owner": owner,
                @"name": name,
                @"pid": window[(id)kCGWindowOwnerPID] ?: @0,
                @"layer": window[(id)kCGWindowLayer] ?: @0,
                @"alpha": window[(id)kCGWindowAlpha] ?: @0,
                @"x": @(rect.origin.x),
                @"y": @(rect.origin.y),
                @"width": @(rect.size.width),
                @"height": @(rect.size.height)
            }];
        }

        NSDictionary *payload = @{
            @"appId": @(app_id),
            @"windows": matches
        };
        NSError *error = nil;
        NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&error];
        if (!data) {
            return strdup("{\"windows\":[]}");
        }

        NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        return strdup(json.UTF8String ?: "{\"windows\":[]}");
    }
}

extern "C" bool steam_bridge_macos_session_screen_is_locked(void) {
    CFDictionaryRef session = CGSessionCopyCurrentDictionary();
    if (!session) {
        return false;
    }

    bool locked = false;
    CFTypeRef value = CFDictionaryGetValue(session, CFSTR("CGSSessionScreenIsLocked"));
    if (value && CFGetTypeID(value) == CFBooleanGetTypeID()) {
        locked = CFBooleanGetValue((CFBooleanRef)value);
    }

    CFRelease(session);
    return locked;
}

extern "C" bool steam_bridge_macos_main_display_is_asleep(void) {
    return CGDisplayIsAsleep(CGMainDisplayID());
}

extern "C" void steam_bridge_macos_free_string(char *value) {
    if (value) {
        free(value);
    }
}
