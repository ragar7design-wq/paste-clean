const INVISIBLE = [
  { re: /\u200B/g, name: 'Zero-Width Space', code: 'U+200B' },
  { re: /\u200C/g, name: 'Zero-Width Non-Joiner', code: 'U+200C' },
  { re: /\u200D/g, name: 'Zero-Width Joiner', code: 'U+200D' },
  { re: /\u2060/g, name: 'Word Joiner', code: 'U+2060' },
  { re: /\u200E/g, name: 'Left-to-Right Mark', code: 'U+200E' },
  { re: /\uFEFF/g, name: 'BOM / Zero-Width No-Break Space', code: 'U+FEFF' },
  { re: /\u00AD/g, name: 'Soft Hyphen', code: 'U+00AD' }
];

const LATIN_CYRILLIC_HOMOGLYPHS = {
  'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у', 'i': 'і'
};

export function inspectText(text) {
  const findings = [];
  let pos = 0;

  for (const { re, name, code } of INVISIBLE) {
    let m;
    while ((m = re.exec(text)) !== null) {
      findings.push({ type: 'invisible', name, code, index: m.index, char: m[0] });
      pos++;
    }
  }

  const words = text.match(/[a-zA-Zа-яА-ЯёЁ]{2,}/g) || [];
  for (const word of words) {
    const lower = word.toLowerCase();
    let hasLatin = false, hasCyrillic = false;
    for (const ch of lower) {
      if (/[a-z]/.test(ch)) hasLatin = true;
      if (/[а-яё]/.test(ch)) hasCyrillic = true;
    }
    if (hasLatin && hasCyrillic) {
      findings.push({ type: 'homoglyph', name: 'Homoglyph-смесь', code: 'mixed', index: text.indexOf(word), sample: word });
    }
  }

  const cleaned = INVISIBLE.reduce((t, { re }) => t.replace(re, ''), text);
  return {
    ok: true,
    findings,
    cleaned,
    stats: { count: findings.length, invisible: findings.filter(f => f.type === 'invisible').length, homoglyphs: findings.filter(f => f.type === 'homoglyph').length }
  };
}
