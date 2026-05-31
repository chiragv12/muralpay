import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { MuralAccountRow } from './mural-account.types';
import type { CheckoutWalletResolution } from './checkout-wallet.types';
import type {
  CreateCopPayoutParams,
  MuralPayoutRequestResponse,
} from './mural-payout.types';

function normalizeAccountsPayload(raw: unknown): MuralAccountRow[] {
  if (raw == null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw as MuralAccountRow[];
  }
  if (typeof raw === 'object' && raw !== null && 'accounts' in raw) {
    const inner = (raw as { accounts?: unknown }).accounts;
    if (Array.isArray(inner)) {
      return inner as MuralAccountRow[];
    }
  }
  return [];
}

@Injectable()
export class MuralService {
  private readonly logger = new Logger(MuralService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Lists Mural accounts for the configured organization (`on-behalf-of` on HttpModule).
   * @see https://developers.muralpay.com/docs/get-account-details
   */
  async listAccounts(): Promise<MuralAccountRow[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<unknown>('/api/accounts'),
      );
      return normalizeAccountsPayload(data);
    } catch (err) {
      this.mapMuralAxiosError(err, 'GET /api/accounts');
    }
  }

  private mapMuralAxiosError(err: unknown, context: string): never {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const data = err.response?.data as unknown;
      let detail: string;
      if (data && typeof data === 'object' && 'message' in data) {
        detail = String(data.message);
      } else if (typeof data === 'string') {
        detail = data;
      } else {
        detail = err.message;
      }
      const errorInstanceId =
        data &&
        typeof data === 'object' &&
        'errorInstanceId' in data &&
        (data as { errorInstanceId?: string }).errorInstanceId
          ? ` errorInstanceId=${(data as { errorInstanceId: string }).errorInstanceId}`
          : '';
      this.logger.warn(
        `${context} failed: status=${status ?? 'n/a'} detail=${detail}${errorInstanceId}`,
      );
      throw new BadGatewayException({
        message: `Mural API request failed (${context}).`,
        muralStatus: status ?? null,
        muralMessage: detail,
      });
    }
    throw err;
  }

  /**
   * Resolves the merchant wallet USDC (or primary stablecoin balance row) should be sent to for checkout.
   * Uses `MURAL_ACCOUNT_ID` when set; otherwise picks the first active account with wallet details.
   */
  async resolveCheckoutWallet(): Promise<CheckoutWalletResolution> {
    const configuredId = this.config.get<string>('MURAL_ACCOUNT_ID');
    const rows = await this.listAccounts();
    const candidates = configuredId?.length
      ? rows.filter((a) => a.id === configuredId)
      : rows;

    const usable = candidates.find(
      (a) =>
        (!a.status || a.status === 'ACTIVE') &&
        Boolean(a.accountDetails?.walletDetails?.walletAddress),
    );

    if (!usable?.accountDetails?.walletDetails?.walletAddress) {
      throw new BadGatewayException(
        'No suitable Mural account with an on-chain wallet was found. Check MURAL_ACCOUNT_ID or provision accounts in sandbox.',
      );
    }

    const wallet = usable.accountDetails.walletDetails;
    const balances = usable.accountDetails.balances ?? [];
    const usdc = balances.find((b) => b.tokenSymbol === 'USDC') ?? balances[0];

    return {
      muralAccountId: usable.id,
      walletAddress: wallet.walletAddress as string,
      blockchain: wallet.blockchain ?? usdc?.blockchain ?? 'POLYGON',
      tokenSymbol: usdc?.tokenSymbol ?? 'USDC',
      tokenContractAddress: usdc?.tokenContractAddress,
    };
  }

  /**
   * Creates a single-recipient COP fiat payout (sandbox-friendly inline bank details).
   * @see https://developers.muralpay.com/docs/create-a-payout-request
   */
  async createCopPayout(
    params: CreateCopPayoutParams,
  ): Promise<MuralPayoutRequestResponse> {
    const body = {
      sourceAccountId: params.sourceAccountId,
      memo: params.memo,
      payouts: [
        {
          amount: {
            tokenSymbol: 'USDC',
            tokenAmount: params.tokenAmount,
          },
          payoutDetails: {
            type: 'fiat',
            bankName: 'Bancamia S.A.',
            bankAccountOwner: 'Merchant Settlement',
            fiatAndRailDetails: {
              type: 'cop',
              symbol: 'COP',
              accountType: 'CHECKING',
              phoneNumber: '+57 601 555 5555',
              bankAccountNumber: '1234567890123456',
              documentNumber: '1234567890',
              documentType: 'NATIONAL_ID',
            },
          },
          recipientInfo: {
            type: 'individual',
            firstName: 'Merchant',
            lastName: 'Settlement',
            email: 'merchant-settlement@example.com',
            dateOfBirth: '1980-01-15',
            physicalAddress: {
              address1: 'Cra. 37 #10A 29',
              country: 'CO',
              state: 'Antioquia',
              city: 'Medellin',
              zip: '050015',
            },
          },
        },
      ],
    };

    try {
      const { data } = await firstValueFrom(
        this.http.post<MuralPayoutRequestResponse>('/api/payouts/payout', body),
      );
      return data;
    } catch (err) {
      this.mapMuralAxiosError(err, 'POST /api/payouts/payout');
    }
  }

  async executePayoutRequest(
    payoutRequestId: string,
  ): Promise<MuralPayoutRequestResponse> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<MuralPayoutRequestResponse>(
          `/api/payouts/payout/${payoutRequestId}/execute`,
          {},
        ),
      );
      return data;
    } catch (err) {
      this.mapMuralAxiosError(
        err,
        `POST /api/payouts/payout/${payoutRequestId}/execute`,
      );
    }
  }

  async getPayoutRequest(
    payoutRequestId: string,
  ): Promise<MuralPayoutRequestResponse> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<MuralPayoutRequestResponse>(
          `/api/payouts/payout/${payoutRequestId}`,
        ),
      );
      return data;
    } catch (err) {
      this.mapMuralAxiosError(
        err,
        `GET /api/payouts/payout/${payoutRequestId}`,
      );
    }
  }
}
