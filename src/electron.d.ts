interface ElectronAPI {
  saveFiles: (files: { name: string; buffer: ArrayBuffer }[]) => Promise<{
    canceled: boolean
    dir?: string
    error?: string
  }>
}

declare interface Window {
  electronAPI?: ElectronAPI
}
