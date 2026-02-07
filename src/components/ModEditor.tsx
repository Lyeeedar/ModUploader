import React, { useState, useEffect } from 'react';
import { ModUploadData, WorkshopItem, WorkshopUploadResult } from '../types';
import { DebugMessage } from '../hooks/useDebugLog';
import { GameTitle } from './GameTitle';
import { DebugConsole } from './DebugConsole';
import { ImagePreview } from './ImagePreview';
import { ConfirmDialog } from './ConfirmDialog';

interface ModEditorProps {
  onBack: () => void;
  onUpload: (data: ModUploadData) => Promise<WorkshopUploadResult>;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
  onShowStatus: (message: {
    type: 'success' | 'error' | 'info';
    text: string;
  }) => void;
  debugMessages: DebugMessage[];
  onClearDebug: () => void;
  editingItem?: WorkshopItem;
}

interface FormErrors {
  title?: string;
  description?: string;
  zipPath?: string;
  changeNotes?: string;
}

export const ModEditor: React.FC<ModEditorProps> = ({
  onBack,
  onUpload,
  onLog,
  onShowStatus,
  debugMessages,
  onClearDebug,
  editingItem,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    visibility: 'public' as ModUploadData['visibility'],
    changeNotes: '',
  });
  const [selectedZipPath, setSelectedZipPath] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(
    null,
  );
  const [previewImageInfo, setPreviewImageInfo] = useState<{
    originalSize?: string;
    compressedSize?: string;
    wasCompressed?: boolean;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmUpload, setConfirmUpload] = useState(false);

  // Initialize form data based on whether we're editing or creating
  useEffect(() => {
    if (editingItem) {
      setFormData({
        title: editingItem.title,
        description: editingItem.description || '',
        tags: editingItem.tags?.join(', ') || '',
        visibility: editingItem.visibility as ModUploadData['visibility'],
        changeNotes: '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        tags: '',
        visibility: 'public',
        changeNotes: '',
      });
    }
    setSelectedZipPath(null);
    setSelectedPreviewPath(null);
    setPreviewImageInfo(null);
    setErrors({});
  }, [editingItem]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 128) {
      newErrors.title = 'Title must be 128 characters or less';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 8000) {
      newErrors.description = 'Description must be 8000 characters or less';
    }

    if (!editingItem && !selectedZipPath) {
      newErrors.zipPath = 'Please select a ZIP file';
    }

    if (editingItem && selectedZipPath && !formData.changeNotes.trim()) {
      newErrors.changeNotes =
        'Change notes are required when updating an existing mod';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSelectZip = async () => {
    try {
      onLog('info', 'Opening file selector for ZIP...');
      const path = await window.electronAPI.selectZip();
      if (path) {
        setSelectedZipPath(path);
        setErrors((prev) => ({ ...prev, zipPath: undefined }));
        const filename = path.split(/[\\/]/).pop();
        onLog('success', `Selected ZIP: ${filename}`);
        onShowStatus({ type: 'info', text: `Selected: ${filename}` });

        // Extract mod.js information to pre-populate form fields
        try {
          onLog('info', 'Extracting mod information from ZIP...');
          const packageInfo =
            await window.electronAPI.extractPackageInfo(path);

          if (packageInfo) {
            onLog('success', 'Successfully extracted mod information');

            setFormData((prev) => ({
              ...prev,
              title:
                prev.title ||
                packageInfo.title ||
                packageInfo.name ||
                prev.title,
              description:
                prev.description || packageInfo.description || prev.description,
              tags:
                prev.tags ||
                (packageInfo.tags ? packageInfo.tags.join(', ') : prev.tags),
            }));

            if (packageInfo.title || packageInfo.name) {
              onLog(
                'info',
                `Found mod title: ${packageInfo.title || packageInfo.name}`,
              );
            }
            if (packageInfo.description) {
              onLog(
                'info',
                `Found mod description: ${packageInfo.description.substring(0, 100)}${packageInfo.description.length > 100 ? '...' : ''}`,
              );
            }
            if (packageInfo.tags && packageInfo.tags.length > 0) {
              onLog('info', `Found tags: ${packageInfo.tags.join(', ')}`);
            }
            if (packageInfo.version) {
              onLog('info', `Found mod version: ${packageInfo.version}`);
            }
            if (packageInfo.author) {
              onLog('info', `Found mod author: ${packageInfo.author}`);
            }
          } else {
            onLog(
              'info',
              'No mod.js found in ZIP file or could not extract metadata',
            );
          }
        } catch (extractError) {
          const errorMsg =
            extractError instanceof Error
              ? extractError.message
              : 'Unknown error';
          onLog('error', `Failed to extract mod information: ${errorMsg}`);
        }
      } else {
        onLog('info', 'File selection cancelled');
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to select zip file: ${errorMsg}`);
      onShowStatus({ type: 'error', text: 'Failed to select zip file' });
    }
  };

  const handleSelectPreview = async () => {
    try {
      onLog('info', 'Opening file selector for preview image...');
      const path = await window.electronAPI.selectPreviewImage();
      if (path) {
        const filename = path.split(/[\\/]/).pop();
        onLog('info', `Selected image: ${filename}, checking size...`);

        // Compress the image if needed
        const compressionResult =
          await window.electronAPI.compressPreviewImage(path);

        if (!compressionResult.success) {
          onLog('error', `Failed to process image: ${compressionResult.error}`);
          onShowStatus({
            type: 'error',
            text: compressionResult.error || 'Failed to process image',
          });
          return;
        }

        // Use the compressed path (or original if no compression needed)
        setSelectedPreviewPath(compressionResult.compressedPath || path);

        // Format sizes for display
        const formatSize = (bytes: number) => {
          if (bytes >= 1024 * 1024) {
            return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
          }
          return `${(bytes / 1024).toFixed(1)} KB`;
        };

        setPreviewImageInfo({
          originalSize: formatSize(compressionResult.originalSize),
          compressedSize: compressionResult.compressedSize
            ? formatSize(compressionResult.compressedSize)
            : undefined,
          wasCompressed: compressionResult.wasCompressed,
        });

        if (compressionResult.wasCompressed) {
          const savings = (
            (1 -
              (compressionResult.compressedSize || 0) /
                compressionResult.originalSize) *
            100
          ).toFixed(1);
          onLog(
            'success',
            `Image compressed: ${formatSize(compressionResult.originalSize)} → ${formatSize(compressionResult.compressedSize || 0)} (${savings}% reduction, quality: ${compressionResult.quality}%)`,
          );
          onShowStatus({
            type: 'success',
            text: `Image compressed to ${formatSize(compressionResult.compressedSize || 0)}`,
          });
        } else {
          onLog(
            'success',
            `Image OK: ${formatSize(compressionResult.originalSize)} (under 1MB limit)`,
          );
          onShowStatus({ type: 'info', text: `Selected: ${filename}` });
        }
      } else {
        onLog('info', 'Image selection cancelled');
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to select preview image: ${errorMsg}`);
      onShowStatus({ type: 'error', text: 'Failed to select preview image' });
    }
  };

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      onShowStatus({ type: 'error', text: 'Please fix the form errors' });
      return;
    }

    // Show confirmation dialog
    setConfirmUpload(true);
  };

  const handleConfirmUpload = async () => {
    setConfirmUpload(false);
    setIsUploading(true);
    setUploadProgress('Preparing upload...');

    // Generate automatic change notes for trivial updates (no ZIP)
    let changeNotes = formData.changeNotes;
    if (editingItem && !selectedZipPath) {
      const changes = [];
      if (formData.title !== editingItem.title) {
        changes.push(
          `Updated title from "${editingItem.title}" to "${formData.title}"`,
        );
      }
      if (formData.description !== (editingItem.description || '')) {
        changes.push('Updated description');
      }
      if (formData.tags !== (editingItem.tags?.join(', ') || '')) {
        changes.push('Updated tags');
      }
      if (formData.visibility !== editingItem.visibility) {
        changes.push(
          `Changed visibility from ${editingItem.visibility} to ${formData.visibility}`,
        );
      }
      if (changes.length > 0) {
        changeNotes = `Minor update: ${changes.join(', ')}.`;
      } else {
        changeNotes = 'Minor update: No significant changes.';
      }
    }

    const uploadData: ModUploadData = {
      title: formData.title,
      description: formData.description,
      tags: formData.tags,
      visibility: formData.visibility,
      previewImagePath: selectedPreviewPath || undefined,
      workshopId: editingItem?.publishedFileId,
      changeNotes: changeNotes || (editingItem ? 'Updated mod.' : undefined),
      change_note: changeNotes || (editingItem ? 'Updated mod.' : undefined),
    };

    if (selectedZipPath) {
      uploadData.zipPath = selectedZipPath;
    }

    try {
      setUploadProgress(
        editingItem ? 'Updating workshop item...' : 'Uploading to Steam Workshop...',
      );
      const result = await onUpload(uploadData);
      
      if (result.success) {
        setUploadProgress('Upload complete!');
        // Small delay to show success before navigating back
        setTimeout(() => {
          onBack();
        }, 500);
      }
    } catch {
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setConfirmUpload(false);
  };

  const handleInputChange =
    (field: keyof typeof formData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
      // Clear error when user starts typing
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleOpenInSteam = async () => {
    if (editingItem) {
      onLog('info', `Opening workshop item in Steam: ${editingItem.title}`);
      try {
        await window.electronAPI.openSteamWorkshop(editingItem.publishedFileId);
        onShowStatus({ type: 'success', text: 'Opened Steam Workshop page' });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        onLog('error', `Failed to open Steam Workshop: ${errorMsg}`);
        onShowStatus({
          type: 'error',
          text: 'Failed to open Steam Workshop page',
        });
      }
    }
  };

  return (
    <div className="container">
      <GameTitle subtitle="Steam Workshop Manager" />

      <main>
        <div className="section">
          <div className="editor-header">
            <button
              className="game-button"
              onClick={onBack}
              disabled={isUploading}
            >
              ← Back to Workshop Items
            </button>
            <div className="header-actions">
              {editingItem && (
                <button className="game-button" onClick={handleOpenInSteam}>
                  🔗 Open in Steam
                </button>
              )}
              <button
                type="submit"
                form="mod-form"
                className="game-button primary"
                disabled={isUploading}
              >
                <span className="button-text">
                  {isUploading
                    ? uploadProgress || 'Processing...'
                    : editingItem
                      ? 'Update Workshop Item'
                      : 'Upload to Workshop'}
                </span>
              </button>
            </div>
          </div>

          <div className="form-container">
            <form id="mod-form" onSubmit={handleSubmitClick}>
              <div className="form-group">
                <label>
                  {editingItem ? 'New Mod Package (.zip)' : 'Mod Package (.zip)*'}
                </label>
                <div className="file-input-wrapper">
                  <button
                    type="button"
                    className="game-button"
                    onClick={handleSelectZip}
                    disabled={isUploading}
                  >
                    Select ZIP File
                  </button>
                  <span className="file-path">
                    {selectedZipPath
                      ? selectedZipPath.split(/[\\/]/).pop()
                      : editingItem
                        ? 'No new file selected (will keep existing)'
                        : 'No file selected'}
                  </span>
                </div>
                {errors.zipPath && (
                  <div className="form-error">{errors.zipPath}</div>
                )}
              </div>

              <div className="form-group">
                <label>Title*</label>
                <input
                  type="text"
                  className={`game-input ${errors.title ? 'error' : ''}`}
                  value={formData.title}
                  onChange={handleInputChange('title')}
                  placeholder="Enter mod title"
                  disabled={isUploading}
                />
                {errors.title && (
                  <div className="form-error">{errors.title}</div>
                )}
                <div className="form-hint">
                  {formData.title.length}/128 characters
                </div>
              </div>

              <div className="form-group">
                <label>Description*</label>
                <textarea
                  className={`game-input ${errors.description ? 'error' : ''}`}
                  rows={6}
                  value={formData.description}
                  onChange={handleInputChange('description')}
                  placeholder="Describe your mod..."
                  disabled={isUploading}
                />
                {errors.description && (
                  <div className="form-error">{errors.description}</div>
                )}
                <div className="form-hint">
                  {formData.description.length}/8000 characters
                </div>
              </div>

              <div className="form-group">
                <label>
                  {editingItem ? 'New Preview Image' : 'Preview Image'}
                </label>
                <div className="file-input-wrapper">
                  <button
                    type="button"
                    className="game-button"
                    onClick={handleSelectPreview}
                    disabled={isUploading}
                  >
                    Select Image
                  </button>
                  <span className="file-path">
                    {selectedPreviewPath
                      ? selectedPreviewPath.split(/[\\/]/).pop()
                      : editingItem
                        ? 'No new image selected (will keep existing)'
                        : 'No file selected'}
                  </span>
                </div>
                {previewImageInfo && (
                  <div
                    className={`form-hint ${previewImageInfo.wasCompressed ? 'compressed' : ''}`}
                  >
                    {previewImageInfo.wasCompressed ? (
                      <>
                        Compressed: {previewImageInfo.originalSize} →{' '}
                        {previewImageInfo.compressedSize} (Steam limit: 1MB)
                      </>
                    ) : (
                      <>Size: {previewImageInfo.originalSize} (under 1MB limit)</>
                    )}
                  </div>
                )}
                <ImagePreview
                  filePath={selectedPreviewPath}
                  alt="Preview image"
                  className="preview-thumbnail"
                />
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  className="game-input"
                  value={formData.tags}
                  onChange={handleInputChange('tags')}
                  placeholder="e.g., cultivation, items, balance"
                  disabled={isUploading}
                />
              </div>

              <div className="form-group">
                <label>Visibility</label>
                <select
                  className="game-input"
                  value={formData.visibility}
                  onChange={handleInputChange('visibility')}
                  disabled={isUploading}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends Only</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>

              {editingItem && selectedZipPath && (
                <div className="form-group">
                  <label>Change Notes*</label>
                  <textarea
                    className={`game-input ${errors.changeNotes ? 'error' : ''}`}
                    rows={4}
                    value={formData.changeNotes}
                    onChange={handleInputChange('changeNotes')}
                    placeholder="Describe what's new in this version..."
                    disabled={isUploading}
                  />
                  {errors.changeNotes && (
                    <div className="form-error">{errors.changeNotes}</div>
                  )}
                  <div className="form-help">
                    Required when updating an existing mod. Describe what's
                    changed or improved.
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        <DebugConsole messages={debugMessages} onClear={onClearDebug} />
      </main>

      <ConfirmDialog
        isOpen={confirmUpload}
        title={editingItem ? 'Update Workshop Item?' : 'Upload to Steam Workshop?'}
        message={
          editingItem
            ? `Are you sure you want to update "${formData.title}"? This will publish the changes to Steam Workshop.`
            : `Are you sure you want to upload "${formData.title}" to Steam Workshop?`
        }
        confirmText={editingItem ? 'Update' : 'Upload'}
        cancelText="Cancel"
        confirmType="primary"
        onConfirm={handleConfirmUpload}
        onCancel={handleCancelUpload}
      />
    </div>
  );
};
