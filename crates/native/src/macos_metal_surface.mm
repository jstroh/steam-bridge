#import <Cocoa/Cocoa.h>
#import <Metal/Metal.h>
#import <MetalKit/MetalKit.h>
#import <QuartzCore/CAMetalLayer.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

@interface SteamBridgeMetalOverlayWindow : NSWindow
@end

@implementation SteamBridgeMetalOverlayWindow
- (BOOL)canBecomeKeyWindow {
    return NO;
}

- (BOOL)canBecomeMainWindow {
    return NO;
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
@end

@implementation SteamBridgeMetalSurface

- (instancetype)initWithX:(double)x
                        y:(double)y
                    width:(double)width
                   height:(double)height
                    title:(NSString *)title {
    self = [super init];
    if (!self) {
        return nil;
    }

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
    _view.preferredFramesPerSecond = 60;
    _view.autoResizeDrawable = YES;
    _view.clearColor = MTLClearColorMake(0.0, 0.0, 0.0, 0.0);
    _view.colorPixelFormat = MTLPixelFormatBGRA8Unorm;
    _view.layer.opaque = NO;

    CAMetalLayer *layer = (CAMetalLayer *)_view.layer;
    layer.opaque = NO;
    layer.pixelFormat = MTLPixelFormatBGRA8Unorm;

    [_window setContentView:_view];

    if (![self setupRenderPipeline]) {
        return nil;
    }

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
    [_window orderFront:nil];
}

- (void)updateDrawableSize {
    NSScreen *screen = _window.screen ?: [NSScreen mainScreen];
    CGFloat scale = screen ? screen.backingScaleFactor : 1.0;
    NSSize size = _view.bounds.size;
    _view.drawableSize = NSMakeSize(MAX(size.width * scale, 1.0), MAX(size.height * scale, 1.0));
}

- (void)setFrameX:(double)x y:(double)y width:(double)width height:(double)height {
    if (_destroyed || !_window) {
        return;
    }

    NSRect frame = NSMakeRect(x, y, MAX(width, 1.0), MAX(height, 1.0));
    [_window setFrame:frame display:NO animate:NO];
    [_view setFrame:NSMakeRect(0, 0, frame.size.width, frame.size.height)];
    [self updateDrawableSize];
}

- (void)show {
    if (!_destroyed) {
        if (_attachedAsChild && _parentWindow) {
            [_parentWindow addChildWindow:_window ordered:NSWindowAbove];
        }
        [_window orderFront:nil];
    }
}

- (void)hide {
    if (!_destroyed) {
        [_window orderOut:nil];
    }
}

- (void)renderBytes:(const void *)bytes width:(uint32_t)width height:(uint32_t)height {
    if (_destroyed || !bytes || width == 0 || height == 0) {
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
        return;
    }

    MTLRegion region = MTLRegionMake2D(0, 0, width, height);
    [_texture replaceRegion:region mipmapLevel:0 withBytes:bytes bytesPerRow:width * 4];
    [_view setNeedsDisplay:YES];
}

- (void)pump {
    if (!_destroyed && _view) {
        [_view draw];
    }
}

- (void)destroy {
    if (_destroyed) {
        return;
    }

    _destroyed = YES;
    _view.paused = YES;
    _view.delegate = nil;
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

- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {
    (void)view;
    (void)size;
}

- (void)drawInMTKView:(MTKView *)view {
    if (_destroyed || !_commandQueue) {
        return;
    }

    id<CAMetalDrawable> drawable = view.currentDrawable;
    MTLRenderPassDescriptor *pass = view.currentRenderPassDescriptor;
    if (!drawable || !pass) {
        return;
    }

    pass.colorAttachments[0].loadAction = MTLLoadActionClear;
    pass.colorAttachments[0].clearColor = MTLClearColorMake(0.0, 0.0, 0.0, 0.0);

    id<MTLCommandBuffer> commandBuffer = [_commandQueue commandBuffer];
    id<MTLRenderCommandEncoder> encoder = [commandBuffer renderCommandEncoderWithDescriptor:pass];
    if (!encoder) {
        return;
    }

    if (_texture && _pipelineState) {
        [encoder setRenderPipelineState:_pipelineState];
        [encoder setVertexBuffer:_vertexBuffer offset:0 atIndex:0];
        [encoder setFragmentTexture:_texture atIndex:0];
        [encoder setFragmentSamplerState:_samplerState atIndex:0];
        [encoder drawPrimitives:MTLPrimitiveTypeTriangleStrip vertexStart:0 vertexCount:4];
    }

    [encoder endEncoding];
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

extern "C" void steam_bridge_macos_free_string(char *value) {
    if (value) {
        free(value);
    }
}
