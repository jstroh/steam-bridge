extern crate napi_build;

use std::env;
use std::fs;
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

    link_sdk_encrypted_app_ticket(&target, &target_os);

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

fn link_sdk_encrypted_app_ticket(target: &str, target_os: &str) {
    let sdk_root = find_steamworks_sdk_root().unwrap_or_else(|| {
        panic!(
            "Steam SDK root was not found. Set STEAM_SDK_LOCATION, STEAMWORKS_SDK_PATH, \
             or STEAM_BRIDGE_SDK_PATH so sdkencryptedappticket can be linked."
        )
    });
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is set by Cargo"));

    let (sdk_folder, files, link_lib) = if target_os == "macos" {
        (
            "osx",
            vec!["libsdkencryptedappticket.dylib"],
            "sdkencryptedappticket",
        )
    } else if target_os == "linux" {
        (
            "linux64",
            vec!["libsdkencryptedappticket.so"],
            "sdkencryptedappticket",
        )
    } else if target.contains("windows") {
        (
            "win64",
            vec!["sdkencryptedappticket64.dll", "sdkencryptedappticket64.lib"],
            "sdkencryptedappticket64",
        )
    } else {
        panic!("Unsupported target for sdkencryptedappticket: {target}");
    };

    let lib_dir = sdk_root
        .join("public")
        .join("steam")
        .join("lib")
        .join(sdk_folder);
    for file in files {
        let source = lib_dir.join(file);
        let destination = out_dir.join(file);
        fs::copy(&source, &destination).unwrap_or_else(|error| {
            panic!(
                "failed to copy {} to {}: {error}",
                source.display(),
                destination.display()
            )
        });
        if target_os == "linux" && file == "libsdkencryptedappticket.so" {
            set_linux_soname(&destination, "libsdkencryptedappticket.so");
        }
    }

    println!("cargo:rustc-link-search={}", out_dir.display());
    println!("cargo:rustc-link-lib=dylib={link_lib}");
}

fn find_steamworks_sdk_root() -> Option<PathBuf> {
    for name in [
        "STEAM_SDK_LOCATION",
        "STEAMWORKS_SDK_PATH",
        "STEAM_BRIDGE_SDK_PATH",
    ] {
        println!("cargo:rerun-if-env-changed={name}");
        if let Some(root) = env::var_os(name).map(PathBuf::from) {
            if is_steamworks_sdk_root(&root) {
                return Some(root);
            }
        }
    }

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").ok()?);
    let repo_sdk = manifest_dir.join("..").join("..").join("sdk");
    if is_steamworks_sdk_root(&repo_sdk) {
        return Some(repo_sdk);
    }

    for root in cargo_registry_src_roots() {
        let candidate = root.join("steamworks-sys-0.13.0").join("lib").join("steam");
        if is_steamworks_sdk_root(&candidate) {
            return Some(candidate);
        }
    }

    None
}

fn cargo_registry_src_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let cargo_home = env::var_os("CARGO_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".cargo")));

    if let Some(cargo_home) = cargo_home {
        let registry_src = cargo_home.join("registry").join("src");
        if let Ok(entries) = fs::read_dir(registry_src) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    roots.push(path);
                }
            }
        }
    }

    roots
}

fn is_steamworks_sdk_root(root: &Path) -> bool {
    root.join("public")
        .join("steam")
        .join("steamencryptedappticket.h")
        .is_file()
}

fn set_linux_soname(library: &Path, soname: &str) {
    println!("cargo:rerun-if-env-changed=PATH");
    if let Some(patchelf) = find_tool("patchelf") {
        let status = Command::new(&patchelf)
            .arg("--set-soname")
            .arg(soname)
            .arg(library)
            .status()
            .unwrap_or_else(|error| {
                panic!("failed to run {}: {error}", patchelf.display());
            });
        if !status.success() {
            panic!("failed to set SONAME on {}", library.display());
        }
    } else {
        println!(
            "cargo:warning=patchelf was not found; Linux release builds may record an absolute \
             path for libsdkencryptedappticket.so"
        );
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
