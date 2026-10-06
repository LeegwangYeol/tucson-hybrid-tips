/**
 * Lightweight Zero-Dependency HTML5 DOM Parser & Query Engine for E2E Testing
 * Provides querySelector, querySelectorAll, getElementById, textContent, attributes.
 */

class DOMNode {
  constructor(tagName = '', attributes = {}, parentNode = null) {
    this.tagName = tagName.toUpperCase();
    this.attributes = attributes;
    this.id = attributes.id || '';
    this.className = attributes.class || '';
    this.classList = new Set(this.className.split(/\s+/).filter(Boolean));
    this.parentNode = parentNode;
    this.children = [];
    this.childNodes = []; // Can contain text nodes and elements
    this.rawText = '';
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  hasAttribute(name) {
    return this.attributes[name] !== undefined;
  }

  get textContent() {
    if (this.rawText && this.childNodes.length === 0) return this.rawText;
    let text = '';
    for (const child of this.childNodes) {
      if (typeof child === 'string') {
        text += child;
      } else if (child instanceof DOMNode) {
        text += child.textContent;
      }
    }
    return text;
  }

  getElementById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const match = child.getElementById(id);
      if (match) return match;
    }
    return null;
  }

  getElementsByTagName(tag) {
    const results = [];
    const targetTag = tag.toUpperCase();
    function walk(node) {
      for (const child of node.children) {
        if (targetTag === '*' || child.tagName === targetTag) {
          results.push(child);
        }
        walk(child);
      }
    }
    walk(this);
    return results;
  }

  getElementsByClassName(cls) {
    const results = [];
    function walk(node) {
      for (const child of node.children) {
        if (child.classList.has(cls)) {
          results.push(child);
        }
        walk(child);
      }
    }
    walk(this);
    return results;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    const resultSet = new Set();

    for (const sel of selectors) {
      const parts = sel.split(/\s+/).filter(Boolean);
      let currentCandidates = this.children.slice();
      // Collect all descendants initially if first selector
      const allDescendants = [];
      function collectAll(n) {
        for (const c of n.children) {
          allDescendants.push(c);
          collectAll(c);
        }
      }
      collectAll(this);

      let matchedNodes = allDescendants.filter(n => matchSimple(n, parts[0]));

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part === '>') {
          const nextPart = parts[++i];
          const nextMatches = [];
          for (const parent of matchedNodes) {
            for (const child of parent.children) {
              if (matchSimple(child, nextPart)) {
                nextMatches.push(child);
              }
            }
          }
          matchedNodes = nextMatches;
        } else {
          const nextMatches = [];
          for (const ancestor of matchedNodes) {
            function findDescendants(node) {
              for (const c of node.children) {
                if (matchSimple(c, part)) {
                  nextMatches.push(c);
                }
                findDescendants(c);
              }
            }
            findDescendants(ancestor);
          }
          matchedNodes = nextMatches;
        }
      }

      for (const node of matchedNodes) {
        resultSet.add(node);
      }
    }

    return Array.from(resultSet);
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }
}

function matchSimple(node, selector) {
  if (!selector) return false;

  // Handle [attr=value] or [attr]
  const attrRegex = /\[([a-zA-Z0-9_\-]+)(?:([*^$]?=)(["']?)(.*?)\3)?\]/g;
  let cleanSel = selector;
  const attrConditions = [];
  let attrMatch;
  while ((attrMatch = attrRegex.exec(selector)) !== null) {
    attrConditions.push({
      name: attrMatch[1],
      op: attrMatch[2] || '',
      val: attrMatch[4] !== undefined ? attrMatch[4] : null
    });
  }
  cleanSel = selector.replace(attrRegex, '');

  for (const cond of attrConditions) {
    const nodeVal = node.getAttribute(cond.name);
    if (cond.val === null) {
      if (nodeVal === null) return false;
    } else if (cond.op === '=') {
      if (nodeVal !== cond.val) return false;
    } else if (cond.op === '^=') {
      if (!nodeVal || !nodeVal.startsWith(cond.val)) return false;
    } else if (cond.op === '$=') {
      if (!nodeVal || !nodeVal.endsWith(cond.val)) return false;
    } else if (cond.op === '*=') {
      if (!nodeVal || !nodeVal.includes(cond.val)) return false;
    }
  }

  if (!cleanSel) return true;

  // Parse tag#id.class1.class2
  const parts = cleanSel.match(/^([a-zA-Z0-9_\-*]*)(?:#([a-zA-Z0-9_\-]+))?((?:\.[a-zA-Z0-9_\-]+)*)$/);
  if (!parts) return false;

  const [, tag, id, classes] = parts;

  if (tag && tag !== '*' && node.tagName !== tag.toUpperCase()) {
    return false;
  }
  if (id && node.id !== id) {
    return false;
  }
  if (classes) {
    const classList = classes.split('.').filter(Boolean);
    for (const c of classList) {
      if (!node.classList.has(c)) return false;
    }
  }

  return true;
}

class DOMParser {
  parse(htmlString) {
    const root = new DOMNode('DOCUMENT', {}, null);
    const tagRegex = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9\-]+)((?:\s+[a-zA-Z0-9_\-:@.]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;

    const selfClosingTags = new Set([
      'AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT',
      'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
    ]);

    const stack = [root];
    let match;

    while ((match = tagRegex.exec(htmlString)) !== null) {
      const [fullMatch, isClosing, tagName, rawAttrs, isSelfClosing, textContent] = match;

      if (fullMatch.startsWith('<!--')) {
        // Skip comment
        continue;
      }

      if (textContent) {
        const current = stack[stack.length - 1];
        if (current) {
          current.childNodes.push(textContent);
        }
        continue;
      }

      if (isClosing) {
        const closingTag = tagName.toUpperCase();
        // Pop stack until matching tag
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tagName === closingTag) {
            stack.splice(i);
            break;
          }
        }
        continue;
      }

      // Opening tag
      const upperTag = tagName.toUpperCase();
      const attributes = parseAttributes(rawAttrs || '');
      const parent = stack[stack.length - 1];
      const newNode = new DOMNode(upperTag, attributes, parent);

      if (parent) {
        parent.children.push(newNode);
        parent.childNodes.push(newNode);
      }

      // Handle self-closing
      const isVoid = isSelfClosing === '/' || selfClosingTags.has(upperTag);

      // Handle script or style content until closing tag
      if (upperTag === 'SCRIPT' || upperTag === 'STYLE') {
        const closeTag = `</${tagName}>`;
        const closeIdx = htmlString.toLowerCase().indexOf(closeTag.toLowerCase(), tagRegex.lastIndex);
        if (closeIdx !== -1) {
          const body = htmlString.substring(tagRegex.lastIndex, closeIdx);
          newNode.childNodes.push(body);
          newNode.rawText = body;
          tagRegex.lastIndex = closeIdx + closeTag.length;
        }
      } else if (!isVoid) {
        stack.push(newNode);
      }
    }

    return root;
  }
}

function parseAttributes(raw) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_\-:@.]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const val = match[2] !== undefined ? match[2] :
                match[3] !== undefined ? match[3] :
                match[4] !== undefined ? match[4] : '';
    attrs[name] = val;
  }
  return attrs;
}

module.exports = { DOMParser, DOMNode, matchSimple };
