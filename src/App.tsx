import { useRef, useState } from "react";
import JSZip from "jszip";
import "./App.css";

type ImageItem = {
  file: File;
  previewUrl: string;
  webpBlob: Blob | null;
  error: boolean;
};

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [quality, setQuality] = useState(0.9);
  const [qualityInput, setQualityInput] = useState("90");
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 品質が変わったら変換結果をリセットして再変換できるようにする
  const applyQuality = (v: number) => {
    setQualityInput(String(v));
    if (v === Math.round(quality * 100)) return;
    setQuality(v / 100);
    setImages((prev) =>
      prev.map((item) => ({ ...item, webpBlob: null, error: false })),
    );
  };

  const addFiles = (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    const newItems: ImageItem[] = imageFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      webpBlob: null,
      error: false,
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
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = item.previewUrl;
      img.onerror = () => reject(new Error("画像を読み込めません"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            // 巨大画像などでcanvasが変換できない場合はnullが返る
            if (blob) resolve(blob);
            else reject(new Error("変換できません"));
          },
          "image/webp",
          quality,
        );
      };
    });
  };

  const handleConvertAll = async () => {
    setIsConverting(true);
    try {
      const results = await Promise.all(
        images.map(async (item) => {
          try {
            return { file: item.file, webpBlob: await convertToWebp(item), error: false };
          } catch {
            return { file: item.file, webpBlob: null, error: true };
          }
        }),
      );
      // 変換中に削除された画像を復活させないよう、現在のリストに結果を差し込む
      setImages((prev) =>
        prev.map((item) => {
          const result = results.find((r) => r.file === item.file);
          return result ? { ...item, webpBlob: result.webpBlob, error: result.error } : item;
        }),
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleSave = async () => {
    if (window.electronAPI) {
      const files = await Promise.all(
        images
          .filter((item) => item.webpBlob)
          .map(async (item) => ({
            name: item.file.name.replace(/\.[^.]+$/, "") + ".webp",
            buffer: await item.webpBlob!.arrayBuffer(),
          })),
      );
      const result = await window.electronAPI.saveFiles(files);
      if (result.error) {
        alert(`保存に失敗しました：${result.error}`);
      } else if (!result.canceled) {
        alert(`保存しました：${result.dir}`);
      }
      return;
    }

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
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 全件処理済み（失敗込み）かつ1件以上成功していれば保存可能
  const allDone =
    images.length > 0 && images.every((i) => i.webpBlob || i.error);
  const allConverted = allDone && images.some((i) => i.webpBlob);

  return (
    <div className="app">
      {/* ツールバー */}
      <div className="toolbar">
        <span className="toolbar-title">画像変換ツール</span>
        <div className="toolbar-spacer" />
        <div className="quality-row">
          <label>品質</label>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={Math.round(quality * 100)}
            onChange={(e) => applyQuality(Number(e.target.value))}
          />
          <input
            className="quality-number"
            type="number"
            min={1}
            max={100}
            value={qualityInput}
            onChange={(e) => setQualityInput(e.target.value)}
            onBlur={() => {
              const v = Math.min(100, Math.max(1, Number(qualityInput) || 90));
              applyQuality(v);
            }}
          />
          <span>%</span>
        </div>
        {images.length > 0 && !allConverted && (
          <button
            className="toolbar-btn primary"
            onClick={handleConvertAll}
            disabled={isConverting}
          >
            {isConverting ? (
              <>
                <span className="spinner" />
                変換中…
              </>
            ) : (
              <>WebPに変換（{images.length}枚）</>
            )}
          </button>
        )}
        {allConverted && (
          <button className="toolbar-btn primary" onClick={handleSave}>
            {window.electronAPI ? "フォルダを選んで保存" : "ZIPでダウンロード"}
          </button>
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="main">
        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <p>ここに画像をドラッグ&amp;ドロップ（複数可）</p>
          <p className="dropzone-sub">クリックでファイル選択もできます / PNG・JPG → WebP</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {images.length > 0 && (
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
                        （{Math.round((1 - item.webpBlob.size / item.file.size) * 100)}% 削減）
                      </span>
                    </p>
                  )}
                  {item.error && (
                    <p className="convert-error">変換できませんでした（非対応の形式または破損ファイル）</p>
                  )}
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemove(i)}
                  disabled={isConverting}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
