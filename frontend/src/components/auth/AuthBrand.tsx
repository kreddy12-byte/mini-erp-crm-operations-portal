import { APP_NAME, APP_PRODUCT } from '../../constants/app.ts';

export function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'mb-6 flex items-center gap-3' : 'mb-8 flex items-center gap-3'}>
      <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-md" />
      <div>
        <p className="text-sm font-semibold text-ink">{APP_NAME}</p>
        <p className="text-caption">{APP_PRODUCT}</p>
      </div>
    </div>
  );
}
