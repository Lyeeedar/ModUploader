// Module for parsing mod metadata from ZIP files

import * as yauzl from 'yauzl';
import { ModPackageInfo } from '../../src/types';

/**
 * Format mod names for better visual appeal
 */
export function formatModName(name: string): string {
  if (!name) return name;

  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

/**
 * Extract mod metadata from a ZIP file containing mod.js and/or package.json
 */
export async function extractModMetadata(
  zipPath: string,
): Promise<ModPackageInfo | null> {
  return new Promise((resolve) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        console.error('Error opening ZIP file:', err);
        resolve(null);
        return;
      }

      let modJsContent: string | null = null;
      let packageJsonContent: string | null = null;
      let pendingReads = 0;

      const tryResolve = () => {
        if (pendingReads > 0) return;

        // Try mod.js first
        if (modJsContent) {
          const result = parseModJsContent(modJsContent);
          if (result) {
            console.log('Successfully parsed metadata from mod.js');
            zipfile.close();
            resolve(result);
            return;
          }
        }

        // Fall back to package.json
        if (packageJsonContent) {
          const result = parsePackageJson(packageJsonContent);
          if (result) {
            console.log('Successfully parsed metadata from package.json');
            zipfile.close();
            resolve(result);
            return;
          }
        }

        console.log('No valid metadata found in ZIP file');
        zipfile.close();
        resolve(null);
      };

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const isModJs = entry.fileName.endsWith('mod.js');
        const isPackageJson = entry.fileName.endsWith('package.json');

        if ((isModJs || isPackageJson) && !/\/$/.test(entry.fileName)) {
          pendingReads++;

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) {
              console.error('Error opening read stream:', err);
              pendingReads--;
              zipfile.readEntry();
              return;
            }

            let data = '';
            readStream.on('data', (chunk) => {
              data += chunk;
            });

            readStream.on('end', () => {
              if (isModJs) {
                modJsContent = data;
              } else if (isPackageJson) {
                packageJsonContent = data;
              }
              pendingReads--;
              zipfile.readEntry();
            });

            readStream.on('error', (streamError) => {
              console.error('Error reading stream:', streamError);
              pendingReads--;
              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        // Wait for any pending reads to complete
        const checkAndResolve = () => {
          if (pendingReads === 0) {
            tryResolve();
          } else {
            setTimeout(checkAndResolve, 10);
          }
        };
        checkAndResolve();
      });

      zipfile.on('error', (zipError) => {
        console.error('ZIP file error:', zipError);
        zipfile.close();
        resolve(null);
      });
    });
  });
}

/**
 * Parse package.json content to extract metadata
 */
function parsePackageJson(data: string): ModPackageInfo | null {
  try {
    const pkg = JSON.parse(data);

    if (!pkg.name) {
      console.log('package.json missing required name field');
      return null;
    }

    return {
      name: pkg.name,
      title: formatModName(pkg.title || pkg.name),
      description: pkg.description,
      version: pkg.version,
      author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name,
      tags: pkg.keywords,
    };
  } catch (error) {
    console.error('Failed to parse package.json:', error);
    return null;
  }
}

/**
 * Detect tags from ModAPI function calls present in mod.js content
 */
