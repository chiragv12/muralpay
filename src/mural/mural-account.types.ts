/** Subset of Mural `GET /api/accounts` rows used for checkout instructions. */
export interface MuralAccountRow {
  id: string;
  status?: string;
  name?: string;
  accountDetails?: {
    balances?: Array<{
      tokenSymbol?: string;
      tokenAmount?: number;
      blockchain?: string;
      tokenContractAddress?: string;
    }>;
    walletDetails?: {
      walletAddress?: string;
      blockchain?: string;
    };
  };
}
