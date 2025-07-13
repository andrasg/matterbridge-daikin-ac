import { BasicInfoResponse, ControlInfo, DaikinAC, SensorInfoResponse } from 'daikin-controller';

import { DaikinAcPlatform } from './platform.js';
import { DaikinAcMode } from './models/DaikinAcMode.js';
import { DaikinAcState } from './models/DaikinAcState.js';

class DaikinAcDevice {
    private ip: string;
    private connectionPromise: Promise<void>;
    private platform: DaikinAcPlatform;
    private daikinDevice!: DaikinAC;
    private isConnected: boolean = false;
    public currentState: DaikinAcState | undefined = undefined;
    public name: string = '';
    private powerUpdatedCallback: ((power: boolean) => void) | undefined;
    private indoorTempUpdatedCallback: ((indorrTemp: number) => void) | undefined;
    private targetTempUpdatedCallback: ((targetTemp: number) => void) | undefined;
    private modeUpdatedCallback: ((power: boolean, mode: number) => void) | undefined;

    constructor(platform: DaikinAcPlatform, ip: string, options: { useGetToPost?: boolean } = {}) {
        this.ip = ip;
        this.platform = platform;

        // Create the connection promise
        this.connectionPromise = new Promise<void>((resolve, reject) => {
            this.daikinDevice = new DaikinAC(this.ip, options, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    this.isConnected = true;
                    resolve();
                }
            });
        });
    }

    public async connect() {
        try {
            this.platform.log.info(`Connecting to Daikin AC at ${this.ip}`);
            await this.connectionPromise;
            this.platform.log.info(`Connected`);
        } catch (error) {
            this.platform.log.error(`Failed to connect to Daikin AC:`, error);
            throw error;
        }
        const info = await this.getCommonBasicInfoAsync();
        this.name = info.name ?? `Daikin AC ${this.ip}`;
        await this.getACControlInfo();
        await this.getACControlInfo();
        this.updateCurrentState();
    }

    public startUpdates(
        powerUpdatedCallback: (power: boolean) => void,
        modeUpdatedCallback: (power: boolean, mode: number) => void,
        indoorTempUpdatedCallback: (indoorTemp: number) => void,
        targetTempUpdatedCallback: (targetTemp: number) => void,
    ) {
        this.powerUpdatedCallback = powerUpdatedCallback;
        this.modeUpdatedCallback = modeUpdatedCallback;
        this.indoorTempUpdatedCallback = indoorTempUpdatedCallback;
        this.targetTempUpdatedCallback = targetTempUpdatedCallback;
        this.daikinDevice.setUpdate(15000, this.calculateDelta.bind(this));
    }

    private calculateDelta() {
        if (this.currentState?.power !== this.daikinDevice.currentACControlInfo?.power) {
            this.platform.log.info(`Power changed from ${this.currentState?.power} to ${this.daikinDevice.currentACControlInfo?.power}`);
            if (this.powerUpdatedCallback && this.daikinDevice.currentACControlInfo?.power !== undefined) {
                this.powerUpdatedCallback(this.daikinDevice.currentACControlInfo.power);
            }
        }
        if (this.currentState?.mode !== this.daikinDevice.currentACControlInfo?.mode) {
            this.platform.log.info(`Mode changed from ${this.currentState?.mode} to ${this.daikinDevice.currentACControlInfo?.mode}`);
            if (this.modeUpdatedCallback && this.daikinDevice.currentACControlInfo?.power !== undefined && this.daikinDevice.currentACControlInfo?.mode !== undefined) {
                this.modeUpdatedCallback(this.daikinDevice.currentACControlInfo.power, this.daikinDevice.currentACControlInfo.mode);
            }
        }
        if (this.currentState?.indoorTemperature !== this.daikinDevice.currentACSensorInfo?.indoorTemperature) {
            this.platform.log.info(`Indoor temperature changed from ${this.currentState?.indoorTemperature} to ${this.daikinDevice.currentACSensorInfo?.indoorTemperature}`);
            if (this.indoorTempUpdatedCallback && this.daikinDevice.currentACSensorInfo?.indoorTemperature !== undefined) {
                this.indoorTempUpdatedCallback(this.daikinDevice.currentACSensorInfo.indoorTemperature);
            }
        }
        if (this.currentState?.targetTemperature !== this.daikinDevice.currentACControlInfo?.targetTemperature) {
            this.platform.log.info(`Target temperature changed from ${this.currentState?.targetTemperature} to ${this.daikinDevice.currentACControlInfo?.targetTemperature}`);
            if (
                this.targetTempUpdatedCallback &&
                this.daikinDevice.currentACControlInfo?.targetTemperature !== undefined &&
                this.daikinDevice.currentACControlInfo?.targetTemperature !== 'M'
            ) {
                this.targetTempUpdatedCallback(this.daikinDevice.currentACControlInfo.targetTemperature);
            }
        }
        this.updateCurrentState();
    }

    private updateCurrentState() {
        if (!this.currentState) {
            this.currentState = new DaikinAcState();
        }
        this.currentState.indoorTemperature = this.daikinDevice.currentACSensorInfo?.indoorTemperature;
        this.currentState.targetTemperature = this.daikinDevice.currentACControlInfo?.targetTemperature;
        this.currentState.power = this.daikinDevice.currentACControlInfo?.power;
        this.currentState.mode = this.daikinDevice.currentACControlInfo?.mode;
    }

    public async getCommonBasicInfoAsync(): Promise<BasicInfoResponse> {
        if (!this.isConnected) {
            this.platform.log.warn(`Connect needs to be called first`);
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.daikinDevice.getCommonBasicInfo((err: Error | null, data: BasicInfoResponse | null) => {
                if (err) {
                    reject(err);
                } else {
                    if (data === null) {
                        reject(new Error('No data received from Daikin AC'));
                        return;
                    }
                    resolve(data);
                }
            });
        });
    }

    public async getACControlInfo(): Promise<ControlInfo> {
        if (!this.isConnected) {
            this.platform.log.warn(`Connect needs to be called first`);
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.daikinDevice.getACControlInfo((err: Error | null, data: ControlInfo | null) => {
                if (err) {
                    reject(err);
                } else {
                    if (data === null) {
                        reject(new Error('No data received from Daikin AC'));
                        return;
                    }
                    resolve(data);
                }
            });
        });
    }

    public async setACControlInfo(obj: Partial<ControlInfo>): Promise<ControlInfo> {
        if (!this.isConnected) {
            this.platform.log.warn(`Connect needs to be called first`);
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.daikinDevice.setACControlInfo(obj, (err: Error | null, data: ControlInfo | null) => {
                if (err) {
                    reject(err);
                } else {
                    if (data === null) {
                        reject(new Error('No data received from Daikin AC'));
                        return;
                    }
                    resolve(data);
                }
            });
        });
    }

    public async getACSensorInfo(): Promise<SensorInfoResponse> {
        if (!this.isConnected) {
            this.platform.log.warn(`Connect needs to be called first`);
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.daikinDevice.getACSensorInfo((err: Error | null, data: SensorInfoResponse | null) => {
                if (err) {
                    reject(err);
                } else {
                    if (data === null) {
                        reject(new Error('No data received from Daikin AC'));
                        return;
                    }
                    resolve(data);
                }
            });
        });
    }

    public async setMode(mode: DaikinAcMode) {
        await this.setACControlInfo({ mode: mode });
    }

    public async switchOn() {
        await this.setACControlInfo({ power: true });
    }

    public async switchOff() {
        await this.setACControlInfo({ power: false });
    }

    public async setTargetTemperature(newValue: number) {
        await this.setACControlInfo({ targetTemperature: newValue });
    }
}

export { DaikinAcDevice };
