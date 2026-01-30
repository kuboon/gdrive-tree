// No browser-based OAuth needed - tokens are managed server-side via environment variables
import { setStore } from "./index.jsx";

// Set as loaded immediately since we don't need to load external OAuth libraries
setStore("isExternalLibLoaded", () => true);
