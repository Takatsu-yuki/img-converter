import { useState } from 'react'
import './App.css'

function App() {
  const [isDragging, setIsDragging] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [webpUrl, setWebpUrl] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setWebpUrl(null)
  }

  const handleConvert = () => {
    if (!imageFile) return

    const img = new Image()
    img.src = URL.createObjectURL(imageFile)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (!blob) return
          setWebpUrl(URL.createObjectURL(blob))
        },
        'image/webp',
        0.9
      )
    }
  }

  const handleDownload = () => {
    if (!webpUrl || !imageFile) return

    const a = document.createElement('a')
    a.href = webpUrl
    a.download = imageFile.name.replace(/\.[^.]+$/, '') + '.webp'
    a.click()
  }

  return (
    <div className="container">
      <h1>画像変換ツール</h1>
      <p className="subtitle">PNG / JPG → WebP に変換します</p>

      <div
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="プレビュー" className="preview" />
        ) : (
          <p>ここに画像をドラッグ&amp;ドロップ</p>
        )}
      </div>

      {imageFile && (
        <p className="filename">{imageFile.name}</p>
      )}

      {imageFile && !webpUrl && (
        <button onClick={handleConvert}>WebPに変換する</button>
      )}

      {webpUrl && (
        <button onClick={handleDownload}>ダウンロード (.webp)</button>
      )}
    </div>
  )
}

export default App
