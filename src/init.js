// No browser-based OAuth needed - tokens are managed server-side via environment variables
import { setStore } from "./index";

// Set as loaded immediately since we don't need to load external OAuth libraries
setStore("isExternalLibLoaded", () => true);

window.onload = function () {
  // Provide a 'mod' function which compute correctly the modulo
  // operation over negative numbers
  Number.prototype.mod = function (n) {
    return ((this % n) + n) % n;
  };
};
