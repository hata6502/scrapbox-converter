import * as fs from "node:fs";
import * as path from "node:path";
import loadEnexFile from "./loader/enex";
import loadHtmlFile from "./loader/html";
import loadMdFile from "./loader/md";

const findAndLoadFiles = async (files, basePath = "./") =>
  await Promise.all(
    (Array.isArray(files) ? files : [files]).map(async (file) => {
      const fullPath = path.resolve(basePath, file);
      const stats = fs.lstatSync(fullPath);
      const isFile = stats.isFile();
      const isDir = stats.isDirectory();
      let title = "";
      let lines = [];
      if (isFile) {
        const ext = path.extname(fullPath);
        if (/\.(?:markdown|md)/.test(ext)) {
          title = path.basename(fullPath, ext);
          const scrapboxStyleText = await loadMdFile(fullPath);
          lines = scrapboxStyleText.split("\n");
          lines.unshift(title);
        } else if (/\.(?:html|htm)/.test(ext)) {
          const res = await loadHtmlFile(fullPath);
          title = res.title || path.basename(fullPath, ext);
          lines = res.lines;
          lines.unshift(title);
        } else if (/\.(?:enex)/.test(ext)) {
          try {
            return (await loadEnexFile(fullPath)).map((res) => {
              title = res.title || path.basename(fullPath, ext);
              lines = res.lines;
              lines.unshift(title);
              return { title, lines };
            });
          } catch (e) {
            console.log(e.message);
            process.exit(1);
          }
        } else {
          return;
        }
        return { title, lines };
        // biome-ignore lint/style/noUselessElse: todo
      } else if (isDir) {
        return findAndLoadFiles(fs.readdirSync(fullPath), fullPath);
      }
    }),
  );

export default findAndLoadFiles;
