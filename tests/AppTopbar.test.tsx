import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();
vi.mock('../src/components/AppRouter', () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
}));

import { AppTopbar } from '../src/components/AppTopbar';

beforeEach(() => navigateMock.mockClear());

describe('AppTopbar', () => {
  it('navigates to the home (hub) view when the logo is clicked', () => {
    render(<AppTopbar breadcrumbs={[{ label: 'Beranda', active: true }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beranda' }));
    expect(navigateMock).toHaveBeenCalledWith({ name: 'home' });
  });
});
