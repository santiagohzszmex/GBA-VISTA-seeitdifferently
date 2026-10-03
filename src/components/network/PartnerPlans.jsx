import React from 'react';
import PartnerEmblem from './PartnerEmblem';
import { Check, Monitor, List, Globe2 } from 'lucide-react';

const plans = [
  { id: 'free', name: 'Ficha de servidor', price: 'Gratis', caption: 'Durante el piloto', Icon: Globe2, features: ['Perfil de tu comunidad', 'IP, Discord y mapa', 'Administración con GBA ID'], action: 'Registrar servidor' },
  { id: 'directory', name: 'Directorio', price: 'Tarifa acordada', caption: 'Promoción por un periodo', Icon: List, features: ['Ficha en posición destacada', 'Identificación de patrocinio', 'Reporte de visitas y clics'], action: 'Consultar este espacio' },
  { id: 'hero', name: 'Pantalla completa', price: 'Tarifa acordada', caption: 'Un espacio para tu mundo', Icon: Monitor, features: ['Hero con tu imagen y mensaje', 'Periodo y entregables definidos', 'Reporte de exposición e interés'], action: 'Consultar este espacio' },
];

export default function PartnerPlans({ onChoose }) {
  return <section className="vn-partner-plans" aria-labelledby="partner-plans-title">
    <div className="vn-plans-window">
      <header className="vn-plans-toolbar"><PartnerEmblem size={20} monochrome/><span>GBA Partners</span></header>
      <div className="vn-plans-content">
        <div className="vn-plans-intro">
          <div className="vn-partner-emblem" aria-hidden="true"><PartnerEmblem size={64}/></div>
          <div><h2 id="partner-plans-title">Un lugar para tu comunidad.</h2><p>Empieza con una ficha gratuita. Dale más presencia a tu servidor cuando lo necesites.</p></div>
        </div>
        <div className="vn-plans-grid">{plans.map(({ id, name, price, caption, Icon, features, action }) => <article key={id} className={`vn-plan${id === 'hero' ? ' vn-plan-featured' : ''}`}>
          <header><Icon size={20}/><h3>{name}</h3></header>
          <div className="vn-plan-price"><strong>{price}</strong><span>{caption}</span></div>
          <ul>{features.map(feature => <li key={feature}><Check size={14}/>{feature}</li>)}</ul>
          <footer><button className="vn-aqua-button" onClick={() => onChoose(id)}>{action}</button></footer>
        </article>)}</div>
        <p className="vn-plans-footnote">Los espacios de promoción también se pueden combinar. La tarifa, duración y entregables se acuerdan antes de activar el patrocinio.</p>
      </div>
    </div>
  </section>;
}
