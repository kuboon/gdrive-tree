import "./style.css";
import "./trace.ts";
import { Folder } from "./Folder.tsx";
import { dispatch } from "./model.ts";

import { createRoot, type Handle } from "@remix-run/component";

const UP_FOLDER_ID = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh";
const DL_FOLDER_ID = "1PRWrByLt53bCQ5g1tbxKsqEzhKIpdsS7";

// Main App component
function App(_handle: Handle) {
  return () => (
    <div
      css={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1
        css={{
          fontSize: "24px",
          marginBottom: "20px",
          color: "#202124",
        }}
      >
        Google Drive Folder Tree
      </h1>
      <Folder
        setup={{
          folderId: UP_FOLDER_ID,
          name: "アップ用フォルダ",
          depth: 0,
          webViewLink: `https://drive.google.com/drive/folders/${UP_FOLDER_ID}`,
        }}
      />
      <Folder
        setup={{
          folderId: DL_FOLDER_ID,
          name: "ダウンロード用フォルダ",
          depth: 0,
          webViewLink: `https://drive.google.com/drive/folders/${DL_FOLDER_ID}`,
        }}
      />
    </div>
  );
}

// Initialize the app
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);

  // // 初期化時に両方のフォルダツリーをロード
  // dispatch({ type: "InitTreeStart", rootFolderId: UP_FOLDER_ID });
  // dispatch({ type: "InitTreeStart", rootFolderId: DL_FOLDER_ID });

  // Focus first folder on startup
  setTimeout(() => {
    dispatch({ type: "NavigateDown" });
  }, 0);
} else {
  console.error("Root element not found");
}
