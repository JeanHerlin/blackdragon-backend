export default abstract class FxRateProvider {
  abstract getUsdToArRate(): Promise<number>;
}
