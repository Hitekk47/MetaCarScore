export function toSlug(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\+/g, ' plus')
    .replace(/&/g, 'and')
    .replace(/°/g, '')
    .replace(/\./g, '-')
    .normalize('NFD') // Décompose les accents (é -> e + ')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    .replace(/[^\w\-]+/g, '') // Supprime tout ce qui n'est pas mot ou tiret (ex: ' & .)
    .replace(/\-\-+/g, '-') // Remplace les tirets multiples par un seul
    .replace(/^-+/, '') // Coupe les tirets au début
    .replace(/-+$/, ''); // Coupe les tirets à la fin
}