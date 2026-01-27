import { createEffect } from "solid-js";

import { store } from "../index";
import { checkHasCredential } from "../checkHasCredential";

const NavBar = () => {
  createEffect(checkHasCredential);

  return (
    <navbar class="navbar bg-base-100 mb-2 shadow-xl">
      <div class="navbar-start">
        <a class="normal-case text-xl">GDrive Tree</a>
      </div>
      <div class="navbar-end">
        {store.hasCredential ? (
          <span class="badge badge-success">Connected</span>
        ) : (
          <span class="badge badge-error">Not Configured</span>
        )}
      </div>
    </navbar>
  );
};

export default NavBar;
