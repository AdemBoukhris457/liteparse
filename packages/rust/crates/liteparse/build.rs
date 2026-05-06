use std::env;
use std::path::PathBuf;

fn main() {
    // Resolve pdfium dylib path the same way pdfium-sys does
    let lib_path = if let Ok(p) = env::var("PDFIUM_LIB_PATH") {
        PathBuf::from(p)
    } else {
        let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        manifest.join("../../vendor/pdfium/release/lib")
    };

    if let Ok(lib_path) = lib_path.canonicalize() {
        println!("cargo:rustc-link-arg=-Wl,-rpath,{}", lib_path.display());
    }
}
