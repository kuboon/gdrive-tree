import File from "./File.jsx";
import Folder from "./Folder.jsx";
import { isFolder } from "./node.js";

const Node = ({ node, mustAutofocus }) => {
  if (isFolder(node)) {
    return <Folder node={node} mustAutofocus={mustAutofocus} />;
  } else {
    return <File node={node} mustAutofocus={mustAutofocus} />;
  }
};

export default Node;
