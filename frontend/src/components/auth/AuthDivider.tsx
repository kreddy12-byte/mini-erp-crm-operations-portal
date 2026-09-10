export function AuthDivider() {
  return (
    <div className="relative my-5" role="separator" aria-label="or">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-line" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-surface px-2 text-caption">or</span>
      </div>
    </div>
  );
}
