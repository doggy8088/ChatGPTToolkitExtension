# Publish Notes

Pushing to `main` runs `.github/workflows/publish.yml`, which builds, zips and uploads to the Chrome Web Store. For a manual release:

1. Build and zip with the release file list:

    ```sh
    bun run pack:release
    ```

    It needs `7z` on the PATH, builds with debug logging off and creates `ChatGPTToolkitExtension_vX.Y.Z.zip`. The file list lives in `tools/pack-release.mjs` and `.github/workflows/publish.yml`; keep the two in sync.

    The debug-off build also rewrites the committed `scripts/content.js`; don't commit that change (run `bun run build` to restore it).

2. Publish to Chrome Web Store.

    <https://chrome.google.com/webstore/devconsole/1493e0a9-a65c-4e31-aefb-d9f27e0d8026/fmijcafgekkphdijpclfgnjhchmiokgp/edit/package>
