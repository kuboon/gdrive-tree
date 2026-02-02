import { createSignal } from "solid-js";

import { triggerFilesRequest } from "../main/triggerFilesRequest.js";

const NavBar = () => {
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleRefresh() {
    if (isRefreshing()) return;

    setIsRefreshing(true);
    setError("");
    try {
      // Reload the files with refresh=true
      // Determine which tab is active and reload accordingly
      const currentPath = globalThis.location.pathname;
      let initSwitch = "drive";
      if (currentPath.includes("/shared")) {
        initSwitch = "shared";
      }

      await triggerFilesRequest(initSwitch, true); // Pass refresh=true
      console.log("Files refreshed successfully");
    } catch (err) {
      console.error("Failed to refresh:", err);
      setError("Failed to refresh. Please try again.");
      setTimeout(() => setError(""), 5000); // Clear error after 5 seconds
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
        {error() && <span class="badge badge-error">{error()}</span>}
        <button
          type="button"
          class={`btn btn-sm ${isRefreshing() ? "btn-disabled" : ""}`}
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
