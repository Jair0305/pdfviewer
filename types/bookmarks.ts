export interface Bookmark {
  id:               string;
  relativeFilePath: string;
  pageNumber:       number;
  label:            string;
  createdAt:        string;
}

export interface BookmarksData {
  bookmarks:  Bookmark[];
  updatedAt:  string;
}
