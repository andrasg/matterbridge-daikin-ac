class DaikinAcState {
    public power: boolean | undefined;
    public targetTemperature: number | 'M' | undefined;
    public indoorTemperature: number | undefined;
    public mode: number | undefined;
}

export { DaikinAcState };
