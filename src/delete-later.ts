import { generateFolderHash } from "./utils/folder-hash";
const downloadPath = "/Users/pranav/programming/modelith-cli/downloads"
import { NotebookAnalyzer } from "./utils/NotebookAnalyzer";

// console.log(await generateFolderHash(downloadPath))

const notebookAnalyzer = new NotebookAnalyzer("/Users/pranav/programming/modelith-cli/duplicate/22bce1010.ipynb");
console.log(notebookAnalyzer.toJson())
notebookAnalyzer.saveAstToFile()