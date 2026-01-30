import { store } from "./index.jsx";

export function checkHasCredential() {
  // Since the server exits if GOOGLE_DRIVE_TOKEN is not set,
  // we can assume credentials are always available when the server is running
  
  // These lines trigger reactive effects in SolidJS when nodes state changes
  store.nodes.isLoading;
  store.nodes.isInitialised;
  
  if (store.isExternalLibLoaded) {
    if (store.hasCredential !== true) {
      setStore("hasCredential", () => true);
    }
  }
}
