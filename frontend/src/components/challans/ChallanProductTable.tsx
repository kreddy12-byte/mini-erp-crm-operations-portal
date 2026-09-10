import { CloseIcon, PlusIcon } from '../../assets/icons.tsx';
import { StockStatusBadge } from '../products/productDisplay.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { SearchSelect } from './SearchSelect.tsx';
import { challanLineQuantityError } from './challanErrors.ts';
import { formatUnitPrice } from '../../constants/product.ts';
import type { Product } from '../../types/product.ts';
import { cn } from '../../utils/cn.ts';

export interface ChallanLineDraft {
  product: Product;
  quantity: number;
}

interface ChallanProductTableProps {
  lines: ChallanLineDraft[];
  productQuery: string;
  productOptions: Product[];
  productLoading: boolean;
  onProductQueryChange: (value: string) => void;
  onAddProduct: (product: Product) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  disabled?: boolean;
  duplicateError?: string;
}

function quantityError(line: ChallanLineDraft): string | undefined {
  return challanLineQuantityError(line.quantity, line.product.currentStock);
}

export function ChallanProductTable({
  lines,
  productQuery,
  productOptions,
  productLoading,
  onProductQueryChange,
  onAddProduct,
  onQuantityChange,
  onRemove,
  disabled = false,
  duplicateError,
}: ChallanProductTableProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-section">Products</h2>
          <p className="mt-1 text-secondary">Stock shown here is current catalog availability. Confirmation still re-checks it on the server.</p>
        </div>
      </div>

      <div className="mb-4 max-w-xl">
        <SearchSelect
          label="Add product"
          query={productQuery}
          onQueryChange={onProductQueryChange}
          options={productOptions}
          loading={productLoading}
          disabled={disabled}
          placeholder="Search name or SKU"
          emptyText="No matching products"
          error={duplicateError}
          hint={
            <span className="inline-flex items-center gap-1">
              <PlusIcon className="h-3.5 w-3.5" />
              Select a product to add a line
            </span>
          }
          getKey={(option) => option.id}
          getLabel={(option) => option.name}
          getDescription={(option) =>
            `${option.sku} · ${formatUnitPrice(option.unitPrice)} · ${option.currentStock} available`
          }
          onSelect={onAddProduct}
        />
      </div>

      {lines.length === 0 ? (
        <p className="text-secondary">No products on this challan yet.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-caption">
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Available</th>
                  <th className="py-2 pr-4 font-medium">Unit price</th>
                  <th className="py-2 pr-4 font-medium">Quantity</th>
                  <th className="py-2 pr-4 font-medium">Line estimate</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const error = quantityError(line);
                  const estimate = Number.parseFloat(line.product.unitPrice) * line.quantity;
                  return (
                    <tr
                      key={line.product.id}
                      className={cn('border-b border-line last:border-b-0', error && 'bg-danger-muted/40')}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-ink">{line.product.name}</div>
                        <div className="mt-1">
                          <StockStatusBadge status={line.product.stockStatus} />
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-secondary">{line.product.sku}</td>
                      <td className="py-3 pr-4 text-ink">{line.product.currentStock}</td>
                      <td className="py-3 pr-4 text-secondary">{formatUnitPrice(line.product.unitPrice)}</td>
                      <td className="py-3 pr-4">
                        <Input
                          label={`Quantity for ${line.product.name}`}
                          hideLabel
                          name={`qty-${line.product.id}`}
                          type="number"
                          min={1}
                          step={1}
                          value={Number.isFinite(line.quantity) ? line.quantity : ''}
                          disabled={disabled}
                          error={error}
                          onChange={(event) => onQuantityChange(line.product.id, Number.parseInt(event.target.value, 10))}
                        />
                      </td>
                      <td className="py-3 pr-4 text-secondary">
                        {Number.isFinite(estimate) ? formatUnitPrice(estimate) : '—'}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Remove ${line.product.name}`}
                          onClick={() => onRemove(line.product.id)}
                        >
                          <CloseIcon className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-4 md:hidden">
            {lines.map((line) => {
              const error = quantityError(line);
              const estimate = Number.parseFloat(line.product.unitPrice) * line.quantity;
              return (
                <li
                  key={line.product.id}
                  className={cn('border-b border-line pb-4', error && 'rounded-md bg-danger-muted/40 px-3 pt-3')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{line.product.name}</p>
                      <p className="text-caption">
                        {line.product.sku} · {formatUnitPrice(line.product.unitPrice)}
                      </p>
                    </div>
                    <StockStatusBadge status={line.product.stockStatus} />
                  </div>
                  <p className="mt-2 text-caption">{line.product.currentStock} available</p>
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                    <Input
                      label="Quantity"
                      name={`qty-mobile-${line.product.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={Number.isFinite(line.quantity) ? line.quantity : ''}
                      disabled={disabled}
                      error={error}
                      onChange={(event) => onQuantityChange(line.product.id, Number.parseInt(event.target.value, 10))}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      aria-label={`Remove ${line.product.name}`}
                      onClick={() => onRemove(line.product.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="mt-2 text-caption">
                    Line estimate: {Number.isFinite(estimate) ? formatUnitPrice(estimate) : '—'}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
