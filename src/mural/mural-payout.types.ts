export interface MuralPayoutRequestResponse {
  id: string;
  status: string;
  sourceAccountId?: string;
  memo?: string;
}

export interface CreateCopPayoutParams {
  sourceAccountId: string;
  tokenAmount: number;
  memo: string;
}
