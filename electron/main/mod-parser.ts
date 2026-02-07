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
 * Parse mod.js content to extract metadata
 */
function parseModJsContent(data: string): ModPackageInfo | null {
  console.log('Parsing mod.js content...');

  try {
    // Primary method: Look for getMetadata function and extract its return value
    const metadataMatch = data.match(
      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})/,
    );

    if (metadataMatch) {
      const result = parseMetadataObject(data, metadataMatch);
      if (result) return result;
    }

    // Fallback: Try enhanced regex extraction
    return extractWithFallbackMethods(data);
  } catch (parseError) {
    console.error('Error parsing mod.js metadata:', parseError);
    return extractWithFallbackMethods(data);
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
    // Method 1: Handle webpack inline JSON pattern
    // Pattern: name: {"name":"value",...}.name
    const webpackJsonMatch = data.match(
      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*\(\s*\{[^]*?name\s*:\s*(\{[^}]+\})\.name/,
    );

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

    // Method 2: Look for the exact pattern with individual property extraction
    const fullMatch = data.match(
      /getMetadata\s*:\s*function\s*\(\s*\)\s*\{\s*return\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)}/,
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
