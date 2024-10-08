import { Networks, Protocol } from "../src";
import { PairProvider } from "../src/providers/pair-provider";
import { SorobanContextType } from "../src/utils/contractInvoke/types";

describe("PairProvider", () => {
  const address0 = "ADDRESS_0";
  const address1 = "ADDRESS_1";
  const factoryAddress = "FACTORY_ADDRESS";

  test("getAllPairs Calls Backend When Is Testnet And Backend Is Working", async () => {
    const pairProvider = new PairProvider({
      network: Networks.TESTNET,
      cacheInSeconds: 20,
      getPairsFns: [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [],
        },
      ],
    });

    const getPairs = pairProvider.getPairsFns?.[0];

    const getPairsFromBackendMock = jest.spyOn(getPairs!, "fn");

    const getPairFromBlockchainMock = jest.spyOn(
      pairProvider,
      "getPairFromBlockchain"
    );

    getPairsFromBackendMock.mockResolvedValue([]);

    await pairProvider.getAllPairs(
      address0,
      address1,
      factoryAddress,
      {} as SorobanContextType,
      [Protocol.SOROSWAP]
    );

    // Verify that getPairsFromBackend and getPairFromBlockchain have been called as expected
    expect(getPairsFromBackendMock).toHaveBeenCalledTimes(1);

    expect(getPairFromBlockchainMock).toHaveBeenCalledTimes(0);
  });

  test("getAllPairs Fallbacks To getPairFromBlockchain When Backend Fails And Chain Is Testnet", async () => {
    const pairProvider = new PairProvider({
      cacheInSeconds: 20,
      network: Networks.TESTNET,
      getPairsFns: [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [],
        },
      ],
    });

    const getPairs = pairProvider.getPairsFns?.[0];

    const getPairsFromBackendMock = jest.spyOn(getPairs!, "fn");

    const getPairFromBlockchainMock = jest.spyOn(
      pairProvider,
      "getPairFromBlockchain"
    );

    // Mockea getPairsFromBackend to fail
    getPairsFromBackendMock.mockRejectedValue(new Error("Simulated error"));

    await pairProvider.getAllPairs(
      address0,
      address1,
      factoryAddress,
      {} as SorobanContextType,
      [Protocol.SOROSWAP]
    );

    // Verify that getPairsFromBackend and getPairFromBlockchain have been called as expected
    expect(getPairsFromBackendMock).toHaveBeenCalledTimes(1);

    expect(getPairFromBlockchainMock).toHaveBeenCalledWith(
      address0,
      address1,
      factoryAddress,
      {} as SorobanContextType
    );
    expect(getPairFromBlockchainMock).toHaveBeenCalledTimes(1);
  });

  test("getAllPairs Fallbacks To getPairFromBlockchain When Network Is Not Testnet", async () => {
    // using standalone chain id
    const pairProvider = new PairProvider({
      cacheInSeconds: 20,
      network: Networks.STANDALONE,
      getPairsFns: [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [],
        },
      ],
    });

    const getPairs = pairProvider.getPairsFns?.[0];

    const getPairsFromBackendMock = jest.spyOn(getPairs!, "fn");

    const getPairFromBlockchainMock = jest.spyOn(
      pairProvider,
      "getPairFromBlockchain"
    );

    await pairProvider.getAllPairs(
      address0,
      address1,
      factoryAddress,
      {} as SorobanContextType,
      [Protocol.SOROSWAP]
    );

    // Verify that getPairsFromBackend and getPairFromBlockchain have been called as expected
    expect(getPairsFromBackendMock).toHaveBeenCalledTimes(0);

    expect(getPairFromBlockchainMock).toHaveBeenCalledTimes(1);
    expect(getPairFromBlockchainMock).toHaveBeenCalledWith(
      address0,
      address1,
      factoryAddress,
      {} as SorobanContextType
    );
  });
});
