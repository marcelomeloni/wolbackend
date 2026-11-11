import type { CreatePaymentArgs, PaymentResult } from './payments.service';

// Provider de pagamento simulado (modo demo).
// Não faz nenhuma chamada externa: aprova na hora para o fluxo de teste
// funcionar de ponta a ponta. O provider real (Mercado Pago) permanece intacto.
export class MockPayments {
  static async createPayment(_args: CreatePaymentArgs): Promise<PaymentResult> {
    return {
      paymentId: null,
      status: 'approved',
      statusDetail: 'MOCK_APPROVED',
      pixQrCodeBase64: null,
      pixQrCode: null,
    };
  }

  static async createCardToken(): Promise<{ id: string }> {
    return { id: 'mock-card-token' };
  }
}
