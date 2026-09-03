export class SettingsVersionConflictError extends Error {
  constructor() {
    super('SETTINGS_VERSION_CONFLICT');
    this.name = 'SettingsVersionConflictError';
  }
}
