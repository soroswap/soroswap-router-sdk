import { ChainId, TradeType } from "./constants";
import { CurrencyAmount, Token } from "./entities";
import { Pair } from "./entities/pair";
import { Router } from "./router";

export const USDC_TOKEN = new Token(
  1,
  "CAMZFR4BHDUMT6J7INBBBGJG22WMS26RXEYORKC2ERZL2YGDIEEKTOJB",
  7,
  "USDC"
);

export const XLM_TOKEN = new Token(
  1,
  "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4",
  7,
  "XLM"
);

export const BRL_TOKEN = new Token(
  1,
  "CD7LKEZ56E2W5BA2AGSCGLF3OQYMDQTZMVKLKRLLQI6B4VKN4ICGBPNF",
  7,
  "BRL"
);

export const USDC_BRL = new Pair(
  CurrencyAmount.fromRawAmount(USDC_TOKEN, 10000000),
  CurrencyAmount.fromRawAmount(BRL_TOKEN, 10000000)
);

export const BRL_XLM = new Pair(
  CurrencyAmount.fromRawAmount(BRL_TOKEN, 10000000),
  CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000000)
);

export const USDC_XLM = new Pair(
  CurrencyAmount.fromRawAmount(USDC_TOKEN, 100000000),
  CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000000)
);

(async function () {
  const router = new Router(ChainId.TESTNET);

  const currencyAmount = CurrencyAmount.fromRawAmount(USDC_TOKEN, 20000000);
  const quoteCurrency = XLM_TOKEN;

  const routeExactIn = await router.route(
    currencyAmount,
    quoteCurrency,
    TradeType.EXACT_INPUT
  );

  console.log(routeExactIn?.trade);

  const routeExactOut = await router.route(
    currencyAmount,
    quoteCurrency,
    TradeType.EXACT_OUTPUT
  );

  console.log(routeExactOut?.trade);
})();
