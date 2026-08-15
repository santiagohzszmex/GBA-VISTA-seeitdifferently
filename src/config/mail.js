export const GBA_MAIL = Object.freeze({
  inboxUrl: 'https://mail.zoho.com/zm/#mail/folder/inbox',
  composeUrl: 'https://mail.zoho.com/zm/#compose',
  personalAddress: 'santiago@gba.software',
  institutionalAddresses: [
    {
      address: 'contacto@gba.software',
      label: 'Contacto general',
      description: 'Consultas generales dirigidas a GBA y GIMG.',
      primary: true,
    },
    {
      address: 'prensa@gba.software',
      label: 'Prensa',
      description: 'Entrevistas, medios y comunicación editorial.',
    },
    {
      address: 'partners@gba.software',
      label: 'VISTA Partners',
      description: 'Propuestas comerciales y colaboraciones.',
    },
  ],
});
