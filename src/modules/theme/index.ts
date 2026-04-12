import { Module } from '@medusajs/framework/utils';

import ThemeModuleService from './service';

export const THEME_MODULE = 'themeModule';

export default Module(THEME_MODULE, {
  service: ThemeModuleService,
});
