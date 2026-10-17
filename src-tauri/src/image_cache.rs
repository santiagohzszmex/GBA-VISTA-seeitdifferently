// Only opaque account/hash keys are accepted. No arbitrary filesystem API.
use tauri::Manager;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
fn directory(app: &tauri::AppHandle, owner: &str) -> Result<PathBuf,String> {
    if owner.is_empty() || owner.len()>64 || !owner.bytes().all(|x|x.is_ascii_alphanumeric()||x==b'-') {return Err("Cuenta inválida".into());}
    Ok(app.path().app_cache_dir().map_err(|_|"Caché no disponible")?.join("originals-v1").join(owner))
}
fn path(app: &tauri::AppHandle, owner: &str, sha: &str) -> Result<PathBuf,String> {
    if sha.len()!=64 || !sha.bytes().all(|b| b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err("Huella inválida".into());}
    Ok(directory(app,owner)?.join(sha))
}
#[tauri::command]
pub fn workspace_image_cache_get(app: tauri::AppHandle, owner: String, sha: String)->Result<tauri::ipc::Response,String>{
    let file=path(&app,&owner,&sha)?;
    let bytes=std::fs::read(file).unwrap_or_default();
    if !bytes.is_empty() && format!("{:x}",Sha256::digest(&bytes))!=sha{return Err("Caché corrupta".into());}
    if !bytes.is_empty(){if let Ok(f)=std::fs::File::open(path(&app,&owner,&sha)?){let _=f.set_modified(std::time::SystemTime::now());}}
    Ok(tauri::ipc::Response::new(bytes))
}
#[tauri::command]
pub fn workspace_image_cache_put(app: tauri::AppHandle, request: tauri::ipc::Request<'_>)->Result<(),String>{
    let header=|key|request.headers().get(key).and_then(|v|v.to_str().ok()).ok_or("Caché inválida");
    let owner=header("x-workspace-owner")?;let sha=header("x-workspace-sha")?;
    let bytes=match request.body(){tauri::ipc::InvokeBody::Raw(bytes)=>bytes,_=>return Err("Se requieren bytes".into())};
    if format!("{:x}",Sha256::digest(bytes))!=sha{return Err("Huella incorrecta".into());}
    let file=path(&app,owner,sha)?;std::fs::create_dir_all(file.parent().ok_or("Caché inválida")?).map_err(|_|"Caché no disponible")?;
    let temporary=file.with_extension("pending");std::fs::write(&temporary,bytes).map_err(|_|"Caché llena")?;
    // replace only our own immutable hash entry (rename replacement differs on Windows).
    if file.exists(){let _=std::fs::remove_file(&file);}std::fs::rename(&temporary,&file).map_err(|_|"No se pudo guardar la caché")?;
    // Disposable original cache: bounded separately from upload/file limits.
    let max_cache_bytes: u64=512*1024*1024;
    if let Ok(entries)=std::fs::read_dir(file.parent().ok_or("Caché inválida")?){
        let mut files:Vec<_>=entries.filter_map(Result::ok).filter_map(|e|{let m=e.metadata().ok()?;if !m.is_file(){return None;}Some((e.path(),m.len(),m.modified().unwrap_or(std::time::UNIX_EPOCH)))}).collect();
        files.sort_by_key(|f|f.2);let mut total:u64=files.iter().map(|f|f.1).sum();
        for (old,len,_) in files{if total<=max_cache_bytes{break;}if old!=file&&std::fs::remove_file(old).is_ok(){total-=len;}}
    }
    Ok(())
}
#[tauri::command]
pub fn workspace_image_cache_remove(app: tauri::AppHandle,owner:String,sha:String)->Result<(),String>{let file=path(&app,&owner,&sha)?;let _=std::fs::remove_file(file);Ok(())}
#[tauri::command]
pub fn workspace_image_cache_clear(app: tauri::AppHandle,owner:String)->Result<(),String>{let dir=directory(&app,&owner)?;let _=std::fs::remove_dir_all(dir);Ok(())}
