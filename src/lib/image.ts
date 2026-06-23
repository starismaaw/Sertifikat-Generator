const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Validate type/size, read as data URL, and measure natural dimensions. */
export function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      reject(new Error('Background harus berupa gambar PNG atau JPG'));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('Ukuran gambar maksimal 5 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('File gambar tidak valid'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
