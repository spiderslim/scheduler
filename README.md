<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/dfc43c54-8a7f-491d-96d9-e80286cd25f8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env` file and set `GEMINI_API_KEY` to your Gemini API key (see [.env.example](.env.example)). Optionally set `GEMINI_MODEL` (defaults to `gemini-3.5-flash`) and `PORT` (defaults to `3000`).
3. Run the app:
   `npm run dev`

The Gemini API key is read server-side only (via `dotenv` in [server.ts](server.ts)) and is never bundled into the client.
