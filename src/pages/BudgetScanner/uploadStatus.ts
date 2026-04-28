export type UploadStatus = { bericht: string; fout: boolean } | null

export function appendUploadStatus(
  prev: UploadStatus,
  nieuwBericht: string,
  heeftUploadFout: boolean,
): UploadStatus {
  return {
    bericht: prev?.bericht ? `${prev.bericht} | ${nieuwBericht}` : nieuwBericht,
    fout: (prev?.fout ?? false) || heeftUploadFout,
  }
}
