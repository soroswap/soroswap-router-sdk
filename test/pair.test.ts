import { Pair } from '../src/entities/pair'; // Adjust the import path as needed
import { createToken } from './router.test';
import { CurrencyAmount } from '../src/index';

const XLM_TOKEN = createToken("XLM_ADDRESS")
const USDC_TOKEN = createToken("USDC_ADDRESS")

describe('Pair', () => {
    describe.only('Phoenix', () => {
        let pair: Pair;

        beforeEach(() => {
            pair = new Pair(
                CurrencyAmount.fromRawAmount(XLM_TOKEN, "8291494350066"), // Mocked reserve0
                CurrencyAmount.fromRawAmount(USDC_TOKEN, "706515116511") // Mocked reserve1
            );
        });

        it('should correctly calculate the output amount for Phoenix protocol', () => {
            // Arrange

            const inputAmount = CurrencyAmount.fromRawAmount(XLM_TOKEN, 100_000_0000000); // Mocked input amount

            const [outputAmount, _] = pair.getOutputAmountPhoenix(inputAmount);

            const expectedOutputAmount = CurrencyAmount.fromRawAmount(USDC_TOKEN, "75810794757");
            expect(outputAmount).toEqual(expectedOutputAmount);
        });

        it('should correctly calculate the output amount for Phoenix protocol', () => {
            // Arrange

            const inputAmount = CurrencyAmount.fromRawAmount(XLM_TOKEN, 10_000_0000000); // Mocked input amount

            const [outputAmount, _] = pair.getOutputAmountPhoenix(inputAmount);

            const expectedOutputAmount = CurrencyAmount.fromRawAmount(USDC_TOKEN, "8394161299");
            expect(outputAmount).toEqual(expectedOutputAmount);
        });

        it('should correctly calculate the input amount for Phoenix protocol', () => {
            const outputAmount = CurrencyAmount.fromRawAmount(USDC_TOKEN, 1_0000000); // Mocked output amount
            const [inputAmount, _] = pair.getInputAmountPhoenix(outputAmount);

            const expectedInputAmount = CurrencyAmount.fromRawAmount(XLM_TOKEN, "117712438");
            expect(inputAmount.quotient).toEqual(expectedInputAmount.quotient);
            expect(inputAmount.equalTo(expectedInputAmount)).toBe(true);
        });
    });
});