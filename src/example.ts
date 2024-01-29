import { ChainId, TradeType } from "./constants";
import { CurrencyAmount, Token } from "./entities";
import { Router } from "./router";

(async function () {
  const router = new Router(ChainId.TESTNET);

  const USDC_TOKEN = new Token(
    1,
    "CAMZFR4BHDUMT6J7INBBBGJG22WMS26RXEYORKC2ERZL2YGDIEEKTOJB",
    7,
    "USDC"
  );

  const XLM_TOKEN = new Token(
    1,
    "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4",
    7,
    "XLM"
  );

  const currencyAmount = CurrencyAmount.fromRawAmount(USDC_TOKEN, 10000000);
  const quoteCurrency = XLM_TOKEN;

  const route = await router.route(
    currencyAmount,
    quoteCurrency,
    TradeType.EXACT_INPUT
  );

  console.log({ route });
})();
