"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const htmlparser2_1 = require("htmlparser2");
const styleParser = require('style-parser');
const lodash_trim_1 = __importDefault(require("lodash.trim"));
let md5;
const tags = {
    'img': function (context, node) {
        context.children.push({
            type: 'img',
            src: node.attribs.src
        });
    },
    'a': function (context, node) {
        const children = node.children
            ? parseNodes(node.children, {
                options: context.options
            }).children
            : null;
        let href = node.attribs ? node.attribs.href : '___SELF_WIKI_LINK___';
        if (href !== '___SELF_WIKI_LINK___' && /^((?!https?:))/.test(href)) {
            href = '___SELF_WIKI_LINK___';
        }
        context.children.push({
            type: 'text',
            href,
            children: children
        });
    },
    'p': function (context, node) {
        tags['div'](context, node);
    },
    'note': function (context, node) {
        if (context.options && context.options.evernote) {
            let content;
            const pageContext = {
                type: 'page',
                options: context.options,
                children: []
            };
            node.children.forEach(function (child) {
                if (child.tagName === 'title') {
                    pageContext.title = firstChildContent(child);
                }
                else if (child.tagName === 'tag') {
                    if (!pageContext.tags) {
                        pageContext.tags = [];
                    }
                    pageContext.tags.push(firstChildContent(child));
                }
                else if (child.tagName === 'content') {
                    content = firstChildContent(child);
                }
                else if (child.tagName === 'resource') {
                    if (!md5) {
                        md5 = require('nano-md5');
                    }
                    const resource = {};
                    child.children.forEach(function (resourceChild) {
                        if (resourceChild.tagName === 'data') {
                            resource.encoded = firstChildContent(resourceChild);
                        }
                        else if (resourceChild.tagName === 'mime') {
                            resource.mime = firstChildContent(resourceChild);
                        }
                    });
                    if (/^image\/(png|jpeg|gif)$/.test(resource.mime)) {
                        const raw = Buffer.from(resource.encoded, 'base64');
                        const hash = md5.fromBytes(raw.toString('latin1')).toHex();
                        if (!pageContext.resources) {
                            pageContext.resources = {};
                        }
                        pageContext.resources[hash] = {
                            type: 'img',
                            mime: resource.mime,
                            data: resource.encoded
                        };
                    }
                }
            });
            if (content) {
                const contentNodes = parseHTML(content);
                if (pageContext.tags) {
                    pageContext.tags = pageContext.tags.sort();
                }
                parseNode(pageContext, {
                    children: contentNodes
                });
                delete pageContext.options;
                context.children.push(pageContext);
            }
        }
    },
    'en-media': function (context, node) {
        if (node.attribs && context.options.evernote) {
            context.children.push({
                type: 'reference',
                hash: node.attribs.hash
            });
        }
    },
    'br': singleNode.bind(null, 'br'),
    'td': function (context, node) {
        const simple = parseSimple(null, context, node);
        simple.type = 'td';
    },
    'tbody': ignore,
    'tr': function (context, node) {
        const result = {
            type: 'tr',
            children: [],
            options: context.options
        };
        if (node.children) {
            parseNodes(node.children.filter(function (node) {
                return node.tagName === 'td';
            }), result);
        }
        delete result.options;
        context.children.push(result);
    },
    'table': function (context, node) {
        const result = {
            type: 'table',
            children: [],
            options: context.options
        };
        if (node.children) {
            parseNodes(node.children, result);
        }
        delete result.options;
        context.children.push(result);
    },
    'span': parseStyle,
    'font': parseStyle,
    'code': traditionalCodeBlock,
    'pre': traditionalCodeBlock,
    'h1': parseHeader.bind(null, 5),
    'h2': parseHeader.bind(null, 4),
    'h3': parseHeader.bind(null, 3),
    'h4': parseHeader.bind(null, 2),
    'h5': parseHeader.bind(null, 1),
    'ol': list.bind(null, 'ol'),
    'ul': list.bind(null, 'ul'),
    'div': function (context, node) {
        if (context.options.evernote &&
            node.children &&
            node.children.length >= 1 &&
            node.children[0].tagName === 'en-todo') {
            const checkNode = node.children.shift();
            const result = {
                type: 'check',
                checked: checkNode.attribs && /^true$/i.test(checkNode.attribs.checked),
                children: [],
                options: context.options
            };
            parseSimple(null, result, checkNode);
            delete result.options;
            context.checkNode = result;
            return;
        }
        if (context.options.evernote &&
            node.children &&
            style(node, '-en-codeblock') === 'true') {
            const data = [];
            node.children.forEach(function (child) {
                if (child.tagName === 'div' &&
                    child.children.length === 1 &&
                    child.children[0].type === 'Text') {
                    data.push(firstChildContent(child));
                }
                else {
                    const content = collectConcatContents(child);
                    if (content !== '')
                        data.push(content);
                }
            });
            context.children.push({
                type: 'code',
                text: data.join('\n')
            });
            return;
        }
        if (node.children) {
            const newNode = parseNodes(node.children, {
                options: context.options
            });
            if (newNode.children && newNode.children.length > 0) {
                context.children.push({
                    type: 'div',
                    children: newNode.children
                });
            }
        }
    },
    'hr': singleNode.bind(null, 'hr'),
    'blockquote': parseSimple.bind(null, 'blockquote'),
    'b': parseSimple.bind(null, 'bold'),
    'strong': parseSimple.bind(null, 'bold'),
    'i': parseSimple.bind(null, 'italic'),
    'em': parseSimple.bind(null, 'italic'),
    'u': parseSimple.bind(null, 'underline'),
    's': parseSimple.bind(null, 'strike')
};
function parseNode(context, node) {
    try {
        if (!node.tagName) {
            if (node.type === 'Text') {
                context.children.push({
                    type: 'text',
                    text: node.content
                });
            }
        }
        const parser = tags[node.tagName];
        if (parser) {
            parser(context, node);
        }
        else if (node.type === 'Text') {
            parseSimple(null, context, node);
        }
        else {
            ignore(context, node);
        }
    }
    catch (e) {
        console.info('Node error is happend on');
        console.info(JSON.stringify(node, null, 4));
        console.error(e);
        throw new Error('ParseNodeError');
    }
}
function parseNodes(nodes, context) {
    if (!context.children) {
        context.children = [];
    }
    let checklist = null;
    const applyChecklist = function () {
        if (checklist) {
            context.children.splice(checklist.index, 0, {
                type: 'list',
                variant: 'ul',
                children: checklist.entries
            });
            checklist = null;
        }
    };
    nodes.forEach(function (node) {
        if (node.type === 'Text' && node.content === '\n') {
            return;
        }
        if (node.tagName === 'title') {
        }
        parseNode(context, node);
        if (context.checkNode) {
            if (!checklist) {
                checklist = {
                    index: context.children.length,
                    entries: []
                };
            }
            checklist.entries.push(context.checkNode);
            delete context.checkNode;
        }
        else if (node.tagName === 'br' || node.tagName === 'div') {
            applyChecklist();
        }
    });
    applyChecklist();
    return context;
}
function reduceSameProperties(parent) {
    if (parent.children.length === 0) {
        return parent;
    }
    let groupParent;
    ['bold', 'underline', 'strike', 'italic', 'href'].forEach(function (prop) {
        const value = parent.children[0][prop];
        for (let i = 1; i < parent.children.length; i++) {
            if (parent.children[i][prop] !== value) {
                return;
            }
        }
        parent.children.forEach(function (token) {
            delete token[prop];
        });
        if (value !== undefined) {
            if (!groupParent) {
                if (parent.type !== 'text') {
                    groupParent = {
                        type: 'text',
                        children: parent.children
                    };
                    parent.children = [groupParent];
                }
                else {
                    groupParent = parent;
                }
            }
            groupParent[prop] = value;
        }
    });
    return parent;
}
function parseSimple(variant, context, node) {
    let children;
    if (node.children) {
        children = parseNodes(node.children, {
            options: context.options
        }).children;
    }
    const result = {
        type: 'text',
        children: children
    };
    if (variant === 'blockquote') {
        result.blockquote = 1;
    }
    else if (variant) {
        result[variant] = true;
    }
    if (!context.children) {
        context.children = [];
    }
    if (context.type === 'list' && (node.tagName === 'ol' || node.tagName === 'ul')) {
        let pos = context.children.length - 1;
        let formerLi;
        do {
            formerLi = context.children[pos];
            pos--;
        } while ((!formerLi || !formerLi.children) && pos > -1);
        if (!formerLi) {
            formerLi = {
                type: 'text',
                children: []
            };
            context.children.push(formerLi);
        }
        else if (!formerLi.children) {
            formerLi.children = [];
        }
        formerLi.children.push({
            type: 'br'
        });
        formerLi.children.push({
            type: 'list',
            variant: node.tagName,
            children: result.children
        });
    }
    else {
        context.children.push(result);
    }
    return result;
}
function parseHeader(enlarge, context, node) {
    context.children.push({
        type: 'br'
    });
    const simpleNode = parseSimple(null, context, node);
    simpleNode.bold = true;
    simpleNode.enlarge = enlarge;
}
function traditionalCodeBlock(context, node) {
    context.children.push({
        type: 'code',
        text: collectConcatContents(node)
    });
}
function collectConcatContents(node) {
    const contents = [];
    if (node.content) {
        contents.push(node.content);
    }
    if (node.children) {
        node.children.forEach(function (child) {
            contents.push(collectConcatContents(child));
        });
    }
    return lodash_trim_1.default(contents.filter(t => {
        if (t === '')
            return false;
        return !(/^\n\s+$/.test(t));
    }).join(''));
}
function list(variant, context, node) {
    const result = {
        type: 'list',
        variant: variant,
        children: [],
        options: context.options
    };
    if (!node.children)
        return;
    node.children.forEach(function (child) {
        parseSimple(null, result, child);
    });
    delete result.options;
    context.children.push(result);
}
function ignore(context, node) {
    if (node.children) {
        parseNodes(node.children, context);
    }
}
function parseStyle(context, node) {
    const fontSize = style(node, 'font-size');
    let parsed;
    let enlarge = 0;
    if (fontSize && (parsed = /^([0-9]+)\s*px\s*$/i.exec(fontSize))) {
        const num = parseInt(parsed[1], 10);
        if (num > 68) {
            enlarge += 1;
        }
        if (num > 56) {
            enlarge += 1;
        }
        if (num > 42) {
            enlarge += 1;
        }
        if (num > 30) {
            enlarge += 1;
        }
        if (num > 21) {
            enlarge += 1;
        }
    }
    const bold = style(node, 'font-weight') === 'bold';
    const italic = /(^|\s)italic(\s|$)/i.test(style(node, 'font-style'));
    const underline = /(^|\s)underline(\s|$)/i.test(style(node, 'text-decoration')) ||
        (context.options.evernote && style(node, '-evernote-highlight') === 'true');
    const strikeThrough = /(^|\s)line-through(\s|$)/i.test(style(node, 'text-decoration'));
    const addedNode = parseSimple(null, context, node);
    if (enlarge !== 0) {
        addedNode.enlarge = enlarge;
        addedNode.bold = true;
    }
    if (bold) {
        addedNode.bold = true;
    }
    if (underline) {
        addedNode.underline = true;
    }
    if (strikeThrough) {
        addedNode.strike = true;
    }
    if (italic) {
        addedNode.italic = true;
    }
}
function style(node, prop) {
    if (!node.style) {
        if (!node.attribs || !node.attribs.style) {
            return '';
        }
        try {
            node.style = styleParser(node.attribs.style);
        }
        catch (e) {
            return '';
        }
    }
    return node.style[prop] || '';
}
function firstChildContent(node) {
    if (!node.children) {
        return;
    }
    if (node.children.length === 0) {
        return;
    }
    return node.children[0].content;
}
function singleNode(type, context) {
    const obj = { type: type };
    if (type === 'br')
        obj.force = true;
    context.children.push(obj);
}
function reduceSimpleNodes(parent) {
    parent.children = parent.children.filter(function (token) {
        if (token.type !== 'text') {
            return true;
        }
        if (token.children) {
            return true;
        }
        if (token.text === undefined || token.text === null) {
            return false;
        }
        if (/^\s+$/i.test(token.text)) {
            return false;
        }
        token.text = lodash_trim_1.default(token.text);
        return true;
    });
    let allText = true;
    parent.children.forEach(function (token) {
        if (token.children) {
            token = reduceSimpleNodes(token);
        }
        if (token.type !== 'text') {
            allText = false;
        }
        if (token.type === 'text' &&
            token.children &&
            token.children.length === 1 &&
            (token.children[0].type === 'text' ||
                token.children[0].type === 'img')) {
            const targetToken = token.children[0];
            if (token.href && targetToken.href) {
                return;
            }
            token.type = targetToken.type;
            if (targetToken.src) {
                token.src = targetToken.src;
            }
            if (targetToken.href) {
                token.href = targetToken.href;
            }
            if (targetToken.bold || token.bold) {
                token.bold = true;
            }
            if (targetToken.italic || token.italic) {
                token.italic = true;
            }
            if (targetToken.strike || token.strike) {
                token.strike = true;
            }
            if (targetToken.underline || token.underline) {
                token.underline = true;
            }
            if (targetToken.enlarge) {
                token.bold = true;
                token.enlarge = (token.enlarge || 0) + targetToken.enlarge;
            }
            if (targetToken.blockquote) {
                token.blockquote = (token.blockquote || 0) + targetToken.blockquote;
            }
            if (targetToken.children) {
                token.children = targetToken.children;
            }
            else {
                delete token.children;
            }
            if (targetToken.text) {
                token.text = targetToken.text;
            }
            else {
                delete token.text;
            }
        }
    });
    if (allText && parent.children.length > 1) {
        parent = reduceSameProperties(parent);
    }
    parent.children = parent.children.filter(function (token) {
        if (!token.children && Object.prototype.hasOwnProperty.call(token, 'children')) {
            delete token.children;
        }
        return !token.children || token.children.length !== 0 || parent.type === 'tr';
    });
    return parent;
}
function parseHTML(input) {
    let current = {};
    const stack = [];
    const root = current;
    const parser = new htmlparser2_1.Parser({
        onopentag: function (name, attribs) {
            stack.push(current);
            const next = {
                tagName: name
            };
            if (Object.keys(attribs).length > 0) {
                next.attribs = attribs;
            }
            if (!current.children) {
                current.children = [];
            }
            current.children.push(next);
            current = next;
        },
        ontext: function (text) {
            if (!current.children) {
                current.children = [];
            }
            if (current.children.length > 0 && current.children[current.children.length - 1].type === 'Text') {
                current.children[current.children.length - 1].content += text;
            }
            else {
                current.children.push({
                    type: 'Text',
                    content: text
                });
            }
        },
        onclosetag: function (tagName) {
            if (current.tagName === tagName) {
                current = stack.pop();
                return;
            }
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].tagName === tagName) {
                    while (stack.length > i) {
                        current = stack.pop();
                    }
                    return;
                }
            }
        }
    }, {
        recognizeCDATA: true,
        decodeEntities: true
    });
    parser.write(String(input));
    parser.end();
    return root.children || [];
}
exports.parse = function (input, options = {}) {
    const htmlNodes = parseHTML(input);
    let parseResult = parseNodes(htmlNodes, {
        title: null,
        options: options,
        children: []
    });
    delete parseResult.options;
    parseResult = reduceSimpleNodes(parseResult);
    if (parseResult.children.length === 0) {
        return [];
    }
    let allPages = true;
    if (parseResult.type === 'page') {
        allPages = false;
    }
    else {
        for (let i = 0; i < parseResult.children.length; i++) {
            if (parseResult.children[i].type !== 'page') {
                allPages = false;
                break;
            }
        }
    }
    if (!allPages) {
        return [parseResult];
    }
    return parseResult.children;
};
//# sourceMappingURL=parse.js.map