export interface CheckoutWalletResolution {
  muralAccountId: string;
  walletAddress: string;
  blockchain: string;
  tokenSymbol: string;
  tokenContractAddress?: string;
}
