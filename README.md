# yes-no-interactive-website

A mini funny interactive website mocking a YouTube shorts post I saw online and trying to replicate its functionality.

**Live demo:** https://canadasung.github.io/yes-no-interactive-website/
**Live demo (Traditional Chinese):** https://canadasung.github.io/yes-no-interactive-website/zh-hant/

The page asks "Will you be my Valentine?" with a Yes and a No button. Each click on No
shrinks it, grows Yes toward the center, and swaps in a new reaction image with an
escalating caption. After five No clicks, No starts dodging the cursor, until Yes is
clicked and a closing screen appears.

## Running locally

This is a static site (HTML, CSS, JS) with no build step. A Python environment is
only needed to serve the files locally.

```bash
conda env create -f environment.yml
conda activate yes-no-interactive-website
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Project structure

- `index.html`, `style.css`, `script.js` - page structure, styling, and interaction logic
  for the English version.
- `zh-hant/index.html`, `zh-hant/script.js` - Traditional Chinese translation of the same
  page. It reuses the root `style.css` and `images/` folder, so only the text strings are
  duplicated; styling and pictures stay in sync automatically.
- `images/` - reaction images shown for each No click (`no-0` through `no-5`) and the
  celebration image shown after clicking Yes (`yes`). Replace these files with your own
  pictures to customize the page; the filenames are referenced directly in `script.js`
  and `index.html`.

## License

MIT License
