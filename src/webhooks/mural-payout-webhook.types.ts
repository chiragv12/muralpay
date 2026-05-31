export interface PayoutRequestStatusChangedPayload {
  type: 'payout_request_status_changed';
  organizationId: string;
  payoutRequestId: string;
  statusChangeDetails: {
    previousStatus: { type: string };
    currentStatus: { type: string };
  };
}

export interface PayoutStatusChangedPayload {
  type: 'payout_status_changed';
  organizationId: string;
  payoutRequestId: string;
  payoutId: string;
  statusChangeDetails: {
    type: 'fiat' | 'blockchain';
    previousStatus: { type: string };
    currentStatus: { type: string };
  };
}
