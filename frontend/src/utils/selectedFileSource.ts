import type { SelectedFileSource } from '../types/ui';

export function getSelectedFileName(file: SelectedFileSource): string {
  if (typeof file === 'string') {
    return file.split(/[/\\]/).pop() ?? file;
  }

  return file.name;
}
