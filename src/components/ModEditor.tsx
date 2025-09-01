import React, { useState, useEffect } from 'react';
import { ModUploadData } from '../types';
import { LocalMod } from '../types/navigation';

interface ModEditorProps {
  mod?: LocalMod; // undefined for create new
  onBack: () => void;
  onUpload: (data: ModUploadData) => Promise<void>;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
  onShowStatus: (message: { type: 'success' | 'error' | 'info'; text: string }) => void;
}

export const ModEditor: React.FC<ModEditorProps> = ({ 
  mod, 
  onBack, 
  onUpload, 
  onLog, 
  onShowStatus 
}) => {
  const isEditing = !!mod;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    visibility: 'public' as ModUploadData['visibility']
  });
  const [selectedZipPath, setSelectedZipPath] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize form data when editing existing mod
  useEffect(() => {
    if (mod) {
      setFormData({
        title: mod.metadata.name || mod.name,
        description: mod.metadata.description || '',
        tags: '', // Could extract from metadata if stored
        visibility: 'public'
      });
    } else {
      // Reset form for new mod
      setFormData({
        title: '',
        description: '',
        tags: '',
        visibility: 'public'
      });
      setSelectedZipPath(null);
      setSelectedPreviewPath(null);
    }
  }, [mod]);

  const handleSelectZip = async () => {
    try {
      onLog('info', 'Opening file selector for ZIP...');
      const path = await window.electronAPI.selectZip();
      if (path) {
        setSelectedZipPath(path);
        const filename = path.split(/[\\\/]/).pop();
        onLog('success', `Selected ZIP: ${filename}`);
        onShowStatus({ type: 'info', text: `Selected: ${filename}` });
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

    if (!selectedZipPath) {
      onShowStatus({ type: 'error', text: 'Please select a ZIP file' });
      return;
    }

    if (!formData.title || !formData.description) {
      onShowStatus({ type: 'error', text: 'Title and description are required' });
      return;
    }

    setIsUploading(true);

    const uploadData: ModUploadData = {
      zipPath: selectedZipPath,
      title: formData.title,
      description: formData.description,
      tags: formData.tags,
      visibility: formData.visibility,
      previewImagePath: selectedPreviewPath || undefined,
      workshopId: mod?.workshopId || undefined // Include workshop ID for updates
    };

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

  return (
    <div className="container">
      <header>
        <h1>{isEditing ? 'Edit Mod' : 'Create New Mod'}</h1>
        <p className="subtitle">
          {isEditing ? mod.metadata.name || mod.name : 'Upload to Steam Workshop'}
        </p>
      </header>

      <main>
        <div className="section">
          <div className="editor-header">
            <button className="game-button" onClick={onBack} disabled={isUploading}>
              ← Back to Mod List
            </button>
            {isEditing && mod.workshopId && (
              <div className="workshop-info">
                <span className="workshop-id">Workshop ID: {mod.workshopId}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Mod Package (.zip)*</label>
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
                  {selectedZipPath ? selectedZipPath.split(/[\\\/]/).pop() : 'No file selected'}
                </span>
              </div>
              {isEditing && (
                <p className="form-help">
                  Select a new ZIP file to update this mod, or the same ZIP to republish.
                </p>
              )}
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
              <label>Preview Image</label>
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
                  {selectedPreviewPath ? selectedPreviewPath.split(/[\\\/]/).pop() : 'No file selected'}
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

            <div className="form-actions">
              <button
                type="submit"
                className="game-button primary"
                disabled={isUploading}
              >
                <span className="button-text">
                  {isUploading 
                    ? 'Uploading...' 
                    : isEditing && mod.workshopId
                      ? 'Update Workshop Item'
                      : 'Upload to Workshop'
                  }
                </span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};