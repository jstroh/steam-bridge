extern crate napi_build;

use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

fn main() {
    napi_build::setup();

    let target = env::var("TARGET").unwrap_or_default();
    let host = env::var("HOST").unwrap_or_default();
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

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
    println!("cargo:rerun-if-changed=src/steam_game_coordinator_bridge.cpp");
    println!("cargo:rerun-if-changed=src/steam_header_only_bridge.cpp");
    let mut cpp_shims = cc::Build::new();
    cpp_shims
        .cpp(true)
        .file("src/steam_music_remote_bridge.cpp")
        .file("src/steam_game_coordinator_bridge.cpp")
        .file("src/steam_header_only_bridge.cpp");
    if target_os == "windows" {
        cpp_shims.flag_if_supported("/std:c++17");
    } else {
        cpp_shims.flag("-std=c++17");
    }
    configure_linux_cross_archive_tools(&mut cpp_shims, &host, &target);
    cpp_shims.compile("steam_bridge_cpp_shims");

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

fn configure_linux_cross_archive_tools(build: &mut cc::Build, host: &str, target: &str) {
    if host != "aarch64-apple-darwin" || target != "x86_64-unknown-linux-gnu" {
        return;
    }

    println!("cargo:rerun-if-env-changed=PATH");

    if !archive_env_tool_is_set("AR", target) {
        let ar = find_tool("llvm-ar").unwrap_or_else(|| {
            panic!(
                "cross-compiling Steam Bridge for Linux from macOS requires llvm-ar; \
                 install LLVM or set AR_x86_64_unknown_linux_gnu"
            )
        });
        build.archiver(ar);
    }

    if !archive_env_tool_is_set("RANLIB", target) {
        if let Some(ranlib) = find_tool("llvm-ranlib") {
            build.ranlib(ranlib);
        }
    }
}

fn archive_env_tool_is_set(tool: &str, target: &str) -> bool {
    let target_underscore = target.replace('-', "_");
    let env_names = [
        format!("{tool}_{target}"),
        format!("{tool}_{target_underscore}"),
        format!("TARGET_{tool}"),
        tool.to_string(),
    ];

    for name in &env_names {
        println!("cargo:rerun-if-env-changed={name}");
    }

    env_names.iter().any(|name| env::var_os(name).is_some())
}

fn find_tool(tool: &str) -> Option<PathBuf> {
    let path_candidates = env::var_os("PATH").into_iter().flat_map(|paths| {
        env::split_paths(&paths)
            .map(move |dir| dir.join(tool))
            .collect::<Vec<_>>()
    });

    let homebrew_candidates = [
        PathBuf::from("/opt/homebrew/opt/llvm/bin").join(tool),
        PathBuf::from("/usr/local/opt/llvm/bin").join(tool),
    ];

    path_candidates
        .chain(homebrew_candidates)
        .find(|candidate| is_executable_tool(candidate))
}

fn is_executable_tool(candidate: &Path) -> bool {
    candidate.is_file()
        && Command::new(candidate)
            .arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|status| status.success())
}
