# Frenzi for Microsoft Edge

The browser half of **Frenzi**, a desktop companion for Windows: an animated character who chats with you, helps with your PC and does tasks for you. This extension lets her use the web in a window of her own in Microsoft Edge, with your sign-ins. She can check an order, compare products, or browse a site with you.

This repository holds the extension's full source, exactly as it is published on Microsoft Edge Add-ons. The Frenzi desktop app itself is developed separately.

## What it does

- **Local only:** it connects only to the Frenzi app on the same PC (`ws://127.0.0.1:47613`). Nothing is sent anywhere else, and it does nothing while Frenzi isn't running.
- **Her own window:** when Frenzi asks, it opens pages in a window of its own (a purple "Frenzi" tab group), reads them, and scrolls, clicks, types and goes back there. Your other tabs and windows are never read or touched.
- **No passwords:** it never types into a password field. You sign in to sites yourself.
- **No remote code:** all of its code is here. Frenzi sends only commands, such as "open this address", "read the page" or "click item 3".

Sending, posting and buying always show you the exact draft first, and CAPTCHAs are never solved. Both rules are enforced in the Frenzi app.

## Files

| File | What it is |
|---|---|
| `extension/manifest.json` | Manifest V3: permissions and the background service worker |
| `extension/background.js` | The connection to the Frenzi app, her window and tab, and the commands it accepts |
| `extension/page-reader.js` | What runs inside her tab: reading the page, and clicking and typing the way a person does |
| `extension/icon.png` | The icon |

## Privacy

See [PRIVACY.md](PRIVACY.md).

## Issues

Open an issue in this repository.

## License

MIT, see [LICENSE](LICENSE).
