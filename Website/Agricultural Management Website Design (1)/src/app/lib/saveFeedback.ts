/** Inline validation only — never uses blocking browser alerts. */
export function showSaveError(message: string): void {
  console.warn(message);
}

export async function runSave(label: string, action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (e) {
    console.warn(`${label} could not be saved.`, e);
    return false;
  }
}
