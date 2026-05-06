use std::env;
use std::path::PathBuf;

fn main() {
    let lib_path = if let Ok(p) = env::var("PDFIUM_LIB_PATH") {
        PathBuf::from(p)
    } else {
        let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        manifest.join("../../vendor/pdfium/release/lib")
    };

    let include_path = if let Ok(p) = env::var("PDFIUM_INCLUDE_PATH") {
        PathBuf::from(p)
    } else {
        let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        manifest.join("../../vendor/pdfium/release/include")
    };

    let lib_path = lib_path.canonicalize().expect("pdfium lib path does not exist");
    println!("cargo:rustc-link-search=native={}", lib_path.display());
    println!("cargo:rustc-link-lib=dylib=pdfium");

    // Export the lib path so downstream crates can find it
    println!("cargo:lib_path={}", lib_path.display());

    // Run bindgen
    let bindings = bindgen::Builder::default()
        .header("wrapper.h")
        .clang_arg(format!("-I{}", include_path.display()))
        .allowlist_function("FPDF.*")
        .allowlist_function("FPDFText_.*")
        .allowlist_function("FPDFPage.*")
        .allowlist_function("FPDFLink_.*")
        .allowlist_function("FPDFFont_.*")
        .allowlist_type("FPDF.*")
        .allowlist_type("FS_.*")
        .allowlist_var("FPDF.*")
        .derive_debug(true)
        .derive_default(true)
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
