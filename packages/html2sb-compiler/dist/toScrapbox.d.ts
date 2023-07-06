declare function toSimpleText(node: any): any;
declare function toScrapbox(tokens: any): {
    title: string;
    lines: string[];
};
declare namespace toScrapbox {
    var toSimpleText: typeof import("./toScrapbox").toSimpleText;
}
export { toSimpleText, toScrapbox };
