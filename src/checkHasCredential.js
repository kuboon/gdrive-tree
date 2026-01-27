import { store, setStore } from "./index";
import { checkHasCredential as checkCredentialAPI } from "./api/driveClient";

export async function checkHasCredential() {
  // WARNING: this if to check the store.nodes.isLoading signal is necessary to
  //          trigger the run of this effect when the load is done
  store.nodes.isLoading;
  store.nodes.isInitialised;
  if (store.isExternalLibLoaded) {
    try {
      const result = await checkCredentialAPI();
      const newHasCredential = result.hasCredential;
      if (store.hasCredential !== newHasCredential) {
        setStore("hasCredential", () => newHasCredential);
      }
    } catch (err) {
      console.error("Failed to check credentials", err);
      if (store.hasCredential !== false) {
        setStore("hasCredential", () => false);
      }
    }
  }
}
