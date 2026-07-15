# Harmonies of the World

An interactive 3D cosmic instrument inspired by Johannes Kepler's *Harmonices Mundi*.

## Publish with GitHub Pages

1. Create a new empty GitHub repository, ideally named `harmonies-of-the-world`.
2. Upload every file and folder from this project to the repository's `main` branch.
3. Open **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. Open the repository's **Actions** tab and wait for **Deploy to GitHub Pages** to finish.
6. The live URL will appear in the completed deployment and in **Settings → Pages**.

Typical URL:

`https://YOUR-USERNAME.github.io/harmonies-of-the-world/`

## Edit locally

```bash
npm install
npm run dev
```

Then edit:

- `src/main.js` for scenes, copy, motion, sound, and planet data
- `src/style.css` for the visual design
- `index.html` for the opening screen and interface structure

Every push to `main` automatically rebuilds and republishes the site.
