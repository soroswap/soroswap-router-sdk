import { Address } from '@stellar/stellar-sdk';

export const parseScval = (scval: any) => {
  return Address.contract(scval.address().contractId()).toString();
};
