import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { term } from '../src/i18n/terms';
it('coverage', () => {
  const d = JSON.parse(readFileSync('/workspace/vocab/labels.json','utf8'));
  for (const [id, v] of Object.entries<any>(d)) {
    const all = [...v.metrics, ...v.phases, ...v.labels.map((l: string)=>l.replace(/#/g,'3'))];
    const bad = all.filter((s: string) => /[\u3400-\u9fff]/.test(term(id, s, 'en')));
    console.log(id, all.length, 'untranslated', bad.length, bad.slice(0,12).join(' | '));
    console.log('  sample:', all.slice(-6).map((s: string)=>term(id,s,'en')).join(' | '));
  }
});
