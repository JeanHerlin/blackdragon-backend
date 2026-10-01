import env from '../../config/env';
import FxRateProvider from './FxRateProvider';
import OpenErApiFxRateProvider from './OpenErApiFxRateProvider';
import MockFxRateProvider from './MockFxRateProvider';

const fxRateProvider: FxRateProvider = env.fxProvider === 'mock' ? new MockFxRateProvider() : new OpenErApiFxRateProvider();

export default fxRateProvider;
