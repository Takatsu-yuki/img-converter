import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  saveFiles: (files: { name: string; buffer: ArrayBuffer }[]) =>
    ipcRenderer.invoke('save-files', files),
})
