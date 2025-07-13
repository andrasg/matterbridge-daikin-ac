import { Matterbridge, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import { GIT_BRANCH, GIT_COMMIT } from './gitInfo.js';
import { DaikinMatterDevice } from './DaikinMatterDevice.js';

export class DaikinAcPlatform extends MatterbridgeDynamicPlatform {
    public debugEnabled: boolean;

    private isPluginConfigured = false;
    private isConfigValid = false;

    public daikinIPs: string[] = [];
    private devices: DaikinMatterDevice[] = [];

    constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
        super(matterbridge, log, config);

        this.log.info('Initializing Daikin AC platform');
        this.log.info(`Code build from branch '${GIT_BRANCH}', commit '${GIT_COMMIT}'`);

        this.debugEnabled = config.debug as boolean;

        if (config.daikinIPs) this.daikinIPs = config.daikinIPs as string[];

        this.isConfigValid = true;
    }

    override async onStart(reason?: string) {
        if (!this.isConfigValid) {
            throw new Error('Plugin not configured yet, configure first, then restart.');
        }

        this.log.info(`Starting Daikin AC dynamic platform v${this.version}: ` + reason);
        await this.createDevices();

        await this.ready;
        await this.clearSelect();
    }

    override async onConfigure() {
        await super.onConfigure();
        this.log.info(`Running onConfigure`);

        await this.restoreState();

        this.isPluginConfigured = true;
    }

    private async createDevices() {
        for (const daikinIP of this.daikinIPs) {
            const parts = daikinIP.split(',');

            const ip = parts[0];
            let options = {};

            if (parts.length > 1 && parts[1] === 'useGetToPost') {
                options = { useGetToPost: true };
            }

            this.log.info(`Creating Daikin AC device at IP: ${ip} with options: ${JSON.stringify(options)}`);
            const device = new DaikinMatterDevice(this, ip, options);

            await device.connect();
            await device.createEndpoint();

            this.devices.push(device);

            device.registerWithPlatform();
        }
    }

    private async restoreState() {
        this.log.info('Restoring state for Daikin AC platform');
        for (const device of this.devices) {
            await device.restoreState();
        }
    }

    override async onShutdown(reason?: string) {
        await super.onShutdown(reason);
        this.log.info('Shutting down Daikin AC platform: ' + reason);
    }
}
