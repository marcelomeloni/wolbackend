import { formatBRL } from './mail';

interface OrderItem {
  snapshot_product_name: string;
  snapshot_color_name: string;
  snapshot_size_name: string;
  quantity: number;
  unit_price: number;
}

interface OrderEmailArgs {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentMethod: string;
  pixCode?: string | null;
  trackingCode?: string | null;
}

const baseStyle = `
  font-family: Arial, Helvetica, sans-serif; color: #303039; line-height: 1.6;
`;

function wrapper(title: string, content: string) {
  return `
  <div style="${baseStyle} max-width: 600px; margin: 0 auto; padding: 32px 24px;">
    <h1 style="font-size: 20px; text-transform: uppercase; letter-spacing: 2px;">WOL</h1>
    <h2 style="font-size: 16px; margin-top: 24px;">${title}</h2>
    ${content}
    <p style="margin-top: 32px; font-size: 12px; color: #888;">Vista a sua luz. — wearwol.com</p>
  </div>`;
}

function itemsTable(items: OrderItem[]) {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding: 8px 0;">${i.snapshot_product_name} — ${i.snapshot_color_name}/${i.snapshot_size_name}</td>
        <td style="padding: 8px 0; text-align: center;">${i.quantity}</td>
        <td style="padding: 8px 0; text-align: right;">${formatBRL(i.unit_price * i.quantity)}</td>
      </tr>`,
    )
    .join('');
  return `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">${rows}</table>`;
}

function totals(args: OrderEmailArgs) {
  return `
    <div style="margin-top: 16px; font-size: 13px;">
      <p style="display:flex; justify-content:space-between;">Subtotal: ${formatBRL(args.subtotal)}</p>
      <p>Frete: ${formatBRL(args.shipping)}</p>
      ${args.discount > 0 ? `<p>Desconto: -${formatBRL(args.discount)}</p>` : ''}
      <p style="font-weight: bold; font-size: 15px;">Total: ${formatBRL(args.total)}</p>
    </div>`;
}

export function orderPendingEmail(args: OrderEmailArgs) {
  const pix = args.pixCode
    ? `<p>Realize o pagamento via PIX usando o código abaixo:</p>
       <pre style="background:#f4f4f4; padding:12px; font-size:12px; word-break:break-all;">${args.pixCode}</pre>`
    : `<p>Assim que o pagamento for confirmado, iniciaremos a preparação do seu pedido.</p>`;

  return wrapper(
    `Pedido #${args.orderId.slice(0, 8)} recebido!`,
    `<p>Olá, ${args.customerName}!</p>
     <p>Recebemos seu pedido e ele está aguardando o pagamento.</p>
     ${itemsTable(args.items)}
     ${totals(args)}
     ${pix}`,
  );
}

export function orderPaidEmail(args: OrderEmailArgs) {
  return wrapper(
    `Pagamento confirmado — Pedido #${args.orderId.slice(0, 8)}`,
    `<p>Olá, ${args.customerName}!</p>
     <p>Seu pagamento foi aprovado e já estamos preparando o pedido.</p>
     ${itemsTable(args.items)}
     ${totals(args)}`,
  );
}

export function orderShippedEmail(args: OrderEmailArgs) {
  return wrapper(
    `Seu pedido foi enviado — #${args.orderId.slice(0, 8)}`,
    `<p>Olá, ${args.customerName}!</p>
     <p>Seu pedido saiu para entrega.</p>
     ${args.trackingCode ? `<p>Código de rastreio: <strong>${args.trackingCode}</strong></p>` : ''}
     ${itemsTable(args.items)}`,
  );
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return wrapper(
    'Redefinição de senha',
    `<p>Olá, ${name}!</p>
     <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo (válido por 1 hora):</p>
     <p><a href="${resetUrl}" style="display:inline-block; background:#303039; color:#fff; padding:12px 24px; text-decoration:none; text-transform:uppercase; letter-spacing:1px; font-size:12px;">Redefinir senha</a></p>
     <p style="font-size:12px; color:#888;">Se você não solicitou, ignore este e-mail.</p>`,
  );
}
