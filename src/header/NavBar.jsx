import { createEffect, createSignal } from "solid-js";

import { checkHasCredential } from "../checkHasCredential";
import { purgeDriveCache } from "../api/driveClient";
import { triggerFilesRequest } from "../main/triggerFilesRequest";
import { store } from "../index";

const NavBar = () => {
  createEffect(checkHasCredential);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  async function handleRefresh() {
    if (isRefreshing()) return;
    
    setIsRefreshing(true);
    try {
      // Purge the cache
      await purgeDriveCache();
      console.log("Cache purged successfully");
      
      // Reload the files
      // Determine which tab is active and reload accordingly
      const currentPath = window.location.pathname;
      let initSwitch = "drive";
      if (currentPath.includes("/shared")) {
        initSwitch = "shared";
      }
      
      await triggerFilesRequest(initSwitch);
      console.log("Files reloaded successfully");
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <navbar class="navbar bg-base-100 mb-2 shadow-xl">
      <div class="navbar-start">
        <a class="normal-case text-xl">GDrive Tree</a>
      </div>
      <div class="navbar-end gap-2">
        <button
          class={`btn btn-sm ${isRefreshing() ? "loading" : ""}`}
          onClick={handleRefresh}
          disabled={isRefreshing()}
        >
          {isRefreshing() ? "Refreshing..." : "Refresh Cache"}
        </button>
        <span class="badge badge-success">Connected</span>
      </div>
    </navbar>
  );
};

export default NavBar;
