export function publicationPages(item) {
  const candidates=[item?.paginas_i18n?.es,item?.enlace_pdf,item?.calidad_json];
  for(let value of candidates){
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{value=[value];}}
    if(Array.isArray(value)){
      const pages=value.map(p=>typeof p==='string'?p:p?.url||p?.src).filter(url=>typeof url==='string'&&/^https:\/\//i.test(url));
      if(pages.length)return pages;
    }
  }
  return [];
}
export function isPublicPublication(item){return item?.catalog_origin==='gimg'&&!item.archived_at&&item.estado_publicacion==='aprobado';}
