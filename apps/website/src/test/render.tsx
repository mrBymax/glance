import { Theme } from '@astryxdesign/core/theme';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { defaultThemeSlug, themes } from '../astryx-themes';

export function renderWithTheme(ui: ReactElement): RenderResult {
  return render(<Theme theme={themes[defaultThemeSlug]}>{ui}</Theme>);
}
