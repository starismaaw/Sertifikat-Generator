import type { CertEvent, FieldValues } from '../types';
import { buildCertNumber } from './numberFormatter';

/**
 * Merge static event fields with a person's dynamic values and a claimed
 * sequence number into a full FieldValues map for rendering.
 */
export function resolveValues(
  event: CertEvent,
  person: FieldValues,
  claimedNumber: number,
): FieldValues {
  return {
    acara: event.nama,
    tanggal: event.tanggal,
    namaPenandatangan: event.penandatangan.nama,
    penandatangan: event.penandatangan.jabatan,
    nomor: buildCertNumber(
      event.polaNomor,
      claimedNumber,
      event.nomorPadding,
      new Date(event.tanggal),
    ),
    ...person, // person values (nama, peran) override
  };
}
