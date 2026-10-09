# JellyGlance Website

Source for the JellyGlance product site at [jellyglance.com](https://jellyglance.com), built with VitePress. The app itself lives in [Nerdy-Technician/JellyGlance](https://github.com/Nerdy-Technician/JellyGlance). 

## Widget changes: open the Website PR first

`public/widgets/` holds the downloadable Homarr widget files, generated from the app's widget pack. When a JellyGlance change alters them, open the PR here first with the regenerated files (`JG_WEBSITE_DIR=<this checkout> npm run widgets:sync` in JellyGlance), then the JellyGlance PR. JellyGlance's widget check reads this repo's `main` and only warns, so it stays yellow until the Website PR is merged.

## Builds

In CI the build fails if JellyGlance releases can't be loaded from GitHub, so a stale version is never published and the last good deploy stays up. Local builds fall back to the `package.json` version with a warning.
