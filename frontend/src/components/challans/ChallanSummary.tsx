import { formatUnitPrice } from '../../constants/product.ts';
import type { ChallanLineDraft } from './ChallanProductTable.tsx';

interface ChallanSummaryProps {
  customerName?: string;
  lines: ChallanLineDraft[];
}

export function ChallanSummary({ customerName, lines }: ChallanSummaryProps) {
  const totalQuantity = lines.reduce((sum, line) => sum + (Number.isInteger(line.quantity) ? line.quantity : 0), 0);
  const estimatedValue = lines.reduce((sum, line) => {
    const price = Number.parseFloat(line.product.unitPrice);
    if (!Number.isFinite(price) || !Number.isInteger(line.quantity)) return sum;
    return sum + price * line.quantity;
  }, 0);

  return (
    <section>
      <h2 className="text-section">Review</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-caption">Customer</dt>
          <dd className="mt-1 text-body">{customerName || 'Not selected'}</dd>
        </div>
        <div>
          <dt className="text-caption">Product lines</dt>
          <dd className="mt-1 text-body tabular-nums">{lines.length}</dd>
        </div>
        <div>
          <dt className="text-caption">Total quantity</dt>
          <dd className="mt-1 text-body tabular-nums">{totalQuantity}</dd>
        </div>
        <div>
          <dt className="text-caption">Estimated value</dt>
          <dd className="mt-1 text-body tabular-nums">{formatUnitPrice(estimatedValue)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-caption">
        Estimated value uses current catalog prices for this draft. It is not stored as a challan total. The server
        calculates quantity and snapshots when you save.
      </p>
    </section>
  );
}
