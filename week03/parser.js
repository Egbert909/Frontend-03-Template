const css = require("css");
const EOF = Symbol("EOF"); //EOF: End of File
let currentToken = null;
let currentAttribute = null;
let stack = [{type: "document", children: []}]
let currentTextNode = null;
let rules = [];

function addCSSRules(text) {
    var ast = css.parse(text);
    rules.push(...ast.stylesheet.rules);
}

function match(element, selector) { // assume selector can only be id, class or tag selector
    if (!selector || !element.attributes) {
        return false;
    }

    if (selector.charAt(0) === "#") {
        var attr = element.attributes.filter(attr => attr.name === 'id')[0];
        if (attr && attr.value === selector.replace("#", '')) {
            return true;
        }
    } else if (selector.charAt(0) === ".") {
        var attr = element.attributes.filter(attr => attr.name === 'class')[0];
        if (attr && attr.value === selector.replace(".", '')) {
            return true;
        }
    } else {
        if (element.tagName === selector) {
            return true;
        }
    }
    return false;
}

function specificity(selector) {
    var p = [0, 0, 0, 0];
    var selectorParts = selector.split(" ");
    for (var part of selectorParts) {
      if (part.charAt(0) == "#") {
        p[1] += 1;
      } else if (part.charAt() == ".") {
        p[2] += 1;
      } else {
        p[3] += 1;
      }
    }
    return p;
  }
  
  function compare(sp1, sp2) {
    if (sp1[0] - sp2[0]) {
      return sp1[0] - sp2[0];
    }
    if (sp1[1] - sp2[1]) {
      return sp1[1] - sp2[1];
    }
    return sp1[3] - sp2[3];
  }

function computeCSS(element) {
    // stack will always store the current element and all the parents of the current element
    // but stack will be changed while we parse the html
    // so we need to call slice() to take a snap shot of the current stack 
    // and the reason for calling reverse is that we need to start from the current element
    // and go from current to the most outside ancestor element(the document element)
    var elements = stack.slice().reverse();
    if (!element.computedStyle) {
        element.computedStyle = {};
    }

    for (let rule of rules) {
        var selectorParts = rule.selectors[0].split(" ").reverse();

        if (!match(element, selectorParts[0])) {
            continue;
        }

        let matched = false;

        var j = 1;
        for (var i = 0; i < elements.length; i++) {
            if (match(elements[i], selectorParts[j])) {
                j++;
            }
        }

        if (j >= selectorParts.length) {
            matched = true;
        }

        if (matched) {
            var sp = specificity(rule.selectors[0]);
            var computedStyle = element.computedStyle;
            for (var declaration of rule.declarations) {
              if (!computedStyle[declaration.property]) {
                computedStyle[declaration.property] = {};
              }
              if (!computedStyle[declaration.property].specificity) {
                computedStyle[declaration.property].value = declaration.value;
                computedStyle[declaration.property].specificity = sp;
              } else if (compare(computedStyle[declaration.property].specificity, sp) < 0) {
                computedStyle[declaration.property].value = declaration.value;
                computedStyle[declaration.property].specificity = sp;
              }
            }
            console.log(element.computedStyle);
          }
    }
}

function emit(token) {
    let top = stack[stack.length - 1];

    if (token.type === "startTag") {
        let element = {
            type: "element",
            children: [],
            attributes: []
        }

        element.tagName = token.tagName;

        for (let p in token) {
            if (p !== "type" && p !== "tagName" && p !== "isSelfClosing") { // In winter's code the p !== "isSelfClosing" is missing
                element.attributes.push({
                    name: p,
                    value: token[p]
                });
            }
        }

        computeCSS(element);

        top.children.push(element);
        element.parent = top;

        if (!token.isSelfClosing) {
            stack.push(element);
        }
        
        currentTextNode = null;
    } else if (token.type === "endTag") {
        if (top.tagName !== token.tagName) {
            throw new Error("Tag start end doesn't match!");
        } else {
            if (top.tagName === "style") {
                // Assume there is only text content in a style tag
                addCSSRules(top.children[0].content);
            }
            stack.pop();
        }
        currentTextNode = null;
    } else if (token.type === "text") {
        if (currentTextNode === null) {
            currentTextNode = {
                type: "text",
                content: ""
            }
            top.children.push(currentTextNode);
        }
        currentTextNode.content += token.content;
    }
}

