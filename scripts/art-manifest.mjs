// public/assets/art/*.png 를 훑어 manifest.json을 만든다.
// 슬롯(src/data/art.ts)에 없는 이름이나 크기가 다른 파일은 제외하고 이유를 출력한다.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ART_SLOTS } from '../src/data/art.ts';

const dir = fileURLToPath(new URL('../public/assets/art/', import.meta.url));
const slots = new Map(ART_SLOTS.map((s) => [s.key, s]));

function pngSize(buf) {
  const sig = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== sig || buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const files = {};
const problems = [];
for (const name of (await readdir(dir)).sort()) {
  if (!name.endsWith('.png')) continue;
  const key = name.slice(0, -4);
  const slot = slots.get(key);
  if (!slot) {
    problems.push(`${name}: 알 수 없는 슬롯 이름`);
    continue;
  }
  const size = pngSize(await readFile(join(dir, name)));
  if (!size) {
    problems.push(`${name}: PNG가 아님`);
    continue;
  }
  if (size.w !== slot.w || size.h !== slot.h) {
    problems.push(`${name}: ${size.w}x${size.h}, 필요한 크기 ${slot.w}x${slot.h}`);
    continue;
  }
  files[key] = name;
}
await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version: 1, files }, null, 2) + '\n');
const missing = ART_SLOTS.filter((s) => !files[s.key]).map((s) => s.key);
console.log(`교체 아트 ${Object.keys(files).length}/${ART_SLOTS.length}개 등록`);
if (problems.length) console.log(`제외:\n  ${problems.join('\n  ')}`);
if (missing.length) console.log(`기본 스프라이트 사용: ${missing.join(', ')}`);
