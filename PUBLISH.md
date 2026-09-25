# Publish Notes

Pushing to `main` runs `.github/workflows/publish.yml`, which builds, zips and uploads to the Chrome Web Store. It skips the release when the tag `vX.Y.Z` for the `manifest.json` version already exists, so bump the version to publish; to retry a failed publish, re-run the failed job or run the workflow manually. It needs the `EXTENSION_ID`, `PUBLISHER_ID`, `CLIENT_ID`, `CLIENT_SECRET` and `REFRESH_TOKEN` secrets. A new permission in `manifest.json` also needs a justification in the dashboard's Privacy practices tab, or the publish step fails with HTTP 400. For a manual release:

1. Build and zip with the release file list:

    ```sh
    bun run pack:release
    ```

    It needs `7z` on the PATH, builds with debug logging off and creates `ChatGPTToolkitExtension_vX.Y.Z.zip`. The file list lives in `tools/pack-release.mjs` and `.github/workflows/publish.yml`; keep the two in sync.

    The debug-off build also rewrites the committed `scripts/content.js`; don't commit that change (run `bun run build` to restore it).

2. Publish to Chrome Web Store.

    <https://chrome.google.com/webstore/devconsole/1493e0a9-a65c-4e31-aefb-d9f27e0d8026/fmijcafgekkphdijpclfgnjhchmiokgp/edit/package>
