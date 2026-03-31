// Standard Vercel Serverless Function entrypoint.
// This shim imports the real server logic from the internal server package.
import handler from "../server/src/vercel-entry.js";

export default handler;
