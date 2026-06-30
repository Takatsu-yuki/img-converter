import { useState } from "react";
import JSZip from "jszip";
import "./App.css";

type ImageItem = {
  file: File;
  previewUrl: string;
  webpBlob: Blob | null;
};

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [quality, setQuality] = useState(0.9);

  const addFiles = (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    const newItems: ImageItem[] = imageFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      webpBlob: null,
    }));
    setImages((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const convertToWebp = (item: ImageItem): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = item.previewUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob!), "image/webp", quality);
      };
    });
  };

  const handleConvertAll = async () => {
    const converted = await Promise.all(
      images.map(async (item) => ({
        ...item,
        webpBlob: await convertToWebp(item),
      })),
    );
    setImages(converted);
  };

  const handleSave = async () => {
    // Electron環境：フォルダ選択して直接保存
    if (window.electronAPI) {
      const files = await Promise.all(
        images
          .filter((item) => item.webpBlob)
          .map(async (item) => ({
            name: item.file.name.replace(/\.[^.]+$/, "") + ".webp",
            buffer: await item.webpBlob!.arrayBuffer(),
          }))
      );
      const result = await window.electronAPI.saveFiles(files);
      if (!result.canceled) {
        alert(`保存しました：${result.dir}`);
      }
      return;
    }

    // ブラウザ環境：ZIPダウンロード
    const zip = new JSZip();
    images.forEach((item) => {
      if (!item.webpBlob) return;
      const name = item.file.name.replace(/\.[^.]+$/, "") + ".webp";
      zip.file(name, item.webpBlob);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "converted.zip";
    a.click();
  };

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const allConverted = images.length > 0 && images.every((i) => i.webpBlob);

  return (
    <div className="container">
      <h1>画像変換ツール</h1>
      <p className="subtitle">PNG / JPG → WebP に変換します</p>

      <div
        className={`dropzone ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>ここに画像をドラッグ&amp;ドロップ（複数可）</p>
      </div>

      {images.length > 0 && (
        <>
          <div className="quality-row">
            <label>品質: {Math.round(quality * 100)}%</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </div>

          <div className="image-list">
            {images.map((item, i) => (
              <div key={i} className="image-item">
                <img src={item.previewUrl} alt={item.file.name} />
                <div className="image-info">
                  <p className="image-name">{item.file.name}</p>
                  <p className="image-size">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </p>
                  {item.webpBlob && (
                    <p className="converted-size">
                      → {(item.webpBlob.size / 1024).toFixed(0)} KB
                      <span className="reduction">
                        （
                        {Math.round(
                          (1 - item.webpBlob.size / item.file.size) * 100,
                        )}
                        % 削減）
                      </span>
                    </p>
                  )}
                </div>
                <button className="remove-btn" onClick={() => handleRemove(i)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {!allConverted && (
            <button onClick={handleConvertAll}>
              まとめてWebPに変換する（{images.length}枚）
            </button>
          )}

          {allConverted && (
            <button onClick={handleSave}>
              {window.electronAPI ? "フォルダを選んで保存" : "ZIPでダウンロード"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default App;
