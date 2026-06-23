export type FieldTipe =
  | 'nama'
  | 'nomor'
  | 'acara'
  | 'tanggal'
  | 'peran'
  | 'penandatangan'
  | 'namaPenandatangan';

export type Perataan = 'left' | 'center' | 'right';

export interface Field {
  id: string;
  tipe: FieldTipe;
  x: number;        // natural-pixel anchor X
  y: number;        // natural-pixel baseline Y from top
  lebar: number;    // natural-pixel width of the text box
  font: string;     // 'Helvetica' | 'Times' | 'Courier'
  ukuran: number;   // font size in natural pixels
  warna: string;    // hex, e.g. '#000000'
  perataan: Perataan;
}

export interface Penandatangan {
  nama: string;
  jabatan: string;
}

export interface CertEvent {
  id: string;
  nama: string;
  tanggal: string;        // ISO yyyy-mm-dd
  background: string;     // data URL
  bgWidth: number;        // natural width px
  bgHeight: number;       // natural height px
  fields: Field[];
  polaNomor: string;      // e.g. '{n}/SERT/P3KP/{bulan}/{tahun}'
  nomorMulai: number;
  nomorPadding: number;
  nomorTerakhir: number;  // last issued; next = max(nomorTerakhir+1, nomorMulai)
  penandatangan: Penandatangan;
}

/** Resolved string values for one certificate, keyed by field tipe. */
export type FieldValues = Partial<Record<FieldTipe, string>>;
