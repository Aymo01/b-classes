export function pageMeta(title: string, description: string) {
  return { meta: [
    { title: `${title} | B classes` },
    { name: 'description', content: description },
    { property: 'og:title', content: `${title} | B classes` },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] };
}