export interface MuralWebhookEnvelope {
  eventId: string;
  deliveryId: string;
  transactionId?: string;
  attemptNumber: number;
  eventCategory: string;
  occurredAt: string;
  payload: unknown;
}

export interface AccountCreditedPayload {
  type: 'account_credited';
  accountId: string;
  organizationId: string;
  transactionId: string;
  tokenAmount: {
    blockchain: string;
    tokenAmount: number;
    tokenSymbol: string;
    tokenContractAddress?: string;
  };
  transactionDetails: {
    blockchain: string;
    transactionDate: string;
    transactionHash: string;
    sourceWalletAddress: string;
    destinationWalletAddress: string;
  };
  accountWalletAddress: string;
}
