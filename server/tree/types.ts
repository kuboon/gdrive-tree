export interface DriveFile {
  parents: string[];
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
}

export interface WatchChannel {
  id: string;
  resourceId: string;
  expiration: number;
}
