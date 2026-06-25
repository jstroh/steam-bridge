extern crate napi_build;

fn main() {
    napi_build::setup();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
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
