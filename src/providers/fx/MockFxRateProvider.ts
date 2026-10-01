import FxRateProvider from './FxRateProvider';

// No network call — returns a fixed rate so dev/test runs don't depend on network access
// or drift unexpectedly between runs.
const MOCK_RATE = 4750;

export default class MockFxRateProvider extends FxRateProvider {
  async getUsdToArRate(): Promise<number> {
    return MOCK_RATE;
  }
}
