import React, { useState, useEffect } from 'react';
import { ModUploadData, WorkshopItem } from '../types';
import { DebugMessage } from '../hooks/useDebugLog';
import { GameTitle } from './GameTitle';
import { DebugConsole } from './DebugConsole';

interface ModEditorProps {
  onBack: () => void;
  onUpload: (data: ModUploadData) => Promise<void>;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
  onShowStatus: (message: { type: 'success' | 'error' | 'info'; text: string }) => void;
  debugMessages: DebugMessage[];
  onClearDebug: () => void;
  editingItem?: WorkshopItem;
}

export const ModEditor: React.FC<ModEditorProps> = ({ 
  onBack, 
  onUpload, 
  onLog, 
  onShowStatus,
  debugMessages,
  onClearDebug,
  editingItem
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    visibility: 'public' as ModUploadData['visibility'],
    changeNotes: ''
  });
  const [selectedZipPath, setSelectedZipPath] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize form data based on whether we're editing or creating
  useEffect(() => {
    if (editingItem) {
      // Pre-populate form with existing workshop item data
      setFormData({
        title: editingItem.title,
        description: editingItem.description || '',
        tags: editingItem.tags?.join(', ') || '',
        visibility: editingItem.visibility as ModUploadData['visibility'],
        changeNotes: ''
      });
    } else {
      // Initialize empty form for new mod uploads
      setFormData({
        title: '',
        description: '',
        tags: '',
        visibility: 'public',
        changeNotes: ''
      });
    }
    setSelectedZipPath(null);
    setSelectedPreviewPath(null);
  }, [editingItem]);

  const handleSelectZip = async () => {
    try {
      onLog('info', 'Opening file selector for ZIP...');
      const path = await window.electronAPI.selectZip();
      if (path) {
        setSelectedZipPath(path);
        const filename = path.split(/[\\\/]/).pop();
        onLog('success', `Selected ZIP: ${filename}`);
        onShowStatus({ type: 'info', text: `Selected: ${filename}` });

        // Extract mod.js information to pre-populate form fields
        try {
          onLog('info', 'Extracting mod information from ZIP...');
          const packageInfo = await window.electronAPI.extractPackageInfo(path);
          
          if (packageInfo) {
            onLog('success', 'Successfully extracted mod information');
            
            // Only pre-populate fields that are empty (not overwrite existing data)
            setFormData(prev => ({
              ...prev,
              title: prev.title || packageInfo.title || packageInfo.name || prev.title,
              description: prev.description || packageInfo.description || prev.description,
              tags: prev.tags || (packageInfo.tags ? packageInfo.tags.join(', ') : prev.tags)
            }));

            // Log what was extracted for debugging
            if (packageInfo.title || packageInfo.name) {
              onLog('info', `Found mod title: ${packageInfo.title || packageInfo.name}`);
            }
            if (packageInfo.description) {
              onLog('info', `Found mod description: ${packageInfo.description.substring(0, 100)}${packageInfo.description.length > 100 ? '...' : ''}`);
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
            onLog('info', 'No mod.js found in ZIP file or could not extract metadata');
          }
        } catch (extractError) {
          const errorMsg = extractError instanceof Error ? extractError.message : 'Unknown error';
          onLog('error', `Failed to extract mod information: ${errorMsg}`);
          // Don't show error to user since this is optional functionality
        }
      } else {
        onLog('info', 'File selection cancelled');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to select zip file: ${errorMsg}`);
      onShowStatus({ type: 'error', text: 'Failed to select zip file' });
    }
  };

  const handleSelectPreview = async () => {
    try {
      onLog('info', 'Opening file selector for preview image...');
      const path = await window.electronAPI.selectPreviewImage();
      if (path) {
        setSelectedPreviewPath(path);
        const filename = path.split(/[\\\/]/).pop();
        onLog('success', `Selected image: ${filename}`);
        onShowStatus({ type: 'info', text: `Selected: ${filename}` });
      } else {
        onLog('info', 'Image selection cancelled');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to select preview image: ${errorMsg}`);
      onShowStatus({ type: 'error', text: 'Failed to select preview image' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For new mods, ZIP file is required. For editing, it's optional
    if (!editingItem && !selectedZipPath) {
      onShowStatus({ type: 'error', text: 'Please select a ZIP file' });
      return;
    }

    if (!formData.title || !formData.description) {
      onShowStatus({ type: 'error', text: 'Title and description are required' });
      return;
    }

    // Require change notes when updating existing mods with a new ZIP file
    if (editingItem && selectedZipPath && !formData.changeNotes.trim()) {
      onShowStatus({ type: 'error', text: 'Change notes are required when updating an existing mod' });
      return;
    }

    setIsUploading(true);

    // Generate automatic change notes for trivial updates (no ZIP)
    let changeNotes = formData.changeNotes;
    if (editingItem && !selectedZipPath) {
      const changes = [];
      if (formData.title !== editingItem.title) {
        changes.push(`Updated title from "${editingItem.title}" to "${formData.title}"`);
      }
      if (formData.description !== (editingItem.description || '')) {
        changes.push('Updated description');
      }
      if (formData.tags !== (editingItem.tags?.join(', ') || '')) {
        changes.push('Updated tags');
      }
      if (formData.visibility !== editingItem.visibility) {
        changes.push(`Changed visibility from ${editingItem.visibility} to ${formData.visibility}`);
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
      change_note: changeNotes || (editingItem ? 'Updated mod.' : undefined) // Alternative field for Steam compatibility
    };

    // Only include zipPath if we have a selected file
    if (selectedZipPath) {
      uploadData.zipPath = selectedZipPath;
    }

    try {
      await onUpload(uploadData);
      // On successful upload, go back to list
      onBack();
    } catch (error) {
      // Error is handled in parent component
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleOpenInSteam = async () => {
    if (editingItem) {
      onLog('info', `Opening workshop item in Steam: ${editingItem.title}`);
      try {
        await window.electronAPI.openSteamWorkshop(editingItem.publishedFileId);
        onShowStatus({ type: 'success', text: 'Opened Steam Workshop page' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        onLog('error', `Failed to open Steam Workshop: ${errorMsg}`);
        onShowStatus({ type: 'error', text: 'Failed to open Steam Workshop page' });
      }
    }
  };

  return (
    <div className="container">
      <GameTitle 
        subtitle="Steam Workshop Manager"
      />

      <main>
        <div className="section">
          <div className="editor-header">
            <button className="game-button" onClick={onBack} disabled={isUploading}>
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
                    ? (editingItem ? 'Updating...' : 'Uploading...') 
                    : (editingItem ? 'Update Workshop Item' : 'Upload to Workshop')
                  }
                </span>
              </button>
            </div>
          </div>

          <div className="form-container">
            <form id="mod-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{editingItem ? 'New Mod Package (.zip)' : 'Mod Package (.zip)*'}</label>
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
                  {selectedZipPath ? selectedZipPath.split(/[\\\/]/).pop() : editingItem ? 'No new file selected (will keep existing)' : 'No file selected'}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Title*</label>
              <input
                type="text"
                className="game-input"
                value={formData.title}
                onChange={handleInputChange('title')}
                required
                placeholder="Enter mod title"
                disabled={isUploading}
              />
            </div>

            <div className="form-group">
              <label>Description*</label>
              <textarea
                className="game-input"
                rows={6}
                value={formData.description}
                onChange={handleInputChange('description')}
                required
                placeholder="Describe your mod..."
                disabled={isUploading}
              />
            </div>

            <div className="form-group">
              <label>{editingItem ? 'New Preview Image' : 'Preview Image'}</label>
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
                  {selectedPreviewPath ? selectedPreviewPath.split(/[\\\/]/).pop() : editingItem ? 'No new image selected (will keep existing)' : 'No file selected'}
                </span>
              </div>
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
                  className="game-input"
                  rows={4}
                  value={formData.changeNotes}
                  onChange={handleInputChange('changeNotes')}
                  required={!!(editingItem && selectedZipPath)}
                  placeholder="Describe what's new in this version..."
                  disabled={isUploading}
                />
                <div className="form-help">
                  Required when updating an existing mod. Describe what's changed or improved.
                </div>
              </div>
            )}

          </form>
          </div>
        </div>
        
        <DebugConsole
          messages={debugMessages}
          onClear={onClearDebug}
        />
      </main>
    </div>
  );
};