import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();
vi.mock('../src/components/AppRouter', () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
}));

import { Hub } from '../src/components/Hub';

beforeEach(() => navigateMock.mockClear());

describe('Hub', () => {
  it('renders both module cards', () => {
    render(<Hub />);
    expect(screen.getByRole('button', { name: 'Sertifikat Generator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pakta Integritas' })).toBeInTheDocument();
  });

  it('navigates to the sertifikat view when the Sertifikat Generator card is clicked', () => {
    render(<Hub />);
    fireEvent.click(screen.getByRole('button', { name: 'Sertifikat Generator' }));
    expect(navigateMock).toHaveBeenCalledWith({ name: 'sertifikat' });
  });

  it('navigates to the pakta-admin view when the Pakta Integritas card is clicked', () => {
    render(<Hub />);
    fireEvent.click(screen.getByRole('button', { name: 'Pakta Integritas' }));
    expect(navigateMock).toHaveBeenCalledWith({ name: 'pakta-admin' });
  });
});
