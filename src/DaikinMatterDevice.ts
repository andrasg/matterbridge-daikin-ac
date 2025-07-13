import { createHash } from 'node:crypto';

import { airConditioner, bridgedNode, MatterbridgeEndpoint, powerSource } from 'matterbridge';
import { OnOff, TemperatureMeasurement, Thermostat } from 'matterbridge/matter/clusters';

import { DaikinAcPlatform } from './platform.js';
import { DaikinAcDevice } from './DaikinAcDevice.js';
import { DaikinAcMode } from './models/DaikinAcMode.js';

class DaikinMatterDevice {
    private ip: string;
    private options: { useGetToPost?: boolean };
    private platform: DaikinAcPlatform;
    private daikinDevice: DaikinAcDevice;
    public Endpoint!: MatterbridgeEndpoint;

    constructor(platform: DaikinAcPlatform, ip: string, options: { useGetToPost?: boolean } = {}) {
        this.ip = ip;
        this.options = options;
        this.platform = platform;

        this.daikinDevice = new DaikinAcDevice(this.platform, this.ip, this.options);
    }

    public async connect() {
        await this.daikinDevice.connect();

        this.daikinDevice.startUpdates(
            (power: boolean) => {
                this.Endpoint.setAttribute(OnOff.Cluster.id, 'onOff', power, this.Endpoint.log);
            },
            (power: boolean, mode: number) => {
                const matterMode = this.mapDaikinModeToMatter(power, mode);
                this.Endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', matterMode, this.Endpoint.log);
            },
            (indoorTemp: number) => {
                this.Endpoint.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', indoorTemp * 100, this.Endpoint.log);
                this.Endpoint.setAttribute(Thermostat.Cluster.id, 'localTemperature', indoorTemp * 100, this.Endpoint.log);
            },
            (targetTemp: number) => {
                this.Endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint', targetTemp * 100, this.Endpoint.log);
                this.Endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', targetTemp * 100, this.Endpoint.log);
            },
        );
    }

    public async createEndpoint() {
        const uniqueStorageKey = `daikin-ac-${this.daikinDevice.name}`;

        const hash = createHash('sha256').update(uniqueStorageKey).digest('hex');
        const serial = hash.substring(0, 16);

        this.Endpoint = new MatterbridgeEndpoint([airConditioner, bridgedNode, powerSource], { uniqueStorageKey: uniqueStorageKey }, this.platform.config.debug as boolean)
            .createDefaultIdentifyClusterServer()
            .createDefaultBridgedDeviceBasicInformationClusterServer(
                `AC ${this.daikinDevice.name}`,
                serial,
                0xfff1,
                'Matterbridge',
                `Matterbridge Daikin AC`,
                parseInt(this.platform.version.replace(/\D/g, '')),
                this.platform.version === '' ? 'Unknown' : this.platform.version,
                parseInt(this.platform.matterbridge.matterbridgeVersion.replace(/\D/g, '')),
                this.platform.matterbridge.matterbridgeVersion,
            );

        this.Endpoint.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
            this.platform.log.info(`Command identify called identifyTime: ${identifyTime}`);
        });

        if (!this.daikinDevice.currentState) {
            throw new Error('Daikin AC device is connected but current state is undefined');
        }

        const targetTemp = this.daikinDevice.currentState.targetTemperature === 'M' ? 24 : (this.daikinDevice.currentState.targetTemperature ?? 24); // Default to 24 if not set
        const currentTemp = this.daikinDevice.currentState.indoorTemperature ?? 24;

        this.Endpoint.createDefaultGroupsClusterServer()
            .createDeadFrontOnOffClusterServer(this.daikinDevice.currentState.power)
            .createDefaultThermostatClusterServer(this.daikinDevice.currentState.indoorTemperature, targetTemp, targetTemp)
            .createDefaultThermostatUserInterfaceConfigurationClusterServer()
            .createDefaultTemperatureMeasurementClusterServer(currentTemp * 100);

        this.Endpoint.addCommandHandler('on', () => {
            this.daikinDevice.switchOn();
        });
        this.Endpoint.addCommandHandler('off', () => {
            this.daikinDevice.switchOff();
        });

        this.Endpoint.subscribeAttribute(
            Thermostat.Cluster.id,
            'occupiedCoolingSetpoint',
            (newValue: number) => {
                this.daikinDevice.setTargetTemperature(newValue / 100);
            },
            this.Endpoint.log,
        );
        this.Endpoint.subscribeAttribute(
            Thermostat.Cluster.id,
            'occupiedHeatingSetpoint',
            (newValue: number) => {
                this.daikinDevice.setTargetTemperature(newValue / 100);
            },
            this.Endpoint.log,
        );

        this.Endpoint.subscribeAttribute(
            Thermostat.Cluster.id,
            'systemMode',
            (newValue: Thermostat.SystemMode) => {
                this.daikinDevice.setMode(this.mapMatterModeToDaikin(newValue));
            },
            this.Endpoint.log,
        );
    }

    public async registerWithPlatform() {
        this.platform.setSelectDevice(this.Endpoint.serialNumber ?? '', this.Endpoint.deviceName ?? '', undefined, 'hub');

        if (this.platform.validateDevice(this.Endpoint.deviceName ?? '')) {
            await this.platform.registerDevice(this.Endpoint);
        }
    }

    public async restoreState() {
        const targetTemp = this.daikinDevice.currentState?.targetTemperature === 'M' ? 24 : (this.daikinDevice.currentState?.targetTemperature ?? 24); // Default to 24 if not set
        const currentTemp = this.daikinDevice.currentState?.indoorTemperature ?? 24;
        const power = this.daikinDevice.currentState?.power ?? false;
        const mode = this.mapDaikinModeToMatter(power, this.daikinDevice.currentState?.mode);

        await this.Endpoint.setAttribute(OnOff.Cluster.id, 'onOff', power, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint', targetTemp * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', targetTemp * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', currentTemp * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'localTemperature', currentTemp * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', mode, this.Endpoint.log);
    }

    private mapDaikinModeToMatter(power: boolean, mode: number | undefined): Thermostat.SystemMode {
        if (!power || mode === undefined) {
            return Thermostat.SystemMode.Off;
        }

        switch (mode) {
            case 2:
                return Thermostat.SystemMode.Dry;
            case 3:
                return Thermostat.SystemMode.Cool;
            case 4:
                return Thermostat.SystemMode.Heat;
            case 6:
                return Thermostat.SystemMode.FanOnly;
            case 7:
                return Thermostat.SystemMode.Auto;
            default:
                return Thermostat.SystemMode.Off; // Default to off if mode is unknown
        }
    }

    private mapMatterModeToDaikin(mode: Thermostat.SystemMode): DaikinAcMode {
        switch (mode) {
            case Thermostat.SystemMode.Cool:
                return DaikinAcMode.Cool;
            case Thermostat.SystemMode.Heat:
                return DaikinAcMode.Heat;
            case Thermostat.SystemMode.Auto:
                return DaikinAcMode.Auto;
            case Thermostat.SystemMode.Dry:
                return DaikinAcMode.Dry;
            case Thermostat.SystemMode.FanOnly:
                return DaikinAcMode.FanOnly;
            case Thermostat.SystemMode.Off:
            default:
                return DaikinAcMode.Off; // Default to off if mode is unknown
        }
    }
}

export { DaikinMatterDevice };
