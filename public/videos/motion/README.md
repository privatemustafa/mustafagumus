# Motion videos — manuel yükleme

`/motion` sayfasındaki videolar **buradan** yönetilir. Instagram scrape şart değil.

## Hızlı başlangıç

1. `.mp4` dosyanı buraya koy:
   ```
   public/videos/motion/01-dior-campaign.mp4
   ```

2. İsim / sıra için (isteğe bağlı) yanına meta dosyası ekle:
   ```
   public/videos/motion/01-dior-campaign.meta.json
   ```
   ```json
   {
     "title": "DIOR",
     "subtitle": "Campaign 2025",
     "order": 1
   }
   ```

3. Terminalde:
   ```bash
   npm run motion:sync
   ```

4. Tarayıcıda `/motion` sayfasını yenile.

## Dosya adı → başlık

Meta yoksa dosya adından üretilir:

| Dosya | Başlık |
|-------|--------|
| `01-dior-campaign.mp4` | Dior Campaign |
| `nike-air.mp4` | Nike Air |

Sıralama: dosya adındaki sayı (`01-`, `02-`…) veya alfabetik.

## Poster (kapak görseli)

Şunlardan biri yeterli:

- `posters/dior-campaign.jpg` (veya `.webp` / `.png`)
- Meta içinde `"poster": "/videos/motion/posters/..."`
- Instagram `vid-0041.mp4` ise otomatik: `/images/instagram/webp/img-0041.webp`

## Instagram linki ile tek tek ekle

Linkleri bana chat'te verebilirsin — ben indiririm. Kendin yapmak için:

```bash
npm run motion:add -- "https://www.instagram.com/p/ABC123/" --title "DIOR"
```

Birden fazla link:

```bash
npm run motion:add -- "URL1" "URL2" "URL3"
```

Veya `scripts/motion-urls.txt` dosyasına yaz (her satır `URL | Başlık`):

```bash
npm run motion:add -- --file scripts/motion-urls.txt
```

Varsayılan: dikey/kare videolar atlanır (`--allow-portrait` ile zorla).

Gereksinim: `brew install yt-dlp`

## Instagram'dan yatay videolar

Elimdeki Instagram reel'leri zaten `public/videos/instagram/` içindeyse:

```bash
npm run fetch-videos          # önce eksik videoları indir (yt-dlp)
npm run motion:import-instagram   # sadece yatay (landscape) olanları motion'a al + motion.json güncelle
```

Dikey / kare videolar motion'a **alınmaz** (portrait atlanır).

Kopya yerine symlink (disk tasarrufu):
```bash
npm run motion:import-instagram        # varsayılan: symlink
node scripts/import-motion-instagram.mjs --copy   # gerçek kopya
```

## Yeni video ekleme / silme

| İşlem | Ne yap |
|--------|--------|
| Ekle | `.mp4` (+ isteğe bağlı `.meta.json`) koy → `npm run motion:sync` |
| Sil | Dosyayı sil → `npm run motion:sync` |
| İsim değiştir | `.meta.json` içindeki `title` düzenle veya dosyayı yeniden adlandır → sync |

`src/data/motion.json` dosyasını **elle düzenleme** — `motion:sync` üzerine yazar. Kalıcı isimler için `.meta.json` kullan.

## Örnek meta

`my-reel.meta.json.example` dosyasına bak.
