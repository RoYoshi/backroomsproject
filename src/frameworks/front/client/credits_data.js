/* THE FAR BACKROOMS - credits.  EDIT THIS FILE to change the Credits page; the layout never needs touching.
 *
 * - Each section has a heading and a list of entries. A section with no entries is not shown, so you can keep empty
 *   ones ready and fill them in later.
 * - An entry is { name, note, url }: name is required; note (a role, or a line about them) and url (a link) are optional.
 * - A section can have a paragraph instead of (or as well as) entries: text: '...'. Links inside text use
 *   links: [{ label, url }], shown after the paragraph.
 * - Only list real people and real software. Nothing here is generated.
 * - version is the build number the main menu shows in its bottom-right corner (package.json's version).
 */
window.TFB_CREDITS = {
  version: '23.3.6',
  sections: [
    { heading: 'Created by', entries: [
      { name: 'RoYoshi', note: 'The Far Backrooms' },
    ] },
    { heading: 'Design', entries: [] },
    { heading: 'Art', entries: [] },
    { heading: 'Sound', entries: [] },
    { heading: 'Playtesting', entries: [] },
    { heading: 'Special thanks', entries: [] },
    { heading: 'Source material',
      text: 'Level 0 environment and entity behaviour are adapted from The Backrooms Wiki, used under the Creative Commons Attribution-ShareAlike 3.0 licence.',
      links: [
        { label: 'Level 0', url: 'https://backrooms-wiki.wikidot.com/level-0' },
        { label: 'Hound', url: 'https://backrooms-wiki.wikidot.com/entity-8' },
        { label: 'Smilers', url: 'https://backrooms-wiki.wikidot.com/entity-3' },
        { label: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
      ] },
    { heading: 'Software', entries: [
      { name: 'PixiJS', note: 'The 2D WebGL renderer (version 8.21.0, as bundled). MIT License.', url: 'https://pixijs.com' },
    ] },
    { heading: 'Typefaces', entries: [
      { name: 'Barlow Condensed', note: 'Jeremy Tribby. SIL Open Font License 1.1.', url: 'https://fonts.google.com/specimen/Barlow+Condensed' },
      { name: 'IBM Plex Mono', note: 'IBM. SIL Open Font License 1.1.', url: 'https://fonts.google.com/specimen/IBM+Plex+Mono' },
    ] },
  ],
};
