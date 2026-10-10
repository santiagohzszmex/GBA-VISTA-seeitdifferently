#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    let args: Vec<String> = std::env::args().collect();
    // Maintenance CLI only; no filesystem command is exposed to the webview.
    if args.get(1).map(String::as_str) == Some("--verify-update") {
        if args.len() != 4 || verify_update(&args[2], &args[3]).is_err() {
            eprintln!("Workspace update signature rejected");
            std::process::exit(1);
        }
        return;
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Workspace");
}

fn verify_update(file: &str, signature_file: &str) -> Result<(), Box<dyn std::error::Error>> {
    use base64::Engine;
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let public_key = config["plugins"]["updater"]["pubkey"].as_str().ok_or("Missing updater identity")?;
    let decode = |value: &str| -> Result<String, Box<dyn std::error::Error>> {
        Ok(String::from_utf8(base64::engine::general_purpose::STANDARD.decode(value.trim())?)?)
    };
    let key = minisign_verify::PublicKey::decode(&decode(public_key)?)?;
    let signature = minisign_verify::Signature::decode(&decode(&std::fs::read_to_string(signature_file)?)?)?;
    key.verify(&std::fs::read(file)?, &signature, false)?;
    Ok(())
}
