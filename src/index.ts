import { Matterbridge, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import { DaikinAcPlatform } from './platform.js';

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 * Each plugin should return the platform.
 *
 * Initializes the Daikin AC plugin.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {AnsiLogger} log - The logger instance.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {DaikinAcPlatform} The initialized Daikin AC platform.
 */
export default function initializePlugin(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig): DaikinAcPlatform {
    return new DaikinAcPlatform(matterbridge, log, config);
}
