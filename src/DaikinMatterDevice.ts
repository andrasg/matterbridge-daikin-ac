import { airConditioner, bridgedNode, MatterbridgeEndpoint, powerSource } from "matterbridge";
import { DaikinAcPlatform } from "./platform.js";
import { DaikinAcDevice } from "./DaikinAcDevice.js";
import { createHash } from "node:crypto";
import { OnOff, TemperatureMeasurement, Thermostat } from "matterbridge/matter/clusters";
import { DaikinAcMode } from "./models/DaikinAcMode.js";

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
    }

    public async createEndpoint() {

        const info = await this.daikinDevice.getCommonBasicInfoAsync();
        const controlinfo = await this.daikinDevice.getACControlInfo();
        const sensorinfo = await this.daikinDevice.getACSensorInfo();

        const uniqueStorageKey = `daikin-ac-${info.name}`;

        const hash = createHash('sha256').update(uniqueStorageKey).digest('hex');
        const serial = hash.substring(0, 16);

        this.Endpoint = new MatterbridgeEndpoint([airConditioner, bridgedNode, powerSource], { uniqueStorageKey: uniqueStorageKey }, this.platform.config.debug as boolean)
            .createDefaultIdentifyClusterServer()
            .createDefaultBridgedDeviceBasicInformationClusterServer(
                `AC ${info.name}`,
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

        const targetTemp = controlinfo.targetTemperature === "M" ? 24 : controlinfo.targetTemperature; // Default to 24 if not set

        this.Endpoint.createDefaultGroupsClusterServer()
            .createDeadFrontOnOffClusterServer(info.power)
            .createDefaultThermostatClusterServer(sensorinfo.indoorTemperature, targetTemp, targetTemp)
            .createDefaultThermostatUserInterfaceConfigurationClusterServer()
            .createDefaultTemperatureMeasurementClusterServer(sensorinfo.indoorTemperature! * 100);


        this.Endpoint.addCommandHandler('on', () => { this.daikinDevice.switchOn(); });
        this.Endpoint.addCommandHandler('off', () => { this.daikinDevice.switchOff(); });

        this.Endpoint.subscribeAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint', (newValue: number) => { this.daikinDevice.setTargetTemperature(newValue / 100); } , this.Endpoint.log);
        this.Endpoint.subscribeAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', (newValue: number) => { this.daikinDevice.setTargetTemperature(newValue / 100); } , this.Endpoint.log);

        this.Endpoint.subscribeAttribute(Thermostat.Cluster.id, 'systemMode', (newValue: Thermostat.SystemMode) => { this.daikinDevice.setMode(this.mapMatterModeToDaikin(newValue)); } , this.Endpoint.log);
    }

    public async registerWithPlatform() {
        this.platform.setSelectDevice(this.Endpoint.serialNumber ?? '', this.Endpoint.deviceName ?? '', undefined, 'hub');

        if (this.platform.validateDevice(this.Endpoint.deviceName ?? '')) {
            await this.platform.registerDevice(this.Endpoint);
        }
    }

    public async restoreState() {
        const info = await this.daikinDevice.getCommonBasicInfoAsync();
        const controlinfo = await this.daikinDevice.getACControlInfo();
        const sensorinfo = await this.daikinDevice.getACSensorInfo();

        const targetTemp = controlinfo.targetTemperature === "M" ? 24 : controlinfo.targetTemperature; // Default to 24 if not set
        const mode = this.mapDaikinModeToMatter(info.power!, controlinfo.mode!);

        await this.Endpoint.setAttribute(OnOff.Cluster.id, 'onOff', info.power!, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint', targetTemp! * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', targetTemp! * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', sensorinfo.indoorTemperature! * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'localTemperature', sensorinfo.indoorTemperature! * 100, this.Endpoint.log);
        await this.Endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', mode, this.Endpoint.log);
    }

    private mapDaikinModeToMatter(power: boolean, mode: number): Thermostat.SystemMode {
        if (!power) {
            return Thermostat.SystemMode.Off;
        }

        switch (mode) {
            case 3:
                return Thermostat.SystemMode.Cool;
            case 0:
            case 1:
            case 2:
            case 4:
            default:
                return Thermostat.SystemMode.Off; // Default to off if mode is unknown
        }
    }

    private mapMatterModeToDaikin(mode: Thermostat.SystemMode): DaikinAcMode  {
        switch (mode) {
            case Thermostat.SystemMode.Cool:
                return DaikinAcMode.Cool;
            case Thermostat.SystemMode.Heat:
            case Thermostat.SystemMode.Auto:
            case Thermostat.SystemMode.Dry:
            case Thermostat.SystemMode.Off:
            default:
                return DaikinAcMode.Off; // Default to off if mode is unknown
        }
    }
}

export { DaikinMatterDevice }