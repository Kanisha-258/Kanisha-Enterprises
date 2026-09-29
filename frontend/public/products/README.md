# Images

The product catalogue references images by path, e.g. `/products/paddy-seeds.jpg`.
Any referenced file that is **missing** renders as a branded placeholder panel
rather than a broken image, so the site looks finished even before photos are
added. Adding real photos makes it look better.

## `products/`

Square-ish photos work best (the cards crop to a 4:3 box on the listing page
and a square on the detail page). Aim for roughly **800 × 800 px**, under
150 KB each.

```
paddy-seeds.jpg        basmati-paddy.jpg      hybrid-paddy.jpg
wheat-seeds.jpg        durum-wheat.jpg        tomato-seeds.jpg
brinjal-seeds.jpg      chilli-seeds.jpg       cucumber-seeds.jpg
watermelon-seeds.jpg   muskmelon-seeds.jpg    marigold-seeds.jpg
sunflower-seeds.jpg    mustard-seeds.jpg      potato-seeds.jpg
bio-fertilizer.jpg     npk-fertilizer.jpg     growth-booster.jpg
vermicompost.jpg       crop-protection.jpg    neem-pesticide.jpg
fungicide.jpg          herbicide.jpg          hand-sprayer.jpg
trowel-set.jpg
```

`npm run seed` in `backend/` inserts these paths. The full list of what the
database currently references:

```bash
cd backend && npm run db:status
```

## `blog/`

Landscape images, roughly **1200 × 675 px** (16:9).

```
kharif-guide.jpg  ...and the rest of seedBlogs.js
```

Posts with a missing cover show a dark green branded panel instead.

## Tips

- Keep filenames lowercase with hyphens — they become part of the URL.
- Update a product's image from **/admin → Products → Edit**, or the path is set
  at seed time in `backend/seed.js`.
- Compress before adding. [squoosh.app](https://squoosh.app) is free and needs
  no upload — everything runs in your browser.
- Farmers are often on slow mobile data. Large photos are the most common
  cause of a slow site.
