import React, { useState, useEffect } from 'react';

interface ImagePreviewProps {
  filePath: string | null;
  alt?: string;
  className?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  filePath,
  alt = 'Preview',
  className = '',
}) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setImageData(null);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    let isCancelled = false;

    window.electronAPI
      .readFileBase64(filePath)
      .then((data) => {
        if (!isCancelled) {
          setImageData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [filePath]);

  if (!filePath) {
    return null;
  }

  if (loading) {
    return (
      <div className={`image-preview ${className}`}>
        <div className="image-preview-loading">Loading preview...</div>
      </div>
    );
  }

  if (error || !imageData) {
    return (
      <div className={`image-preview ${className}`}>
        <div className="image-preview-error">Failed to load preview</div>
      </div>
    );
  }

  return (
    <div className={`image-preview ${className}`}>
      <img src={imageData} alt={alt} className="image-preview-img" />
    </div>
  );
};
