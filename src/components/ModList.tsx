import React, { useState, useEffect, useCallback } from 'react';
import { WorkshopItem, WorkshopItemsResult } from '../types';
import { DebugMessage } from '../hooks/useDebugLog';
import { GameTitle } from './GameTitle';
import { DebugConsole } from './DebugConsole';
import { ConfirmDialog } from './ConfirmDialog';
import { SteamStatus } from './SteamStatus';

interface ModListProps {
  onCreateNew: () => void;
  onEditItem?: (item: WorkshopItem) => void;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
  debugMessages: DebugMessage[];
  onClearDebug: () => void;
}

export const ModList: React.FC<ModListProps> = ({
  onCreateNew,
  onEditItem,
  onLog,
  debugMessages,
  onClearDebug,
}) => {
  const [workshopItems, setWorkshopItems] = useState<WorkshopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [status, setStatus] = useState<
    'success' | 'steam_not_connected' | 'error'
  >('success');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    item: WorkshopItem | null;
  }>({ isOpen: false, item: null });
  const [deleting, setDeleting] = useState(false);

  const loadWorkshopItems = useCallback(async () => {
    setLoading(true);
    try {
      onLog('info', 'Loading your Steam Workshop items...');

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<WorkshopItemsResult>((resolve) => {
        setTimeout(
          () =>
            resolve({
              items: [],
              status: 'error',
              message: 'Request timed out - Steam may not be responding',
            }),
          5000,
        );
      });

      const result = await Promise.race([
        window.electronAPI.getWorkshopItems(),
        timeoutPromise,
      ]);

      setWorkshopItems(Array.isArray(result.items) ? result.items : []);
      setStatus(result.status);
      setStatusMessage(result.message || '');

      if (result.status === 'success') {
        if (result.items && result.items.length > 0) {
          onLog('success', `Loaded ${result.items.length} workshop items`);
        } else {
          onLog('info', result.message || 'No workshop items found');
        }
      } else if (result.status === 'steam_not_connected') {
        onLog('error', result.message || 'Steam is not connected');
      } else {
        onLog('error', result.message || 'Failed to load workshop items');
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to load workshop items: ${errorMsg}`);
      setWorkshopItems([]);
      setStatus('error');
      setStatusMessage(`Failed to load workshop items: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [onLog]);

  useEffect(() => {
    // Wait for Steam to initialize
    const timer = setTimeout(() => {
      loadWorkshopItems();
    }, 2000);

    // Also listen for Steam initialization event
    window.electronAPI.onSteamInitialized(() => {
      loadWorkshopItems();
    });

    return () => clearTimeout(timer);
  }, [loadWorkshopItems]);

  const handleRefresh = () => {
    loadWorkshopItems();
  };

  const handleDeleteClick = (item: WorkshopItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.item) return;

    setDeleting(true);
    onLog('info', `Deleting "${deleteConfirm.item.title}"...`);

    try {
      const result = await window.electronAPI.deleteWorkshopItem(
        deleteConfirm.item.publishedFileId,
      );

      if (result.success) {
        onLog('success', `Successfully deleted "${deleteConfirm.item.title}"`);
        // Remove from local list
        setWorkshopItems((prev) =>
          prev.filter(
            (i) => i.publishedFileId !== deleteConfirm.item?.publishedFileId,
          ),
        );
      } else {
        onLog('error', `Failed to delete: ${result.error}`);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to delete: ${errorMsg}`);
    } finally {
      setDeleting(false);
      setDeleteConfirm({ isOpen: false, item: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, item: null });
  };

  if (loading) {
    return (
      <div className="container">
        <GameTitle subtitle="Steam Workshop Manager" />
        <main>
          <div className="section">
            <div className="section-header">
              <SteamStatus />
            </div>
            <div className="loading">Loading Steam Workshop...</div>
          </div>

          <DebugConsole messages={debugMessages} onClear={onClearDebug} />
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <GameTitle subtitle="Steam Workshop Manager" />

      <main>
        <div className="section">
          <div className="section-header">
            <SteamStatus onRetry={handleRefresh} />
            <button
              className="game-button small"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>

          <div className="mod-list-container">
            <div className="mod-list">
              {/* Create New Mod - Always at top */}
              <div
                className="mod-item create-new single-row"
                onClick={onCreateNew}
              >
                <div className="mod-info-compact">
                  <h3 className="mod-title-compact">+ Upload New Mod</h3>
                </div>
              </div>

              {/* Workshop Items */}
              {workshopItems.length === 0 ? (
                <div className="no-mods">
                  <p>
                    {status === 'steam_not_connected'
                      ? '🔌 Steam Connection Issue'
                      : status === 'error'
                        ? '❌ Error Loading Items'
                        : '📦 No Workshop Items'}
                  </p>
                  <p>{statusMessage || 'No workshop items found.'}</p>
                  {status === 'steam_not_connected' && (
                    <button
                      className="game-button small"
                      onClick={handleRefresh}
                      style={{ marginTop: '10px' }}
                    >
                      Retry Connection
                    </button>
                  )}
                </div>
              ) : (
                workshopItems.map((item) => (
                  <WorkshopItemCard
                    key={item.publishedFileId}
                    item={item}
                    onEdit={onEditItem}
                    onDelete={handleDeleteClick}
                    onLog={onLog}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <DebugConsole messages={debugMessages} onClear={onClearDebug} />
      </main>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Workshop Item"
        message={`Are you sure you want to delete "${deleteConfirm.item?.title}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

interface WorkshopItemCardProps {
  item: WorkshopItem;
  onEdit?: (item: WorkshopItem) => void;
  onDelete: (item: WorkshopItem, e: React.MouseEvent) => void;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
}

const WorkshopItemCard: React.FC<WorkshopItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onLog,
}) => {
  const handleEdit = () => {
    if (onEdit) {
      onEdit(item);
      onLog('info', `Editing workshop item: ${item.title}`);
    }
  };

  return (
    <div className="mod-item workshop-item single-row" onClick={handleEdit}>
      <div className="mod-info-compact">
        <h3 className="mod-title-compact">{item.title}</h3>
        <div className="mod-stats-compact">
          <span className="stat-compact" title="Subscribers">
            <span className="stat-icon">👥</span>
            {item.subscriptions || 0}
          </span>
          <span className="stat-compact" title="Favorites">
            <span className="stat-icon">⭐</span>
            {item.favorited || 0}
          </span>
          <span className="stat-compact" title="Views">
            <span className="stat-icon">👁</span>
            {item.views || 0}
          </span>
          <span className="mod-visibility-badge-compact">{item.visibility}</span>
        </div>
      </div>
      <div className="mod-item-actions">
        <button
          className="game-button small danger"
          onClick={(e) => onDelete(item, e)}
          title="Delete this workshop item"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};
