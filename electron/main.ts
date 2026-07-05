import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { writeFile, mkdir, access } from 'fs/promises'
import { join, dirname, parse } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// 同名ファイルがある場合は「名前 (1).webp」のように連番を付ける
async function uniquePath(dir: string, name: string): Promise<string> {
  const { name: base, ext } = parse(name)
  let candidate = join(dir, name)
  for (let i = 1; ; i++) {
    try {
      await access(candidate)
      candidate = join(dir, `${base} (${i})${ext}`)
    } catch {
      return candidate
    }
  }
}

// 保存先フォルダを選んで、変換済みファイルをすべて保存する
ipcMain.handle('save-files', async (_, files: { name: string; buffer: ArrayBuffer }[]) => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: '保存先フォルダを選択',
    properties: ['openDirectory', 'createDirectory'],
  })

  if (canceled || filePaths.length === 0) return { canceled: true }

  const dir = filePaths[0]
  try {
    await mkdir(dir, { recursive: true })

    for (const file of files) {
      const dest = await uniquePath(dir, file.name)
      await writeFile(dest, Buffer.from(file.buffer))
    }
  } catch (e) {
    return { canceled: false, error: e instanceof Error ? e.message : String(e) }
  }

  return { canceled: false, dir }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
