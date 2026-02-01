const FIXED_FIELDS =
  "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)";
const params = new URLSearchParams();
params.append("key", Deno.env.get("GOOGLE_KEY")!);
params.append("includeItemsFromAllDrives", "true");
params.append("supportsAllDrives", "true");

params.append("orderBy", "modifiedTime desc");
params.append("pageSize", "50");

params.append("fields", FIXED_FIELDS);
// Build query for folder contents
const folderId = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh"; // up folder
const query = `'${folderId}' in parents and trashed=false`;
params.append("q", query);

const response = await fetch(
  `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
);
const json = await response.json();

console.log(json.files);
