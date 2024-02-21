import {
  ChainId,
  CurrencyAmount,
  Protocols,
  Router,
  Token,
  TradeType,
} from "../src";

const createRouter = () => {
  return new Router(
    "http://localhost:4000",
    "cualquiercosa",
    100000,
    [Protocols.SOROSWAP, Protocols.SOROSWAP],
    ChainId.TESTNET
  );
};

const createToken = (address: string) => {
  return new Token(ChainId.TESTNET, address, 7);
};

const XLM_TOKEN = createToken(
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
);
const USDC_TOKEN = createToken(
  "CAX5P5UDDFJ2VNTQOGO6X5RI7EV53GQSXKRXNL467VDSZYNS2MG6DEEH"
);

describe("Router", () => {
  let amountCurrency: CurrencyAmount<Token>;
  let quoteCurrency: Token;

  beforeEach(() => {
    amountCurrency = CurrencyAmount.fromRawAmount(XLM_TOKEN, 1000);
    quoteCurrency = USDC_TOKEN;
  });

  it("Ensure Direct Routing Between Tokens With Equal Reserves", async () => {
    const router = createRouter();

    const routes = await router.routeSplittingProtocols(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    console.log(routes);
  }, 20000);
});
