import {
  CurrencyAmount,
  Networks,
  Protocols,
  Router,
  Token,
  TradeType,
} from "../src";
import { GetPairsFns } from "../src/router/router";

const createRouter = (
  maxHops: number,
  getPairsFns: GetPairsFns,
  protocols: Protocols[] = [Protocols.SOROSWAP],
) => {
  return new Router({
    pairsCacheInSeconds: 60,
    protocols: protocols,
    network: Networks.TESTNET,
    getPairsFns,
    maxHops: maxHops,
  });
};

const createToken = (address: string) => {
  return new Token(Networks.TESTNET, address, 7);
};

const XLM_TOKEN = createToken("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
const USDC_TOKEN = createToken("CCGCRYUTDRP52NOPS35FL7XIOZKKGQWSP3IYFE6B66KD4YOGJMWVC5PR");

describe("Router", () => {
  let currencyAmount: CurrencyAmount<Token>;
  let quoteCurrency: Token;

  beforeEach(() => {
    currencyAmount = CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000000);
    quoteCurrency = USDC_TOKEN;
  });

  it("100 XLM to USDC in Testnet Max Hops 5", async () => {
    const router = createRouter(
      5, //maxHops
      [
      {
        protocol: Protocols.SOROSWAP,
        fn: async () => {
          const res = await fetch(
            // this endpoint is used to get the pairs for Testnet which `Router` will used to determine conversion rate
            new URL(
              "https://info.soroswap.finance/api/pairs/plain?network=TESTNET",
            ),
          );

          const data = await res.json();

          return data;
        },
      },
    ]);

    console.log("🚀 ~ it ~ router:", router)



    const route = await router.route(
      currencyAmount,
      quoteCurrency,
      TradeType.EXACT_INPUT,
    );
    console.log("🚀 ~ it ~ route:", route)

    // const route = await router.route(
    //   amountCurrency,
    //   quoteCurrency,
    //   TradeType.EXACT_INPUT
    // );

    // expect(exactInput?.trade.path).toEqual(["XLM_ADDRESS", "USDC_ADDRESS"]);

    // const exactOutput = await router.route(
    //   amountCurrency,
    //   quoteCurrency,
    //   TradeType.EXACT_OUTPUT
    // );

    // expect(exactOutput?.trade.path).toEqual(["USDC_ADDRESS", "XLM_ADDRESS"]);
  });

  it("100 XLM to USDC in Testnet Max Hops 1", async () => {
    const router = createRouter(
      1, //maxHops
      [
      {
        protocol: Protocols.SOROSWAP,
        fn: async () => {
          const res = await fetch(
            // this endpoint is used to get the pairs for Testnet which `Router` will used to determine conversion rate
            new URL(
              "https://info.soroswap.finance/api/pairs/plain?network=TESTNET",
            ),
          );

          const data = await res.json();

          return data;
        },
      },
    ]);

    console.log("🚀 ~ it ~ router:", router)

    const route = await router.route(
      currencyAmount,
      quoteCurrency,
      TradeType.EXACT_INPUT,
    );
    console.log("🚀 ~ it ~ route:", route)

  });

  
});
