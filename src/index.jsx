import "./index.css";
import App from "./App.jsx";
import { getRicherNode } from "./main/tree/node.js";
import { rootId } from "./globalConstant.js";

import { render } from "solid-js/web";
import { createStore } from "solid-js/store";
import { Router } from "solid-app-router";

const defaultRootNode = (() => {
  const res = {
    ...getRicherNode(
      {
        id: rootId,
        name: "ROOT",
        mimeType: "application/vnd.google-apps.folder",
      },
      null,
    ),
    isExpanded: true,
  };
  delete res.height;
  return res;
})();

const defaultStore = {
  nodes: {
    content: { root: defaultRootNode },
    isInitialised: false,
    isLoading: false,
  },
};

export const [store, setStore] = createStore(defaultStore);

render(() => {
  return (
    <Router>
      <App />
    </Router>
  );
}, document.getElementById("app"));

if (import.meta.hot) {
  // console.log("Hot reload");
}

// TODO: watch the resize event to set the body width and eventually display
//      an horizontal scroll bar