function detectTagsFromModJs(data: string): string[] {
  const tagMap: Array<{ pattern: RegExp; tag: string }> = [
    // Items
    { pattern: /\baddItem\s*\(/, tag: 'Items' },
    { pattern: /\baddItemToShop\s*\(/, tag: 'Items' },
    { pattern: /\baddItemToGuild\s*\(/, tag: 'Items' },
    { pattern: /\baddItemToAuction\s*\(/, tag: 'Items' },
    { pattern: /\baddItemToFallenStar\s*\(/, tag: 'Items' },
    { pattern: /\baddEnchantment\s*\(/, tag: 'Items' },
    { pattern: /\baddUncutStone\s*\(/, tag: 'Items' },
    { pattern: /\baddManual\s*\(/, tag: 'Items' },
    // Crafting
    { pattern: /\baddRecipeToLibrary\s*\(/, tag: 'Crafting' },
    { pattern: /\baddRecipeToResearch\s*\(/, tag: 'Crafting' },
    { pattern: /\baddResearchableRecipe\s*\(/, tag: 'Crafting' },
    { pattern: /\baddCraftingTechnique\s*\(/, tag: 'Crafting' },
    { pattern: /\baddHarmonyType\s*\(/, tag: 'Crafting' },
    { pattern: /\baddCraftingMissionsToLocation\s*\(/, tag: 'Crafting' },
    // Characters
    { pattern: /\baddCharacter\s*\(/, tag: 'Characters' },
    // Locations
    { pattern: /\baddLocation\s*\(/, tag: 'Locations' },
    { pattern: /\blinkLocations\s*\(/, tag: 'Locations' },
    { pattern: /\bregisterRootLocation\s*\(/, tag: 'Locations' },
    { pattern: /\baddBuildingsToLocation\s*\(/, tag: 'Locations' },
    // Combat
    { pattern: /\baddEnemiesToLocation\s*\(/, tag: 'Combat' },
    { pattern: /\baddFallenStar\s*\(/, tag: 'Combat' },
    { pattern: /\baddPuppetType\s*\(/, tag: 'Combat' },
    // Techniques
    { pattern: /\baddTechnique\s*\(/, tag: 'Techniques' },
    // Cultivation
    { pattern: /\baddBreakthrough\s*\(/, tag: 'Cultivation' },
    { pattern: /\baddDestiny\s*\(/, tag: 'Cultivation' },
    // Events
    { pattern: /\baddTriggeredEvent\s*\(/, tag: 'Events' },
    { pattern: /\baddCalendarEvent\s*\(/, tag: 'Events' },
    { pattern: /\baddEventsToLocation\s*\(/, tag: 'Events' },
    { pattern: /\baddExplorationEventsToLocation\s*\(/, tag: 'Events' },
    { pattern: /\baddMapEventsToLocation\s*\(/, tag: 'Events' },
    // Quests
    { pattern: /\baddQuest\s*\(/, tag: 'Quests' },
    { pattern: /\baddMissionsToLocation\s*\(/, tag: 'Quests' },
    // Audio
    { pattern: /\baddMusic\s*\(/, tag: 'Audio' },
    { pattern: /\baddSfx\s*\(/, tag: 'Audio' },
    // Housing
    { pattern: /\baddRoom\s*\(/, tag: 'Housing' },
    // Guilds
    { pattern: /\baddGuild\s*\(/, tag: 'Guilds' },
    // Relationships
    { pattern: /\baddDualCultivationTechnique\s*\(/, tag: 'Relationships' },
    // Cosmetics
    { pattern: /\baddPlayerSprite\s*\(/, tag: 'Cosmetics' },
    // UI
    { pattern: /\baddScreen\s*\(/, tag: 'UI' },
    { pattern: /\baddCustomFont\s*\(/, tag: 'UI' },
    { pattern: /\bsetCustomFontFamily\s*\(/, tag: 'UI' },
    { pattern: /\baddThemeOverride\s*\(/, tag: 'UI' },
    // Character Creation
    { pattern: /\baddBirthBackground\s*\(/, tag: 'Character Creation' },
    { pattern: /\baddChildBackground\s*\(/, tag: 'Character Creation' },
    { pattern: /\baddTeenBackground\s*\(/, tag: 'Character Creation' },
    { pattern: /\baddAlternativeStart\s*\(/, tag: 'Alternative Start' },
    // Translation
    { pattern: /\baddTranslation\s*\(/, tag: 'Translation' },
    // Exploration
    { pattern: /\baddMineChamber\s*\(/, tag: 'Exploration' },
    { pattern: /\baddMysticalRegionBlessing\s*\(/, tag: 'Exploration' },
    // Farming
    { pattern: /\baddCrop\s*\(/, tag: 'Farming' },
  ];

  const detectedTags = new Set<string>();
  for (const { pattern, tag } of tagMap) {
    if (pattern.test(data)) {
      detectedTags.add(tag);
    }
  }

  const tags = Array.from(detectedTags);
  if (tags.length > 0) {
    console.log('Auto-detected tags from API usage:', tags);
  }
  return tags;
}

/**
 * Parse mod.js content to extract metadata
 */
function parseModJsContent(data: string): ModPackageInfo | null {
  console.log('Parsing mod.js content...');

  const detectedTags = detectTagsFromModJs(data);

  const mergeDetectedTags = (result: ModPackageInfo | null): ModPackageInfo | null => {
    if (detectedTags.length === 0) return result;
    // If metadata parsing failed but we have tags, return a minimal result with tags
    const base = result ?? {};
    const existing = base.tags ?? [];
    const merged = Array.from(new Set([...existing, ...detectedTags]));
    return { ...base, tags: merged };
  };

  try {
    // Try all getMetadata syntax variants
    const metadataPatterns = [
      // Traditional: getMetadata: function() { return {...} }
      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/,
      // Method shorthand: getMetadata() { return {...} }
      /getMetadata\s*\(\s*\)\s*\{\s*return\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/,
      // Arrow with body: getMetadata: () => { return {...} }
      /getMetadata\s*:\s*\(\s*\)\s*=>\s*\{\s*return\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/,
      // Arrow with parenthesized object: getMetadata: () => ({...})
      /getMetadata\s*:\s*\(\s*\)\s*=>\s*\(\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})\s*\)/,
      // Arrow without parens returning object directly: getMetadata:()=>({...})
      /getMetadata\s*:\s*\(\s*\)\s*=>\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/,
    ];

    for (const pattern of metadataPatterns) {
      const metadataMatch = data.match(pattern);
      if (metadataMatch) {
        const result = parseMetadataObject(data, metadataMatch);
        if (result) return mergeDetectedTags(result);
      }
    }

    // Fallback: Try enhanced regex extraction
    return mergeDetectedTags(extractWithFallbackMethods(data));
  } catch (parseError) {
    console.error('Error parsing mod.js metadata:', parseError);
    return mergeDetectedTags(extractWithFallbackMethods(data));
  }
}

/**
 * Parse the metadata object from matched regex
 */
function parseMetadataObject(
  data: string,
  metadataMatch: RegExpMatchArray,
): ModPackageInfo | null {
  try {
    // Find the complete metadata object by counting braces
    let braceCount = 0;
    let completeMetadata = '';
    const startIndex = data.indexOf(metadataMatch[1]);

    for (let i = startIndex; i < data.length; i++) {
      const char = data[i];
      completeMetadata += char;

      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          break;
        }
      }
    }

    console.log('Complete metadata string:', completeMetadata);

    // Clean up the metadata string for JSON parsing
    const cleanedMetadata = completeMetadata
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"');

    const metadata = JSON.parse(cleanedMetadata);
    console.log('Parsed metadata:', metadata);

    return {
      name: metadata.name,
      title: formatModName(metadata.title || metadata.name),
      description: metadata.description,
      version: metadata.version,
      author:
        typeof metadata.author === 'string'
          ? metadata.author
          : metadata.author?.name,
      tags: metadata.tags || metadata.keywords,
    };
  } catch (error) {
    console.error('Failed to parse metadata object:', error);
    return null;
  }
}

/**
 * Fallback extraction methods when primary parsing fails
 */
function extractWithFallbackMethods(data: string): ModPackageInfo | null {
  try {
    // Method 0: Webpack compiled inline JSON — find the JSON object literal
    // after getMetadata and parse it directly (handles nested objects with brace counting)
    const getMetadataPos = data.indexOf('getMetadata');
    if (getMetadataPos !== -1) {
      const searchArea = data.slice(getMetadataPos, getMetadataPos + 3000);
      const jsonObjectStart = searchArea.search(/\{"name"\s*:/);
      if (jsonObjectStart !== -1) {
        const absoluteStart = getMetadataPos + jsonObjectStart;
        let braceCount = 0;
        let jsonStr = '';
        for (
          let i = absoluteStart;
          i < Math.min(absoluteStart + 5000, data.length);
          i++
        ) {
          const char = data[i];
          jsonStr += char;
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) break;
          }
        }
        console.log('DEBUG Method 0: extracted JSON string:', jsonStr.slice(0, 200));
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.name) {
            console.log('Successfully parsed metadata via inline JSON extraction');
            return {
              name: parsed.name,
              title: formatModName(parsed.title || parsed.name),
              description: parsed.description,
              version: parsed.version,
              author:
                typeof parsed.author === 'string'
                  ? parsed.author
                  : parsed.author?.name,
              tags: parsed.tags || parsed.keywords,
            };
          }
        } catch (jsonError) {
          console.error('Failed to parse inline JSON object:', jsonError);
        }
      } else {
        console.log('DEBUG Method 0: no {"name": pattern found near getMetadata');
      }
    }

    // Method 1: Handle webpack inline JSON pattern
    // Pattern: name: {"name":"value",...}.name
    const webpackJsonPatterns = [
      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*\(\s*\{[^]*?name\s*:\s*(\{[^}]+\})\.name/,
      /getMetadata\s*\(\s*\)\s*\{\s*return\s*\(\s*\{[^]*?name\s*:\s*(\{[^}]+\})\.name/,
      /getMetadata\s*:\s*\(\s*\)\s*=>\s*\(?\s*\{[^]*?name\s*:\s*(\{[^}]+\})\.name/,
    ];

    for (const pattern of webpackJsonPatterns) {
      const webpackJsonMatch = data.match(pattern);
      if (webpackJsonMatch) {
        console.log('Found webpack inline JSON pattern, extracting...');
        try {
          const inlineJson = JSON.parse(webpackJsonMatch[1]);
          return {
            name: inlineJson.name,
            title: formatModName(inlineJson.title || inlineJson.name),
            description: inlineJson.description,
            version: inlineJson.version,
            author:
              typeof inlineJson.author === 'string'
                ? inlineJson.author
                : inlineJson.author?.name,
            tags: inlineJson.tags || inlineJson.keywords,
          };
        } catch (jsonError) {
          console.error('Failed to parse webpack inline JSON:', jsonError);
        }
      }
    }

    // Method 2: Look for the exact pattern with individual property extraction
    const fullMatchPatterns = [
      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)}/,
      /getMetadata\s*\(\s*\)\s*\{\s*return\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)}/,
      /getMetadata\s*:\s*\(\s*\)\s*=>\s*\(?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}?\s*\)?/,
    ];
    const fullMatch = fullMatchPatterns.reduce<RegExpMatchArray | null>(
      (found, pattern) => found ?? data.match(pattern),
      null,
    );

    if (fullMatch) {
      console.log('Found full metadata match, extracting properties...');

      const nameMatch = fullMatch[0].match(/name\s*:\s*["']([^"']+)["']/);
      const versionMatch = fullMatch[0].match(/version\s*:\s*["']([^"']+)["']/);
      const descriptionMatch = fullMatch[0].match(
        /description\s*:\s*["']([^"']+)["']/,
      );
      const authorNameMatch = fullMatch[0].match(
        /author\s*:\s*\{[^}]*name\s*:\s*["']([^"']+)["']/,
      );

      const fallbackInfo: ModPackageInfo = {
        name: nameMatch?.[1],
        title: nameMatch?.[1] ? formatModName(nameMatch[1]) : undefined,
        description: descriptionMatch?.[1],
        version: versionMatch?.[1],
        author: authorNameMatch?.[1],
      };

      console.log('Using enhanced fallback parsing:', fallbackInfo);
      return fallbackInfo;
    }

    // Method 3: Basic regex extraction as last resort
    const nameMatch = data.match(
      /name\s*:\s*["']([^"']+)["'][^}]*version\s*:\s*["']([^"']+)["']/,
    );
    if (nameMatch) {
      const basicInfo: ModPackageInfo = {
        name: nameMatch[1],
        title: formatModName(nameMatch[1]),
        version: nameMatch[2],
      };
      console.log('Using basic fallback parsing:', basicInfo);
      return basicInfo;
    }

    console.log('All parsing methods failed');
    return null;
  } catch (fallbackError) {
    console.error('Fallback parsing failed:', fallbackError);
    return null;
  }
}
