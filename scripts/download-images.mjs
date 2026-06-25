import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const OUT_DIR = path.resolve('public/images/instagram');

// Post thumbnails + carousel frames collected from @mustafagumus______
const IMAGE_URLS = [
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/568446699_18058329257551227_7496697736377781192_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=uTjUAxwOwjUQ7kNvwHAKwGL&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af9LlR6michb2Fb_dfYUGT-noQSKrufpnT2x5UBp08BHug&oe=6A437718&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/564846660_18057219398551227_5324425683496264300_n.jpg?stp=dst-jpg_e35_s640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=cre8LTeU9LoQ7kNvwFvv4Sz&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af9dqPTKV8dHFeX7OidxTg261KZ-HMP7WQVKPSzneIlMDQ&oe=6A437394&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.71878-15/624734408_1527915568297827_7777008697500228981_n.jpg?stp=dst-jpg_e15_s640x640_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=pql5opWbUBoQ7kNvwH7nVsZ&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af9qji7dyjiZaXwa1vfuTeouA2JhOVr-BFEDU5i38-16DQ&oe=6A43715C&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.2885-15/500950729_18042312254551227_4747842489744447976_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=ixnEihr3JvsQ7kNvwEgKyWK&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af-R7A3lNCuRBpXKlmV7EMBFfm4xyt3HsFRpWikW9ZKxOg&oe=6A436A62&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/725621207_18083933615551227_1852472645750458972_n.jpg?stp=dst-jpg_e35_s640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=7OljP-CLn2gQ7kNvwEjuK5G&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af_z4NCGYwOguF1BxhaHEDE2WzwL4krDo3cW5ixL1J7cqg&oe=6A4378A8&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/720101152_18082955471551227_5212861190580170594_n.jpg?stp=dst-jpg_e35_s640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=Mw96OpE-xQgQ7kNvwHi0sUA&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af9hEqScZibYeYPLlTmKEnbXxzbKbY3h40E8m6k77Dp71A&oe=6A4366D3&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/713263325_18082282310551227_1203920350191257534_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=-HXgnkSQjhEQ7kNvwH0dc2w&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af-1d-7TAXBNgpLxskfymCB-wT-KDyTs3g_VEHlBbqbpow&oe=6A4385B0&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/686449585_18079081433551227_7385688495240097581_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=1ZgzhkDmwQ0Q7kNvwEietaa&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af_4P3lrcGrO7mJxe3eVpgH_Sm00pu8JfI61hBc6qIpJqA&oe=6A439494&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/702683986_18080674118551227_8496291499908968793_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=qkK-RHMdKWkQ7kNvwGt0UDe&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af9S00emJixcsVJeIfUF8C9b1vEIZv6IguUDA41mtAV0Rg&oe=6A43656E&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/701420614_18080306117551227_5329561692848422063_n.jpg?stp=dst-jpg_e15_s640x640_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=gyTGg37l51YQ7kNvwGRQrWR&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af8Lesc5i2M9T3C3sA5lYjuQRWov5In4cvsHMQ2ljB58aA&oe=6A437961&_nc_sid=8b3546',
  'https://instagram.fteq3-3.fna.fbcdn.net/v/t51.82787-15/698639696_18080019518551227_6236247680257908825_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_ht=instagram.fteq3-3.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=togRO07w-UcQ7kNvwH4ZnjJ&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af9ACHT0q9Th5eVDelXk5GAQyWYSGTUQzfaSbFpjOfLlJw&oe=6A4396B8&_nc_sid=8b3546',
  'https://instagram.fteq3-2.fna.fbcdn.net/v/t51.71878-15/624679041_892265586727340_7320346821086096916_n.jpg?stp=dst-jpg_e15_s640x640_tt6&_nc_ht=instagram.fteq3-2.fna.fbcdn.net&_nc_cat=108&_nc_oc=Q6cZ2gFW85LPDf2zf1jxMRhWFBPhEodIkq9rVloHS2XmsYkC5i6r-c69yfjLlypQ6Ia3CdM&_nc_ohc=F_b4EWqFq8YQ7kNvwF9SB9X&_nc_gid=GF9XyxLlNgEQx9Ge9HEy2g&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af_iqrtcleRyM6GBlXb3IF_dG85nXZwfVPLdfnIbokOAaA&oe=6A436B4D&_nc_sid=8b3546',
];

async function download(url, index) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Failed ${index}: ${res.status}`);
  const dest = path.join(OUT_DIR, `img-${String(index).padStart(3, '0')}.jpg`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}

await mkdir(OUT_DIR, { recursive: true });
const manifest = [];

for (let i = 0; i < IMAGE_URLS.length; i++) {
  try {
    const file = await download(IMAGE_URLS[i], i + 1);
    manifest.push({ id: i + 1, src: `/images/instagram/img-${String(i + 1).padStart(3, '0')}.jpg` });
    console.log(`✓ ${file}`);
  } catch (e) {
    console.error(`✗ img ${i + 1}:`, e.message);
  }
}

await writeFile(
  path.resolve('src/data/images.json'),
  JSON.stringify(manifest, null, 2),
);
console.log(`\nDone: ${manifest.length} images`);
