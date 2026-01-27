import { createSignal, createEffect } from "solid-js";

import { store, setStore } from "../index";
import { checkHasCredential } from "../checkHasCredential";
import { revokeToken } from "../api/driveClient";

const NavBar = () => {
  let [buttonStyle, setButtonStyle] = createSignal("btn-disabled");

  createEffect(checkHasCredential);

  createEffect(() => {
    if (store.hasCredential) {
      setButtonStyle(() => "");
    } else {
      setButtonStyle(() => "btn-disabled");
    }
  });

  async function handleClick() {
    try {
      await revokeToken();
      setStore("hasCredential", () => false);
      // Clear the session storage
      sessionStorage.removeItem("gdrive_session_id");
    } catch (err) {
      console.error("Failed to revoke token", err);
    }
  }

  return (
    <navbar class="navbar bg-base-100 mb-2 shadow-xl">
      <div class="navbar-start">
        <a class="normal-case text-xl">GDrive Tree</a>
      </div>
      <div class="navbar-end">
        <span
          class={`btn ${buttonStyle()} normal-case text-sm`}
          onClick={handleClick}
        >
          Revoke authorisation
        </span>
      </div>
    </navbar>
  );
};

export default NavBar;
