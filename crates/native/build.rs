extern crate napi_build;

fn main() {
    napi_build::setup();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

    if target_os != "macos" || target_arch != "aarch64" {
        panic!(
            "Steam Bridge supports Apple Silicon macOS only (aarch64-apple-darwin); \
             target was {target_arch}-{target_os}."
        );
    }

    if target_os == "macos" {
        println!("cargo:rerun-if-changed=src/macos_metal_surface.mm");
        println!("cargo:rerun-if-changed=src/steam_music_remote_bridge.cpp");

        cc::Build::new()
            .cpp(true)
            .file("src/macos_metal_surface.mm")
            .flag("-std=c++17")
            .flag("-fobjc-arc")
            .compile("steam_bridge_metal_surface");

        cc::Build::new()
            .cpp(true)
            .file("src/steam_music_remote_bridge.cpp")
            .flag("-std=c++17")
            .compile("steam_bridge_music_remote");

        println!("cargo:rustc-link-lib=framework=Cocoa");
        println!("cargo:rustc-link-lib=framework=Metal");
        println!("cargo:rustc-link-lib=framework=MetalKit");
        println!("cargo:rustc-link-lib=framework=QuartzCore");
    }
}
