extern crate napi_build;

fn main() {
    napi_build::setup();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

    match (target_os.as_str(), target_arch.as_str()) {
        ("macos", "aarch64") | ("windows", "x86_64") | ("linux", "x86_64") => {}
        ("macos", "x86_64") => {
            panic!("Steam Bridge does not support Intel macOS (x86_64-apple-darwin).");
        }
        _ => {
            panic!(
                "Steam Bridge supports aarch64-apple-darwin, x86_64-pc-windows-msvc, \
                 and x86_64-unknown-linux-gnu; target was {target_arch}-{target_os}."
            );
        }
    }

    if target_os == "linux" {
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN");
    }

    println!("cargo:rerun-if-changed=src/steam_music_remote_bridge.cpp");
    let mut music_remote_bridge = cc::Build::new();
    music_remote_bridge
        .cpp(true)
        .file("src/steam_music_remote_bridge.cpp");
    if target_os == "windows" {
        music_remote_bridge.flag_if_supported("/std:c++17");
    } else {
        music_remote_bridge.flag("-std=c++17");
    }
    music_remote_bridge.compile("steam_bridge_music_remote");

    if target_os == "macos" {
        println!("cargo:rerun-if-changed=src/macos_metal_surface.mm");

        cc::Build::new()
            .cpp(true)
            .file("src/macos_metal_surface.mm")
            .flag("-std=c++17")
            .flag("-fobjc-arc")
            .compile("steam_bridge_metal_surface");

        println!("cargo:rustc-link-lib=framework=Cocoa");
        println!("cargo:rustc-link-lib=framework=Metal");
        println!("cargo:rustc-link-lib=framework=MetalKit");
        println!("cargo:rustc-link-lib=framework=QuartzCore");
    }
}
