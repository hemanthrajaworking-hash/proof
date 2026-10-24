# How to put the proof site online (free)

Nothing is published yet. Both options are free and need Hemanth's own account.

## Option 1: Netlify Drop (simplest, about 2 minutes)
1. Hemanth signs in at https://app.netlify.com/drop (free account, needs his email).
2. Drag the whole `proof-site` folder onto the page.
3. Netlify gives a URL like `https://<random-name>.netlify.app`. Rename it in Site settings (for example `hemanth-finance-automation`).
Note: without signing in, a dropped site is deleted after about 1 hour, so he must sign in.

## Option 2: GitHub Pages (best long-term, matches the "github.io" proof check)
1. Hemanth signs in to GitHub (free) and creates a public repo named `proof` (or `<username>.github.io`).
2. Upload all files in this folder (Add file → Upload files), keeping the folders.
3. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
4. After about 1 minute it is live at `https://<username>.github.io/proof/`.

## After it is live
Send the base URL back. The 7 proof slots get these URLs (set `public: true`):
- finops-agent → <BASE>/work/finops-agent/
- eval-lab → <BASE>/work/eval-lab/
- voice-rag-agent → <BASE>/work/voice-rag-agent/
- ap-automation → <BASE>/work/ap-automation/
- invoice-extractor → <BASE>/work/invoice-extractor/
- fpa-variance-forecast → <BASE>/work/fpa-variance-forecast/
- gst-itc-recon → <BASE>/work/gst-itc-recon/
Hand-written pages (listed on the home page by build.py; their HTML is not regenerated):
- seller-payout-demo → <BASE>/work/seller-payout-demo/
- seller-payout-case-study → <BASE>/work/seller-payout-case-study/
Group pages: <BASE>/offers/agencies.html, /offers/bookkeepers.html, /offers/sellers.html.

To rebuild after edits: `python3 build.py` (build.py can be left out of the upload).
