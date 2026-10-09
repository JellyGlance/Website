# JellyGlance Website

Source for the JellyGlance product site at [jellyglance.com](https://jellyglance.com), built with VitePress. The app itself lives in [Nerdy-Technician/JellyGlance](https://github.com/Nerdy-Technician/JellyGlance). Install and configuration guides live separately at [docs.jellyglance.com](https://docs.jellyglance.com) ([source](https://github.com/JellyGlance/Documentation)).

This site was moved here from the `site/` folder of the JellyGlance repo, with its history.

## Local development

Requires Node 22 or newer.

```sh
npm ci
npm run dev      # http://localhost:5174
npm run build    # outputs .vitepress/dist
npm run preview
```

Release notes, stars, downloads and the roadmap are fetched from GitHub at build time. Set `GITHUB_TOKEN` to avoid rate limits.

## Adding a press mention

Add a card to the top of the `press-grid` in `press.md`, and put any image in `public/press/`.

## Homarr widget files

`public/widgets/` holds the downloadable Homarr widget files. They're generated from the app's widget pack, so regenerate them from a JellyGlance checkout with:

```sh
node scripts/widget-files.mjs --out <path-to-this-repo>/public/widgets
```

## Deploying

`.github/workflows/pages.yml` publishes to GitHub Pages on every push to `main`, and once a day so release notes and the roadmap stay current. `public/CNAME` holds the `jellyglance.com` domain.

The roadmap board reads a GitHub Project. If the default token can't see it, add a `SITE_BOT_TOKEN` secret with `read:project`.
