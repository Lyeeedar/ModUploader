import * as fs from 'fs';
import * as path from 'path';
import type { ModUploadData, ModVisibility } from '../../src/types';
import { getWorkshopUrl } from './steam';
import { normalizeWorkshopError, uploadWorkshopItem } from './workshop-service';

interface UploadCliArgs {
  zipPath?: string;
  workshopId?: string;
  title?: string;
  description?: string;
  tags?: string;
  visibility?: ModVisibility;
  previewImagePath?: string;
  changeNotes?: string;
  allowCreate: boolean;
  json: boolean;
  openWorkshopPage: boolean;
  help: boolean;
}

const VALID_VISIBILITY = new Set<ModVisibility>([
  'public',
  'friends',
  'private',
  'unlisted',
]);

export function isCliUploadMode(argv: string[] = process.argv): boolean {
  return argv.includes('--cli-upload');
}

function redirectLogsToStderr(): () => void {
  const originalLog = console.log;
  const originalWarn = console.warn;

  console.log = (...args: unknown[]) => {
    console.error(...args);
  };
  console.warn = (...args: unknown[]) => {
    console.error(...args);
  };

  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
  };
}

function printUsage(): void {
  console.log(`Steam Workshop CLI Upload

Usage:
  electron . --cli-upload --workshop-id <id> --zip <path> --change-note "..."

Options:
  --workshop-id <id>     Existing workshop item ID to update
  --zip <path>           Mod zip file to upload
  --change-note <text>   Change notes for the workshop update
  --title <text>         Optional title override
  --description <text>   Optional description override
  --tags <csv>           Optional comma-separated tag override
  --visibility <value>   public | friends | private | unlisted
  --preview <path>       Optional preview image override
  --allow-create         Create a new workshop item if no workshop ID is provided
  --open-workshop-page   Open the updated workshop page in Steam overlay
  --json                 Print machine-readable JSON result
  --help                 Show this help
`);
}

function consumeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseUploadArgs(argv: string[]): UploadCliArgs {
  const cliIndex = argv.indexOf('--cli-upload');
  const args = cliIndex >= 0 ? argv.slice(cliIndex + 1) : argv.slice(2);

  const parsed: UploadCliArgs = {
    allowCreate: false,
    json: false,
    openWorkshopPage: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--help':
        parsed.help = true;
        break;
      case '--allow-create':
        parsed.allowCreate = true;
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--open-workshop-page':
        parsed.openWorkshopPage = true;
        break;
      case '--zip':
        parsed.zipPath = consumeValue(args, index, arg);
        index += 1;
        break;
      case '--workshop-id':
        parsed.workshopId = consumeValue(args, index, arg);
        index += 1;
        break;
      case '--change-note':
        parsed.changeNotes = consumeValue(args, index, arg);
        index += 1;
        break;
      case '--title':
        parsed.title = consumeValue(args, index, arg);
        index += 1;
        break;
      case '--description':
        parsed.description = consumeValue(args, index, arg);
        index += 1;
        break;
      case '--tags':
        parsed.tags = consumeValue(args, index, arg);
        index += 1;
        break;
      case '--visibility': {
        const visibility = consumeValue(args, index, arg) as ModVisibility;
        if (!VALID_VISIBILITY.has(visibility)) {
          throw new Error(
            `Invalid visibility "${visibility}". Expected one of: public, friends, private, unlisted.`,
          );
        }
        parsed.visibility = visibility;
        index += 1;
        break;
      }
      case '--preview':
        parsed.previewImagePath = consumeValue(args, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function toAbsolutePath(filePath: string): string {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(process.cwd(), filePath);
}

function buildUploadData(args: UploadCliArgs): ModUploadData {
  return {
    zipPath: args.zipPath ? toAbsolutePath(args.zipPath) : undefined,
    workshopId: args.workshopId,
    title: args.title || '',
    description: args.description || '',
    tags: args.tags,
    visibility: args.visibility,
    previewImagePath: args.previewImagePath
      ? toAbsolutePath(args.previewImagePath)
      : undefined,
    changeNotes: args.changeNotes,
  };
}

function validateUploadArgs(args: UploadCliArgs): void {
  if (!args.zipPath) {
    throw new Error('Missing required --zip argument');
  }

  const absoluteZipPath = toAbsolutePath(args.zipPath);
  if (!fs.existsSync(absoluteZipPath)) {
    throw new Error(`ZIP file not found: ${absoluteZipPath}`);
  }

  if (!args.workshopId && !args.allowCreate) {
    throw new Error(
      'Missing --workshop-id. Use --allow-create only when you intentionally want to create a new workshop item.',
    );
  }

  if (args.previewImagePath) {
    const absolutePreviewPath = toAbsolutePath(args.previewImagePath);
    if (!fs.existsSync(absolutePreviewPath)) {
      throw new Error(`Preview image not found: ${absolutePreviewPath}`);
    }
  }
}

export async function runCliUpload(argv: string[] = process.argv): Promise<number> {
  try {
    const args = parseUploadArgs(argv);
    if (args.help) {
      printUsage();
      return 0;
    }

    validateUploadArgs(args);
    const uploadData = buildUploadData(args);
    const restoreLogs = args.json ? redirectLogsToStderr() : null;
    let result;

    try {
      result = await uploadWorkshopItem(uploadData, {
        mainWindow: null,
        openWorkshopPage: args.openWorkshopPage,
      });
    } finally {
      restoreLogs?.();
    }

    const payload = {
      success: true,
      publishedFileId: result.publishedFileId,
      workshopUrl: result.publishedFileId
        ? getWorkshopUrl(result.publishedFileId)
        : undefined,
    };

    if (args.json) {
      console.log(JSON.stringify(payload));
    } else {
      console.log(`Workshop upload succeeded: ${result.publishedFileId}`);
      if (payload.workshopUrl) {
        console.log(`Workshop URL: ${payload.workshopUrl}`);
      }
    }

    return 0;
  } catch (error) {
    const normalizedError = normalizeWorkshopError(error);
    if (argv.includes('--json')) {
      console.log(
        JSON.stringify({
          success: false,
          error: normalizedError.message,
        }),
      );
    } else {
      console.error(`Workshop upload failed: ${normalizedError.message}`);
      printUsage();
    }
    return 1;
  }
}
