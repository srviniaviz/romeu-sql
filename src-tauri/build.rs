fn main() {
    // stronghold-runtime pulls in windows 0.36, whose import library maps
    // WaitOnAddress/WakeByAddress* to vertdll.dll (an enclave-only DLL). If that
    // library wins the link order, the exe crashes on startup with 0xc0000005.
    // Linking the SDK's synchronization.lib first pins them to the real DLL.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-lib=dylib=synchronization");
    }
    tauri_build::build()
}
