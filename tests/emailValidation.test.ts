import { describe, it, expect } from 'vitest';
import { isValidEmail } from '../src/lib/emailValidation';

describe('isValidEmail', () => {
  it('menerima alamat email yang wajar', () => {
    expect(isValidEmail('budi@example.com')).toBe(true);
    expect(isValidEmail('a.b-c@sub.domain.go.id')).toBe(true);
  });
  // WHY: baris tanpa email atau salah format tidak boleh dianggap penerima valid,
  // supaya tidak memicu kirim yang pasti gagal / bocor ke alamat salah.
  it('menolak yang kosong / salah format', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
    expect(isValidEmail('budi')).toBe(false);
    expect(isValidEmail('budi@')).toBe(false);
    expect(isValidEmail('budi@example')).toBe(false);
    expect(isValidEmail('a b@example.com')).toBe(false);
  });
});
