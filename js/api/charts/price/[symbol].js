import ohlcvHandler from '../../../market/ohlcv/[symbol].js';

export default async function handler(request, response) {
  return ohlcvHandler(request, response);
}
