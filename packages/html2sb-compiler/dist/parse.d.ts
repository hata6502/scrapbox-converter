interface SimpleTag {
    bold?: boolean;
    underline?: boolean;
    italic?: boolean;
    strike?: boolean;
    blockquote?: number;
}
interface Node extends SimpleTag {
    tagName?: string;
    attribs?: {
        [key: string]: string;
    };
    children?: Node[];
    type?: string;
    content?: string;
    enlarge?: number;
    href?: string;
    variant?: 'ul';
    resources?: Resource[];
}
interface Resource {
    encoded?: string;
    mime?: string;
}
interface PageContext {
    checkNode?: PageContext;
    type?: string;
    options?: any;
    children?: Array<Node | PageContext>;
    title?: string;
    tags?: Node[];
    resources?: {
        [key: string]: {
            data: string;
            type: 'img';
            mime: string;
        };
    };
}
export declare const parse: (input: string, options?: {}) => (Node | PageContext)[];
export {};
