/**
 * Lightweight Zero-Dependency CSS Rule & Media Query Parser for E2E Testing
 */

class CSSParser {
  parse(cssString) {
    // Strip comments
    const cleanCSS = cssString.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    const mediaRules = [];

    // Parse @media blocks and standard blocks
    let i = 0;
    while (i < cleanCSS.length) {
      // Skip whitespace
      while (i < cleanCSS.length && /\s/.test(cleanCSS[i])) i++;
      if (i >= cleanCSS.length) break;

      if (cleanCSS.startsWith('@media', i)) {
        // Find media query header
        const openBrace = cleanCSS.indexOf('{', i);
        if (openBrace === -1) break;
        const mediaQuery = cleanCSS.substring(i + 6, openBrace).trim();

        // Find matching closing brace for media block
        let depth = 1;
        let j = openBrace + 1;
        while (j < cleanCSS.length && depth > 0) {
          if (cleanCSS[j] === '{') depth++;
          else if (cleanCSS[j] === '}') depth--;
          j++;
        }
        const innerCSS = cleanCSS.substring(openBrace + 1, j - 1);
        const innerRules = this.parseStandardRules(innerCSS);
        mediaRules.push({
          media: mediaQuery,
          rules: innerRules
        });
        i = j;
      } else {
        // Standard rule or at-rule
        const openBrace = cleanCSS.indexOf('{', i);
        if (openBrace === -1) break;
        const selector = cleanCSS.substring(i, openBrace).trim();

        const closeBrace = cleanCSS.indexOf('}', openBrace);
        if (closeBrace === -1) break;

        const body = cleanCSS.substring(openBrace + 1, closeBrace).trim();
        const declarations = parseDeclarations(body);

        rules.push({
          selector,
          declarations,
          raw: cleanCSS.substring(i, closeBrace + 1)
        });
        i = closeBrace + 1;
      }
    }

    return {
      rules,
      mediaRules,
      getDeclarationsForSelector(sel) {
        const matches = [];
        for (const r of rules) {
          const sels = r.selector.split(',').map(s => s.trim());
          if (sels.includes(sel) || r.selector.trim() === sel) {
            matches.push(r.declarations);
          }
        }
        return matches;
      },
      hasProperty(selector, prop, valMatcher = null) {
        for (const r of rules) {
          const sels = r.selector.split(',').map(s => s.trim());
          if (sels.includes(selector) || r.selector.includes(selector)) {
            if (r.declarations[prop]) {
              if (!valMatcher) return true;
              if (typeof valMatcher === 'string' && r.declarations[prop].includes(valMatcher)) return true;
              if (valMatcher instanceof RegExp && valMatcher.test(r.declarations[prop])) return true;
            }
          }
        }
        return false;
      },
      getMediaRules(mediaSubstring) {
        return mediaRules.filter(m => m.media.includes(mediaSubstring));
      },
      getRootVariables() {
        const vars = {};
        for (const r of rules) {
          if (r.selector.includes(':root')) {
            for (const [key, val] of Object.entries(r.declarations)) {
              if (key.startsWith('--')) {
                vars[key] = val;
              }
            }
          }
        }
        return vars;
      }
    };
  }

  parseStandardRules(cssText) {
    const rules = [];
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let match;
    while ((match = ruleRegex.exec(cssText)) !== null) {
      const selector = match[1].trim();
      const body = match[2].trim();
      rules.push({
        selector,
        declarations: parseDeclarations(body)
      });
    }
    return rules;
  }
}

function parseDeclarations(body) {
  const decls = {};
  const statements = body.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const colonIdx = stmt.indexOf(':');
    if (colonIdx !== -1) {
      const prop = stmt.substring(0, colonIdx).trim().toLowerCase();
      const val = stmt.substring(colonIdx + 1).trim();
      decls[prop] = val;
    }
  }
  return decls;
}

module.exports = { CSSParser };
