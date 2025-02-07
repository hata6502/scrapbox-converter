import * as fs from "node:fs";
import * as path from "node:path";
import md2sb from "../../src/main";

export default async (t, type) => {
  const markdown = fs.readFileSync(
    path.resolve("test/fixtures/md/" + type + ".md"),
  );
  const input = await md2sb(markdown);
  const expect = fs
    .readFileSync(path.resolve("test/fixtures/scrapbox/" + type + ".txt"))
    .toString();
  t.is(input, expect);
};
