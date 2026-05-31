import { createVerify } from 'crypto';

/**
 * @see https://developers.muralpay.com/docs/signature-validation
 */
export function verifyMuralWebhookSignature(
  rawBody: string,
  signatureBase64: string,
  timestampHeader: string,
  publicKeyPem: string,
): boolean {
  const messageToSign = `${timestampHeader}.${rawBody}`;
  const signatureBuffer = Buffer.from(signatureBase64, 'base64');

  try {
    return createVerify('SHA256').update(messageToSign).verify(
      {
        key: publicKeyPem,
        dsaEncoding: 'der',
      },
      signatureBuffer,
    );
  } catch {
    return false;
  }
}
