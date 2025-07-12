import { BasicInfoResponse, ControlInfo, DaikinAC, SensorInfoResponse } from "daikin-controller";
import { DaikinAcPlatform } from "./platform.js";
import { DaikinAcMode } from "./models/DaikinAcMode.js";

class DaikinAcDevice {
    private ip: string;
    private connectionPromise: Promise<void>;
    private platform: DaikinAcPlatform;
    private daikinDevice!: DaikinAC;
    private isConnected: boolean = false;

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

    public async switchOn() {
        await this.setACControlInfo({ power: true });
    }

    public async switchOff() {
        await this.setACControlInfo({ power: false });
    }

    public async setTargetTemperature(newValue: number) {
        await this.setACControlInfo({ targetTemperature: newValue });
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
                    resolve(data!);
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
                    resolve(data!);
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
                    resolve(data!);
                }
            });
        });
    }

    public async setMode(mode: DaikinAcMode) {
        await this.setACControlInfo({ mode: mode });
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
                    resolve(data!);
                }
            });
        });
    }

}

export { DaikinAcDevice }