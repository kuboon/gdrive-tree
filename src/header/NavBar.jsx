import { createEffect } from "solid-js";

import { checkHasCredential } from "../checkHasCredential";

const NavBar = () => {
  createEffect(checkHasCredential);

  return (
    <navbar class="navbar bg-base-100 mb-2 shadow-xl">
      <div class="navbar-start">
        <a class="normal-case text-xl">GDrive Tree</a>
      </div>
      <div class="navbar-end">
        <span class="badge badge-success">Connected</span>
      </div>
    </navbar>
  );
};

export default NavBar;
