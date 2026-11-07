# Frenzi for Microsoft Edge: privacy policy

Last updated: 7 November 2026

The Frenzi extension (source: https://github.com/PrakashMandal-IV/frenzi-edge-extension) connects Microsoft Edge to the Frenzi desktop companion app running on the same Windows PC. It lets the companion open and use web pages in a browser window of its own, with your sign-ins. This policy covers only the extension. The Frenzi app has its own settings for what it remembers and which AI model it uses.

## What the extension does

- It connects only to the Frenzi app on your own computer, at `ws://127.0.0.1:47613`. It never contacts any other server, the developer's included.
- When the Frenzi app asks, it opens pages in one browser window of its own, reads them and uses them: it scrolls, clicks, types and goes back. It never reads or changes your other tabs and windows.
- What it reads (the text of that page, and a list of its links, buttons and fields) is passed straight to the Frenzi app on your computer.
- It never types into password fields, and it never reads cookies, saved passwords, browsing history or form autofill data.
- It does nothing at all while the Frenzi app isn't running.

## What is stored

The extension stores only the ID of its own window and tab, in Edge's session storage, which is cleared when Edge closes. It keeps no copy of any page.

## What leaves your computer

The extension itself sends nothing anywhere except to the Frenzi app on the same PC.

The Frenzi app may send page text to the AI model you chose in its settings, so the model can decide what to do next: a cloud model (through OpenRouter) or a local model (Ollama, which stays on your PC). That is governed by the Frenzi app's settings and by that provider's own policy.

## Sharing and sale

No data is sold, shared with third parties, used for advertising, or used for any purpose other than the browsing you or your companion asked for.

## Removing it

Remove the extension at any time from `edge://extensions`. Nothing of it remains on your computer.

## Contact

Questions about this policy or the extension: open an issue at https://github.com/PrakashMandal-IV/frenzi-edge-extension/issues
