const menu = document.querySelector('[data-menu]');
const menuButton = document.querySelector('[data-menu-button]');
function closeMenu() { menu?.classList.remove('is-open'); menuButton?.setAttribute('aria-expanded','false'); }
menuButton?.addEventListener('click', () => {
  const open = menu.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded',String(open));
});
menu?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape' && menu?.classList.contains('is-open')){closeMenu();menuButton.focus();}});
// Keep the same public pages working on the company domain and on the VISTA fallback URL.
const prefix = location.hostname === 'gba.software' || location.hostname === 'www.gba.software' ? '' : '/gba';
document.querySelectorAll('[data-page]').forEach(link=>{link.href = `${prefix}/${link.dataset.page}`;});
const sectionLinks = [...document.querySelectorAll('[data-section]')];
const observer = new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
    sectionLinks.forEach(link=>{if(link.dataset.section===entry.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }
},{rootMargin:'-20% 0px -60% 0px'});
sectionLinks.forEach(link=>{const target=document.getElementById(link.dataset.section);if(target)observer.observe(target);});
const art=document.querySelector('.hero-art');
if(art){const visibility=new IntersectionObserver(([entry])=>art.classList.toggle('is-visible',entry.isIntersecting));visibility.observe(art);}
