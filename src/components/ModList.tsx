import React, { useState, useEffect } from 'react';
import { LocalMod } from '../types/navigation';

interface ModListProps {
  onSelectMod: (mod: LocalMod) => void;
  onCreateNew: () => void;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
}

export const ModList: React.FC<ModListProps> = ({ onSelectMod, onCreateNew, onLog }) => {
  const [mods, setMods] = useState<LocalMod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMods();
  }, []);

  const loadMods = async () => {
    setLoading(true);
    try {
      onLog('info', 'Scanning for local mods...');
      const foundMods = await window.electronAPI.getModsDirectory();
      setMods(foundMods || []);
      onLog('success', `Found ${foundMods?.length || 0} mods`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to load mods: ${errorMsg}`);
      setMods([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <header>
          <h1>Mod Manager</h1>
          <p className="subtitle">Ascend from Nine Mountains</p>
        </header>
        <main>
          <div className="section">
            <div className="loading">Scanning for mods...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Mod Manager</h1>
        <p className="subtitle">Ascend from Nine Mountains</p>
      </header>

      <main>
        <div className="section">
          <h2>Your Mods</h2>
          
          <div className="mod-list">
            {/* Create New Mod - Always at top */}
            <div className="mod-item create-new" onClick={onCreateNew}>
              <div className="mod-info">
                <h3>+ Create New Mod</h3>
                <p className="mod-description">
                  Create and upload a new mod to the Steam Workshop
                </p>
              </div>
              <div className="mod-actions">
                <div className="mod-status create">New</div>
              </div>
            </div>

            {/* Existing Mods */}
            {mods.length === 0 ? (
              <div className="no-mods">
                <p>No mods found in the parent directory.</p>
                <p>Place your mod folders alongside this ModUploader folder.</p>
              </div>
            ) : (
              mods.map(mod => (
                <ModListItem 
                  key={mod.name} 
                  mod={mod} 
                  onClick={() => onSelectMod(mod)} 
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

interface ModListItemProps {
  mod: LocalMod;
  onClick: () => void;
}

const ModListItem: React.FC<ModListItemProps> = ({ mod, onClick }) => {
  const hasWorkshopId = !!mod.workshopId;
  
  return (
    <div className="mod-item" onClick={onClick}>
      <div className="mod-info">
        <h3>{mod.metadata.name || mod.name}</h3>
        <p className="mod-description">
          {mod.metadata.description || 'No description available'}
        </p>
        <div className="mod-metadata">
          <span>Version: {mod.metadata.version || '1.0.0'}</span>
          {mod.metadata.author && <span>Author: {mod.metadata.author}</span>}
          {hasWorkshopId && (
            <span className="workshop-id">Workshop ID: {mod.workshopId}</span>
          )}
        </div>
      </div>
      <div className="mod-actions">
        <div className={`mod-status ${hasWorkshopId ? 'published' : 'local'}`}>
          {hasWorkshopId ? 'Published' : 'Local Only'}
        </div>
      </div>
    </div>
  );
};