import { store, setStore } from "./index";

export async function checkHasCredential() {
  // Since the server exits if GOOGLE_DRIVE_TOKEN is not set,
  // we can assume credentials are always available when the server is running
  store.nodes.isLoading;
  store.nodes.isInitialised;
  if (store.isExternalLibLoaded) {
    if (store.hasCredential !== true) {
      setStore("hasCredential", () => true);
    }
  }
}