function data(c) {
    if (c === "<") {
        return tagOpen;
    } else if (c === EOF) {
        emit({
            type: "EOF"
        });
        return ;
    } else {
        emit({
            type: "text",
            content:c
        })
        return data;
    }
}

function tagOpen(c) {
    if (c === "/") {
        return endTagOpen;
    } else if (c.match(/^[a-zA-Z]$/)) {
        currentToken = {
            type: "startTag",
            tagName: ""
        };
        return tagName(c);
    } else {
        return ;
    }
}

function endTagOpen(c) {
    if (c.match(/^[a-zA-Z]$/)) {
        currentToken = {
            type: "endTag",
            tagName: ""
        };
        return tagName(c);
    } else if (c === ">") {
        
    } else if (c === EOF) {
        
    } else {

    }
}

function tagName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c === "/") { // it's a selfClosingTag like <br/>, but it seems like either <br> or <br/> is considered as self-clsoing tag
        return selfClosingStartTag;
    } else if (c.match(/^[a-zA-Z]$/)) { // this character is still part of the tagName
        currentToken.tagName += c;  //.toLowerCase();
        return tagName; // continue consuming the next tagName character
    } else if (c === ">") { // it's a start tag
        emit(currentToken);
        return data;
    } else {
        return tagName;
    }
}

function beforeAttributeName(c) { // we eat up all the characters except for ">"
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c === "/" || c === ">" || c === EOF) {
        return afterAttributeName(c);
    } else if (c === "=") {
        
    } else {
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}

function attributeName(c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c == ">" || c === EOF){
        return afterAttributeName(c);
    } else if (c === "=") {
        return beforeAttributeValue;
    } else if (c === "\u0000") {

    } else if (c === "\"" || c === "'" || c === "<") {

    } else {
        currentAttribute.name += c;
        return attributeName;
    }
}

function beforeAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c == ">" || c === EOF) {
        return beforeAttributeValue; 
    } else if (c === "\"") {
        return doubleQuotedAttributeValue;
    } else if (c === "\'") {
        return singleQuotedAttributeValue;
    } else if (c === ">") {

    } else {
        return UnquotedAttributeValue(c);
    }
}

function doubleQuotedAttributeValue(c) {
    if (c === "\"") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {

    } else if (c === EOF) {

    } else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}

function singleQuotedAttributeValue(c) {
    if (c === "\'") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {

    } else if (c === EOF) {

    } else {
        currentAttribute.value += c;
        // return doubleQuotedAttributeValue; // teacher's code, might be a mistake?
        return singleQuotedAttributeValue;
    }    
}

function afterQuotedAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c === "/") {
        return selfClosingStartTag;
    } else if (c === ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === EOF) {

    } else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }     
}

function UnquotedAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c == ">" || c === EOF) {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    } else if (c === "/") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    } else if (c === ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === "\u0000") {

    } else if (c === "\"" || c === "'" || c === "<" || c === "=" || c === "`") {

    } else if (c === EOF) {

    } else {
        currentAttribute.value += c;
        return UnquotedAttributeValue;
    }    
}

function afterAttributeName(c) {
    return data;
}

function selfClosingStartTag(c) {
    if (c === ">") {
        currentToken.isSelfClosing = true;
        emit(currentToken); // reminded by comment Morty
        return data;
    } else if (c === "EOF") {

    } else {

    }
}

module.exports.parseHTML = function parseHTML(html) {
    let state = data;
    for (let c of html) {
        state = state(c);
    }
    state = state(EOF);
    console.log(stack[0]);
}